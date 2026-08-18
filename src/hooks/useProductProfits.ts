import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';

export interface ProductCostData {
  market_commission: number;
  unit_cost: number;
  warehouse_fee: number;
  shipping_fee: number;
  barcode_fee: number;
  box_fee: number;
  other_fee: number;
  multiplier: number;
  base_name: string | null;
}

export default function useProductProfits(storeId: number | null) {
  const [costMap, setCostMap] = useState<Map<string, ProductCostData>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;

    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      const [{ data: salesData }, mappingRes] = await Promise.all([
        supabase.from('product_sales').select('name, selling_price, market_commission, unit_cost, warehouse_fee, shipping_fee, barcode_fee, box_fee, other_fee, multiplier, base_name').eq('store_id', storeId),
        fetch(`/api/product-mapping?storeId=${storeId}`).then(r => r.json()),
      ]);

      const saleCostMap: Record<string, ProductCostData> = {};
      (salesData || []).forEach((s: ProductCostData & { name: string; selling_price: number }) => {
        saleCostMap[s.name] = {
          market_commission: s.market_commission || Math.round((s.selling_price || 0) * 0.12),
          unit_cost: s.unit_cost || 0,
          warehouse_fee: s.warehouse_fee || 0,
          shipping_fee: s.shipping_fee || 0,
          barcode_fee: s.barcode_fee || 0,
          box_fee: s.box_fee || 0,
          other_fee: s.other_fee || 0,
          multiplier: s.multiplier || 1,
          base_name: s.base_name,
        };
      });

      const CHANNEL_LABEL_MAP: Record<string, string> = {
        '판매자배송': 'marketplace',
        '로켓그로스': 'rocket_growth',
      };

      const map = new Map<string, ProductCostData>();
      (mappingRes.data || []).forEach((m: { coupang_product_name: string; product_sale_name: string }) => {
        const cost = saleCostMap[m.product_sale_name];
        const cleanKey = m.coupang_product_name.trim().replace(/\s+/g, ' ');
        if (cost) {
          map.set(cleanKey, cost);
        }
        // 채널 변형이 있으면 채널별 키도 등록 (예: "키|marketplace")
        // 채널 변형의 수수료가 0이면 베이스 상품 수수료를 상속
        for (const [label, channelId] of Object.entries(CHANNEL_LABEL_MAP)) {
          const variantCost = saleCostMap[`${m.product_sale_name} [${label}]`];
          if (variantCost) {
            map.set(`${cleanKey}|${channelId}`, {
              ...variantCost,
              market_commission: variantCost.market_commission || (cost?.market_commission ?? 0),
            });
          }
        }
      });
      setCostMap(map);
      setLoading(false);
    };

    fetchData();
  }, [storeId]);

  return { costMap, loading };
}

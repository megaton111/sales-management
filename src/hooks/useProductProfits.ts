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
  sale_name: string;
  option_size: string | null;
}

export interface CostHistoryEntry {
  average_unit_cost: number;
  created_at: string;
}

export default function useProductProfits(storeId: number | null) {
  const [costMap, setCostMap] = useState<Map<string, ProductCostData>>(new Map());
  const [costHistoryByName, setCostHistoryByName] = useState<Map<string, CostHistoryEntry[]>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;

    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      const [{ data: salesData }, mappingRes, { data: historyData }] = await Promise.all([
        supabase.from('product_sales').select('name, selling_price, market_commission, unit_cost, warehouse_fee, shipping_fee, barcode_fee, box_fee, other_fee, multiplier, base_name, option_size').eq('store_id', storeId),
        fetch(`/api/product-mapping?storeId=${storeId}`).then(r => r.json()),
        supabase.from('product_cost_history').select('name, average_unit_cost, created_at').eq('store_id', storeId).order('created_at', { ascending: true }),
      ]);

      const historyMap = new Map<string, CostHistoryEntry[]>();
      for (const h of (historyData || [])) {
        if (!historyMap.has(h.name)) historyMap.set(h.name, []);
        historyMap.get(h.name)!.push({ average_unit_cost: Number(h.average_unit_cost), created_at: h.created_at });
      }

      const saleCostMap: Record<string, ProductCostData> = {};
      (salesData || []).forEach((s: { name: string; selling_price: number; market_commission: number; unit_cost: number; warehouse_fee: number; shipping_fee: number; barcode_fee: number; box_fee: number; other_fee: number; multiplier: number; base_name: string | null; option_size: string | null }) => {
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
          sale_name: s.name,
          option_size: s.option_size ?? null,
        };
      });

      const CHANNEL_LABEL_MAP: Record<string, string> = {
        '판매자배송': 'marketplace',
        '쿠팡(판매자배송)': 'marketplace',
        '로켓그로스': 'rocket_growth',
        '쿠팡(로켓그로스)': 'rocket_growth',
        '스마트스토어': 'smartstore',
      };

      const map = new Map<string, ProductCostData>();
      (mappingRes.data || []).forEach((m: { coupang_product_name: string; product_sale_name: string }) => {
        const cost = saleCostMap[m.product_sale_name];
        const cleanKey = m.coupang_product_name.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
        if (cost) {
          map.set(cleanKey, cost);
          // 로켓그로스는 vendor_item_name = product_name (옵션 없음)이라 쉼표 포함 매핑과 불일치.
          // 쉼표 앞 기본 상품명도 fallback 키로 등록 (이미 다른 매핑이 차지하지 않은 경우만)
          if (m.coupang_product_name.includes(',')) {
            const baseName = m.coupang_product_name.split(',')[0].trim().replace(/\s+/g, ' ');
            if (baseName && !map.has(baseName)) {
              map.set(baseName, cost);
            }
          }
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
          // 채널+옵션 변형도 등록: "상품명 [채널] [사이즈]" → cleanKey가 사이즈로 끝나면 매칭
          const prefix = `${m.product_sale_name} [${label}] [`;
          for (const [saleName, optCost] of Object.entries(saleCostMap)) {
            if (saleName.startsWith(prefix) && saleName.endsWith(']')) {
              const size = saleName.slice(prefix.length, -1).toLowerCase();
              if (cleanKey.toLowerCase().endsWith(' ' + size)) {
                map.set(`${cleanKey}|${channelId}`, {
                  ...optCost,
                  market_commission: optCost.market_commission || (cost?.market_commission ?? 0),
                });
              }
            }
          }
        }
      });
      setCostMap(map);
      setCostHistoryByName(historyMap);
      setLoading(false);
    };

    fetchData();
  }, [storeId]);

  return { costMap, costHistoryByName, loading };
}

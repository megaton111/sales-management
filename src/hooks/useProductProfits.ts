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
        supabase.from('product_sales').select('name, market_commission, unit_cost, warehouse_fee, shipping_fee, barcode_fee, box_fee, other_fee, multiplier, base_name').eq('store_id', storeId),
        fetch(`/api/product-mapping?storeId=${storeId}`).then(r => r.json()),
      ]);

      const saleCostMap: Record<string, ProductCostData> = {};
      (salesData || []).forEach((s: ProductCostData & { name: string }) => {
        saleCostMap[s.name] = {
          market_commission: s.market_commission || 0,
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

      const map = new Map<string, ProductCostData>();
      (mappingRes.data || []).forEach((m: { coupang_product_name: string; product_sale_name: string }) => {
        const cost = saleCostMap[m.product_sale_name];
        if (cost) {
          const cleanKey = m.coupang_product_name.trim().replace(/\s+/g, ' ');
          map.set(cleanKey, cost);
        }
      });
      setCostMap(map);
      setLoading(false);
    };

    fetchData();
  }, [storeId]);

  return { costMap, loading };
}

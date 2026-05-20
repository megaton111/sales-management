import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function useProductProfits(storeId: number | null) {
  const [profitMap, setProfitMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;

    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      const [{ data: salesData }, mappingRes] = await Promise.all([
        supabase.from('product_sales').select('name, profit').eq('store_id', storeId),
        fetch(`/api/product-mapping?storeId=${storeId}`).then(r => r.json()),
      ]);

      const saleProfitMap: Record<string, number> = {};
      (salesData || []).forEach((s: { name: string; profit: number }) => {
        saleProfitMap[s.name] = s.profit;
      });

      const map = new Map<string, number>();
      (mappingRes.data || []).forEach((m: { coupang_product_name: string; product_sale_name: string }) => {
        const profit = saleProfitMap[m.product_sale_name];
        if (profit !== undefined) {
          map.set(m.coupang_product_name, profit);
        }
      });

      setProfitMap(map);
      setLoading(false);
    };

    fetchData();
  }, [storeId]);

  return { profitMap, loading };
}

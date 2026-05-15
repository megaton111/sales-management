import { useState, useEffect, useCallback, useMemo } from 'react';

interface DailySaleRow {
  id: number;
  store_id: number;
  sale_date: string;
  channel: string;
  total_sale_amount: number;
  order_count: number;
}

interface SaleItem {
  sale_date: string;
  channel: string;
  product_name: string;
  quantity: number;
}

interface DaySales {
  marketplace: number;
  rocketGrowth: number;
  marketplaceProfit: number;
  rocketGrowthProfit: number;
}

export default function useMonthlySales(
  storeId: number | null,
  year: number,
  month: number,
  profitMap?: Map<string, number>
) {
  const [rows, setRows] = useState<DailySaleRow[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sales/monthly?year=${year}&month=${month}&storeId=${storeId}`
      );
      const json = await res.json();
      if (res.ok) {
        setRows(json.data);
        setSaleItems(json.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dailySalesMap = useMemo(() => {
    const map = new Map<number, DaySales>();
    for (const row of rows) {
      const day = new Date(row.sale_date).getDate();
      const existing = map.get(day) || { marketplace: 0, rocketGrowth: 0, marketplaceProfit: 0, rocketGrowthProfit: 0 };
      if (row.channel === 'marketplace') {
        existing.marketplace += Number(row.total_sale_amount);
      } else if (row.channel === 'rocket_growth') {
        existing.rocketGrowth += Number(row.total_sale_amount);
      }
      map.set(day, existing);
    }

    if (profitMap && profitMap.size > 0) {
      for (const item of saleItems) {
        const day = new Date(item.sale_date).getDate();
        const existing = map.get(day);
        if (!existing) continue;
        const unitProfit = profitMap.get(item.product_name) ?? 0;
        const itemProfit = unitProfit * item.quantity;
        if (item.channel === 'marketplace') {
          existing.marketplaceProfit += itemProfit;
        } else if (item.channel === 'rocket_growth') {
          existing.rocketGrowthProfit += itemProfit;
        }
      }
    }

    return map;
  }, [rows, saleItems, profitMap]);

  const totalMarketplace = useMemo(() =>
    rows.filter(r => r.channel === 'marketplace').reduce((sum, r) => sum + Number(r.total_sale_amount), 0),
    [rows]
  );

  const totalRocketGrowth = useMemo(() =>
    rows.filter(r => r.channel === 'rocket_growth').reduce((sum, r) => sum + Number(r.total_sale_amount), 0),
    [rows]
  );

  const totalProfit = useMemo(() => {
    if (!profitMap || profitMap.size === 0) return 0;
    let sum = 0;
    for (const [, daySales] of dailySalesMap) {
      sum += daySales.marketplaceProfit + daySales.rocketGrowthProfit;
    }
    return sum;
  }, [dailySalesMap, profitMap]);

  return { dailySalesMap, totalMarketplace, totalRocketGrowth, totalProfit, loading, refetch: fetchData };
}

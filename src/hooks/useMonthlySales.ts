import { useState, useEffect, useCallback, useMemo } from 'react';

interface DailySaleRow {
  id: number;
  store_id: number;
  sale_date: string;
  channel: string;
  total_sale_amount: number;
  order_count: number;
}

interface DaySales {
  marketplace: number;
  rocketGrowth: number;
}

export default function useMonthlySales(storeId: number | null, year: number, month: number) {
  const [rows, setRows] = useState<DailySaleRow[]>([]);
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
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 일별 채널별 매출 맵
  const dailySalesMap = useMemo(() => {
    const map = new Map<number, DaySales>();
    for (const row of rows) {
      const day = new Date(row.sale_date).getDate();
      const existing = map.get(day) || { marketplace: 0, rocketGrowth: 0 };
      if (row.channel === 'marketplace') {
        existing.marketplace += Number(row.total_sale_amount);
      } else if (row.channel === 'rocket_growth') {
        existing.rocketGrowth += Number(row.total_sale_amount);
      }
      map.set(day, existing);
    }
    return map;
  }, [rows]);

  // 월 총합 (채널별)
  const totalMarketplace = useMemo(() =>
    rows.filter(r => r.channel === 'marketplace').reduce((sum, r) => sum + Number(r.total_sale_amount), 0),
    [rows]
  );

  const totalRocketGrowth = useMemo(() =>
    rows.filter(r => r.channel === 'rocket_growth').reduce((sum, r) => sum + Number(r.total_sale_amount), 0),
    [rows]
  );

  return { dailySalesMap, totalMarketplace, totalRocketGrowth, loading, refetch: fetchData };
}

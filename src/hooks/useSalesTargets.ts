import { useState, useEffect, useCallback } from 'react';

export default function useSalesTargets(storeId: number | null, year: number) {
  const [targets, setTargets] = useState<Map<number, number>>(new Map());

  const fetchTargets = useCallback(async () => {
    if (!storeId) return;
    const res = await fetch(`/api/sales-targets?storeId=${storeId}&year=${year}`);
    if (!res.ok) return;
    const { targets: rows } = await res.json();
    const map = new Map<number, number>();
    for (const row of rows) map.set(row.month, Number(row.target_amount));
    setTargets(map);
  }, [storeId, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const saveTarget = useCallback(async (month: number, targetAmount: number) => {
    if (!storeId) return;
    await fetch('/api/sales-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, year, month, targetAmount }),
    });
    setTargets(prev => new Map(prev).set(month, targetAmount));
  }, [storeId, year]);

  return { targets, saveTarget };
}

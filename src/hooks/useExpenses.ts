import { useState, useEffect, useCallback, useMemo } from 'react';

interface Expense {
  id: number;
  store_id: number;
  expense_date: string;
  expense_type: string;
  amount: number;
  memo: string;
}

export const EXPENSE_TYPES = [
  '플랫폼 광고비',
  '마케팅',
  '샘플구매',
  '포장재료구매',
  '제품촬영',
  '솔루션 구독',
  '택배비',
  '기타',
] as const;

export default function useExpenses(storeId: number | null, year: number, month: number) {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/expenses?year=${year}&month=${month}&storeId=${storeId}`
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

  const addExpense = useCallback(async (expenseDate: string, expenseType: string, amount: number, memo: string) => {
    if (!storeId) return false;
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, expenseDate, expenseType, amount, memo }),
    });
    if (res.ok) {
      await fetchData();
      return true;
    }
    return false;
  }, [storeId, fetchData]);

  const updateExpense = useCallback(async (id: number, expenseDate: string, expenseType: string, amount: number, memo: string) => {
    const res = await fetch('/api/expenses', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, expenseDate, expenseType, amount, memo }),
    });
    if (res.ok) {
      await fetchData();
      return true;
    }
    return false;
  }, [fetchData]);

  const deleteExpense = useCallback(async (id: number) => {
    const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchData();
      return true;
    }
    return false;
  }, [fetchData]);

  const totalAmount = useMemo(() =>
    rows.reduce((sum, r) => sum + Number(r.amount), 0),
    [rows]
  );

  const totalByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.expense_type, (map.get(row.expense_type) || 0) + Number(row.amount));
    }
    return map;
  }, [rows]);

  return { rows, loading, totalAmount, totalByType, addExpense, updateExpense, deleteExpense };
}

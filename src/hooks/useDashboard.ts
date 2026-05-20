import { useState, useEffect, useCallback, useMemo } from 'react';

interface SaleRow {
  sale_date: string;
  channel: string;
  total_sale_amount: number;
}

interface SaleItem {
  sale_date: string;
  channel: string;
  product_name: string;
  quantity: number;
  unit_profit: number;
}

interface ExpenseRow {
  expense_date: string;
  amount: number;
}

export default function useDashboard(
  storeId: number | null,
  year: number,
  profitMap: Map<string, number>
) {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?year=${year}&storeId=${storeId}`);
      const json = await res.json();
      if (res.ok) {
        setSales(json.sales);
        setItems(json.items);
        setExpenses(json.expenses);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentMonth = new Date().getMonth() + 1;

  const totalSales = useMemo(() => {
    let marketplace = 0;
    let rocketGrowth = 0;
    for (const row of sales) {
      const amount = Number(row.total_sale_amount);
      if (row.channel === 'marketplace') marketplace += amount;
      else if (row.channel === 'rocket_growth') rocketGrowth += amount;
    }
    return { marketplace, rocketGrowth, total: marketplace + rocketGrowth };
  }, [sales]);

  const totalExpenses = useMemo(() => {
    let yearly = 0;
    let monthly = 0;
    const monthStr = String(currentMonth).padStart(2, '0');
    for (const row of expenses) {
      const amount = Number(row.amount);
      yearly += amount;
      if (row.expense_date.slice(5, 7) === monthStr) {
        monthly += amount;
      }
    }
    return { yearly, monthly };
  }, [expenses, currentMonth]);

  const totalProfit = useMemo(() => {
    let yearly = 0;
    let monthly = 0;
    const monthStr = String(currentMonth).padStart(2, '0');
    for (const item of items) {
      const unitProfit = item.unit_profit || (profitMap.get(item.product_name) ?? 0);
      const itemProfit = unitProfit * item.quantity;
      yearly += itemProfit;
      if (item.sale_date.slice(5, 7) === monthStr) {
        monthly += itemProfit;
      }
    }
    return { yearly: yearly - totalExpenses.yearly, monthly: monthly - totalExpenses.monthly };
  }, [items, profitMap, currentMonth, totalExpenses]);

  const monthlyChart = useMemo(() => {
    const monthMap = new Map<number, { sales: number; profit: number; expenses: number }>();
    for (let m = 1; m <= 12; m++) {
      monthMap.set(m, { sales: 0, profit: 0, expenses: 0 });
    }
    for (const row of sales) {
      const m = Number(row.sale_date.slice(5, 7));
      const entry = monthMap.get(m)!;
      entry.sales += Number(row.total_sale_amount);
    }
    for (const item of items) {
      const m = Number(item.sale_date.slice(5, 7));
      const unitProfit = item.unit_profit || (profitMap.get(item.product_name) ?? 0);
      const entry = monthMap.get(m)!;
      entry.profit += unitProfit * item.quantity;
    }
    for (const row of expenses) {
      const m = Number(row.expense_date.slice(5, 7));
      const entry = monthMap.get(m)!;
      entry.expenses += Number(row.amount);
    }
    return Array.from(monthMap.entries())
      .filter(([m]) => m <= currentMonth)
      .map(([m, v]) => ({
        month: `${m}월`,
        sales: v.sales,
        profit: v.profit - v.expenses,
      }));
  }, [sales, items, expenses, profitMap]);

  const salesRanking = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.product_name, (map.get(item.product_name) || 0) + item.quantity);
    }
    return Array.from(map.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [items]);

  return { loading, totalSales, totalExpenses, totalProfit, monthlyChart, salesRanking, currentMonth };
}

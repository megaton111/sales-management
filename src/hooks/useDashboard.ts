import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ProductCostData } from './useProductProfits';

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
  sale_amount: number;
}

interface ExpenseRow {
  expense_date: string;
  amount: number;
}

function calcItemProfit(saleAmount: number, quantity: number, cost: ProductCostData): number {
  const supplyPrice = Math.round(saleAmount / 1.1);
  const totalCost = (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * quantity;
  return supplyPrice - totalCost;
}

export default function useDashboard(
  storeId: number | null,
  year: number,
  costMap: Map<string, ProductCostData>
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
      const cost = costMap.get(item.product_name);
      const itemProfit = cost
        ? calcItemProfit(item.sale_amount, item.quantity, cost)
        : item.unit_profit * item.quantity;
      yearly += itemProfit;
      if (item.sale_date.slice(5, 7) === monthStr) {
        monthly += itemProfit;
      }
    }
    return { yearly: yearly - totalExpenses.yearly, monthly: monthly - totalExpenses.monthly };
  }, [items, costMap, currentMonth, totalExpenses]);

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
      const cost = costMap.get(item.product_name);
      const entry = monthMap.get(m)!;
      entry.profit += cost
        ? calcItemProfit(item.sale_amount, item.quantity, cost)
        : item.unit_profit * item.quantity;
    }
    for (const row of expenses) {
      const m = Number(row.expense_date.slice(5, 7));
      const entry = monthMap.get(m)!;
      entry.expenses += Number(row.amount);
    }
    const currentYear = new Date().getFullYear();
    const maxMonth = year < currentYear ? 12 : currentMonth;
    return Array.from(monthMap.entries())
      .filter(([m]) => m <= maxMonth)
      .map(([m, v]) => ({
        month: `${m}월`,
        sales: v.sales,
        profit: v.profit - v.expenses,
      }));
  }, [sales, items, expenses, costMap, year, currentMonth]);

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

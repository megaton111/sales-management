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
  costMap: Map<string, ProductCostData>,
  month: number | null = null
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

  const filteredSales = useMemo(() => {
    if (!month) return sales;
    const monthStr = String(month).padStart(2, '0');
    return sales.filter((row) => row.sale_date.slice(5, 7) === monthStr);
  }, [sales, month]);

  const filteredItems = useMemo(() => {
    if (!month) return items;
    const monthStr = String(month).padStart(2, '0');
    return items.filter((item) => item.sale_date.slice(5, 7) === monthStr);
  }, [items, month]);

  const filteredExpenses = useMemo(() => {
    if (!month) return expenses;
    const monthStr = String(month).padStart(2, '0');
    return expenses.filter((row) => row.expense_date.slice(5, 7) === monthStr);
  }, [expenses, month]);

  const totalSales = useMemo(() => {
    let marketplace = 0;
    let rocketGrowth = 0;
    for (const row of filteredSales) {
      const amount = Number(row.total_sale_amount);
      if (row.channel === 'marketplace') marketplace += amount;
      else if (row.channel === 'rocket_growth') rocketGrowth += amount;
    }
    return { marketplace, rocketGrowth, total: marketplace + rocketGrowth };
  }, [filteredSales]);

  const totalExpenses = useMemo(() => {
    let total = 0;
    for (const row of filteredExpenses) {
      total += Number(row.amount);
    }
    return total;
  }, [filteredExpenses]);

  const totalProfit = useMemo(() => {
    let total = 0;
    for (const item of filteredItems) {
      const cost = costMap.get(item.product_name.trim().replace(/\s+/g, ' '));
      total += cost
        ? calcItemProfit(item.sale_amount, item.quantity, cost)
        : item.unit_profit * item.quantity;
    }
    return total - totalExpenses;
  }, [filteredItems, costMap, totalExpenses]);

  const chartData = useMemo(() => {
    if (month) {
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayMap = new Map<number, { sales: number; profit: number; expenses: number }>();
      for (let d = 1; d <= daysInMonth; d++) {
        dayMap.set(d, { sales: 0, profit: 0, expenses: 0 });
      }
      for (const row of filteredSales) {
        const d = Number(row.sale_date.slice(8, 10));
        const entry = dayMap.get(d)!;
        entry.sales += Number(row.total_sale_amount);
      }
      for (const item of filteredItems) {
        const d = Number(item.sale_date.slice(8, 10));
        const cost = costMap.get(item.product_name.trim().replace(/\s+/g, ' '));
        const entry = dayMap.get(d)!;
        entry.profit += cost
          ? calcItemProfit(item.sale_amount, item.quantity, cost)
          : item.unit_profit * item.quantity;
      }
      for (const row of filteredExpenses) {
        const d = Number(row.expense_date.slice(8, 10));
        const entry = dayMap.get(d)!;
        entry.expenses += Number(row.amount);
      }
      return Array.from(dayMap.entries()).map(([d, v]) => ({
        label: `${d}일`,
        sales: v.sales,
        expenses: v.expenses,
        profit: v.profit - v.expenses,
      }));
    }

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
      const cost = costMap.get(item.product_name.trim().replace(/\s+/g, ' '));
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
        label: `${m}월`,
        sales: v.sales,
        expenses: v.expenses,
        profit: v.profit - v.expenses,
      }));
  }, [sales, items, expenses, filteredSales, filteredItems, filteredExpenses, costMap, year, month, currentMonth]);

  const salesRanking = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of filteredItems) {
      map.set(item.product_name, (map.get(item.product_name) || 0) + item.quantity);
    }
    return Array.from(map.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [filteredItems]);

  return { loading, totalSales, totalExpenses, totalProfit, chartData, salesRanking, currentMonth, selectedMonth: month };
}

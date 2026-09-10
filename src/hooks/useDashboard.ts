import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ProductCostData } from './useProductProfits';

interface SaleRow {
  sale_date: string;
  channel: string;
  total_sale_amount: number;
  order_count: number;
}

interface SaleItem {
  sale_date: string;
  channel: string;
  product_name: string;
  vendor_item_name: string;
  quantity: number;
  unit_profit: number;
  sale_amount: number;
}

interface ExpenseRow {
  expense_date: string;
  amount: number;
  expense_type?: string;
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
  const [prevItems, setPrevItems] = useState<SaleItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [refundRanking, setRefundRanking] = useState<{ name: string; channel: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [res, prevRes, refundRes] = await Promise.all([
        fetch(`/api/dashboard?year=${year}&storeId=${storeId}`),
        fetch(`/api/dashboard?year=${year - 1}&storeId=${storeId}`),
        fetch(`/api/dashboard/refunds?year=${year}&storeId=${storeId}`),
      ]);
      const json = await res.json();
      if (res.ok) {
        setSales(json.sales);
        setItems(json.items);
        setExpenses(json.expenses);
      }
      if (prevRes.ok) {
        const prevJson = await prevRes.json();
        setPrevItems(prevJson.items ?? []);
      }
      if (refundRes.ok) {
        const refundJson = await refundRes.json();
        setRefundRanking(refundJson.refunds ?? []);
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
    let smartstore = 0;
    for (const row of filteredSales) {
      const amount = Number(row.total_sale_amount);
      if (row.channel === 'marketplace') marketplace += amount;
      else if (row.channel === 'rocket_growth') rocketGrowth += amount;
      else if (row.channel === 'smartstore') smartstore += amount;
    }
    return { marketplace, rocketGrowth, smartstore, total: marketplace + rocketGrowth + smartstore };
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
      const cost = costMap.get(`${item.product_name.trim().replace(/\s+/g, ' ')}|${item.channel}`) ?? costMap.get(item.product_name.trim().replace(/\s+/g, ' '));
      total += cost
        ? calcItemProfit(item.sale_amount, item.quantity, cost)
        : item.sale_amount;
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
        const cost = costMap.get(`${item.product_name.trim().replace(/\s+/g, ' ')}|${item.channel}`) ?? costMap.get(item.product_name.trim().replace(/\s+/g, ' '));
        const entry = dayMap.get(d)!;
        entry.profit += cost
          ? calcItemProfit(item.sale_amount, item.quantity, cost)
          : item.sale_amount;
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
      const cost = costMap.get(`${item.product_name.trim().replace(/\s+/g, ' ')}|${item.channel}`) ?? costMap.get(item.product_name.trim().replace(/\s+/g, ' '));
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
    const map = new Map<string, { name: string; channel: string; quantity: number; amount: number; profit: number }>();
    for (const item of filteredItems) {
      const vin = item.vendor_item_name;
      const displayName = !vin || vin === item.product_name
        ? item.product_name
        : vin.startsWith(item.product_name)
          ? vin
          : `${item.product_name} ${vin}`;
      const key = `${item.channel}|${displayName}`;
      const cost = costMap.get(`${item.product_name.trim().replace(/\s+/g, ' ')}|${item.channel}`) ?? costMap.get(item.product_name.trim().replace(/\s+/g, ' '));
      const profit = cost ? calcItemProfit(item.sale_amount, item.quantity, cost) : 0;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.amount += item.sale_amount;
        existing.profit += profit;
      } else {
        map.set(key, { name: displayName, channel: item.channel, quantity: item.quantity, amount: item.sale_amount, profit });
      }
    }
    return Array.from(map.values());
  }, [filteredItems, costMap]);

  const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

  const ordersByDayOfWeek = useMemo(() => {
    const counts = Array(7).fill(0) as number[];
    const amounts = Array(7).fill(0) as number[];
    for (const row of filteredSales) {
      if (row.channel === 'mp_refund' || row.channel === 'rg_refund' || row.channel === 'ss_refund') continue;
      const dow = new Date(row.sale_date).getDay();
      counts[dow] += Number(row.order_count);
      amounts[dow] += Number(row.total_sale_amount);
    }
    // 월(1)부터 시작해서 일(0) 순으로 재배열
    return [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      day: DOW_LABELS[dow],
      count: counts[dow],
      amount: amounts[dow],
      isWeekend: dow === 0 || dow === 6,
    }));
  }, [filteredSales]);

  const productMonthlyData = useMemo(() => {
    // 최근 12개월 범위 계산 (현재 연도 기준 → year 파라미터 기준)
    const now = new Date();
    const isCurrentYear = year === now.getFullYear();
    const endMonth = isCurrentYear ? now.getMonth() + 1 : 12;

    // 12개월 레이블 생성: endMonth 기준 역산
    const months: { label: string; year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      let m = endMonth - i;
      let y = year;
      if (m <= 0) { m += 12; y = year - 1; }
      months.push({ label: `${String(y).slice(2)}.${m}`, year: y, month: m });
    }

    // 전년도 + 당해년도 items 합산
    const allItems = [...prevItems, ...items];

    // 상품별 12개월 총 판매량으로 상위 10개 선정
    const totalMap = new Map<string, number>();
    for (const item of allItems) {
      const itemYear = Number(item.sale_date.slice(0, 4));
      const itemMonth = Number(item.sale_date.slice(5, 7));
      if (!months.some(m => m.year === itemYear && m.month === itemMonth)) continue;
      const vin = item.vendor_item_name;
      const name = !vin || vin === item.product_name
        ? item.product_name
        : vin.startsWith(item.product_name) ? vin : `${item.product_name} ${vin}`;
      const key = `${item.channel}|${name}`;
      totalMap.set(key, (totalMap.get(key) ?? 0) + item.quantity);
    }
    const top10 = Array.from(totalMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key]) => key);

    // 월별 × 상품별 집계
    const monthData = new Map<string, Record<string, number>>();
    for (const { label } of months) {
      const row: Record<string, number> = {};
      for (const key of top10) row[key] = 0;
      monthData.set(label, row);
    }
    for (const item of allItems) {
      const itemYear = Number(item.sale_date.slice(0, 4));
      const itemMonth = Number(item.sale_date.slice(5, 7));
      const slot = months.find(m => m.year === itemYear && m.month === itemMonth);
      if (!slot) continue;
      const vin = item.vendor_item_name;
      const name = !vin || vin === item.product_name
        ? item.product_name
        : vin.startsWith(item.product_name) ? vin : `${item.product_name} ${vin}`;
      const key = `${item.channel}|${name}`;
      if (!top10.includes(key)) continue;
      monthData.get(slot.label)![key] += item.quantity;
    }

    const rows = months.map(({ label }) => ({ month: label, ...monthData.get(label)! }));
    return { keys: top10, rows };
  }, [items, prevItems, year]);

  const expenseByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of expenses) {
      if (!row.expense_type) continue;
      map.set(row.expense_type, (map.get(row.expense_type) || 0) + Number(row.amount));
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([type, amount]) => ({ type, amount, ratio: total > 0 ? amount / total : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  return { loading, totalSales, totalExpenses, totalProfit, chartData, salesRanking, refundRanking, expenseByType, ordersByDayOfWeek, productMonthlyData, currentMonth, selectedMonth: month };
}

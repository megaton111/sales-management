import { useState, useCallback } from 'react';

interface SalesItem {
  id: number;
  vendor_item_id: number;
  product_name: string;
  vendor_item_name: string;
  quantity: number;
  sale_amount: number;
}

function mergeItems(items: SalesItem[]): SalesItem[] {
  const merged = new Map<number, SalesItem>();
  for (const item of items) {
    const existing = merged.get(item.vendor_item_id);
    if (existing) {
      existing.quantity += item.quantity;
      existing.sale_amount += item.sale_amount;
    } else {
      merged.set(item.vendor_item_id, { ...item });
    }
  }
  return Array.from(merged.values()).sort((a, b) => b.sale_amount - a.sale_amount);
}

export default function useDailySalesDetail(storeId: number | null) {
  const [items, setItems] = useState<SalesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  const fetchDetail = useCallback(async (date: string, channel: string) => {
    if (!storeId) return;
    setSelectedDate(date);
    setSelectedChannel(channel);
    setLabel(null);
    setLoading(true);
    try {
      if (channel === 'all') {
        const res = await fetch(
          `/api/sales/daily?date=${date}&storeId=${storeId}&channel=all`
        );
        const json = await res.json();
        if (res.ok) {
          setItems(mergeItems(json.data || []));
        }
      } else {
        const res = await fetch(
          `/api/sales/daily?date=${date}&storeId=${storeId}&channel=${channel}`
        );
        const json = await res.json();
        if (res.ok) {
          setItems(json.data);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const fetchMonthly = useCallback(async (year: number, month: number, channel: string, displayLabel: string) => {
    if (!storeId) return;
    setSelectedDate(null);
    setSelectedChannel(channel);
    setLabel(displayLabel);
    setLoading(true);
    try {
      const lastDay = new Date(year, month, 0).getDate();
      const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const res = await fetch(
        `/api/sales/daily?dateFrom=${dateFrom}&dateTo=${dateTo}&storeId=${storeId}&channel=${channel}`
      );
      const json = await res.json();
      if (res.ok) {
        setItems(mergeItems(json.data || []));
      }
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const clear = useCallback(() => {
    setSelectedDate(null);
    setSelectedChannel(null);
    setLabel(null);
    setItems([]);
  }, []);

  return { items, loading, selectedDate, selectedChannel, label, fetchDetail, fetchMonthly, clear };
}

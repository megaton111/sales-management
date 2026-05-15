import { useState, useCallback } from 'react';

interface SalesItem {
  id: number;
  vendor_item_id: number;
  product_name: string;
  vendor_item_name: string;
  quantity: number;
  sale_amount: number;
}

export default function useDailySalesDetail(storeId: number | null) {
  const [items, setItems] = useState<SalesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const fetchDetail = useCallback(async (date: string, channel: string) => {
    if (!storeId) return;
    setSelectedDate(date);
    setSelectedChannel(channel);
    setLoading(true);
    try {
      if (channel === 'all') {
        const [mpRes, rgRes] = await Promise.all([
          fetch(`/api/sales/daily?date=${date}&storeId=${storeId}&channel=marketplace`),
          fetch(`/api/sales/daily?date=${date}&storeId=${storeId}&channel=rocket_growth`),
        ]);
        const [mpJson, rgJson] = await Promise.all([mpRes.json(), rgRes.json()]);
        const allItems: SalesItem[] = [...(mpJson.data || []), ...(rgJson.data || [])];
        const merged = new Map<number, SalesItem>();
        for (const item of allItems) {
          const existing = merged.get(item.vendor_item_id);
          if (existing) {
            existing.quantity += item.quantity;
            existing.sale_amount += item.sale_amount;
          } else {
            merged.set(item.vendor_item_id, { ...item });
          }
        }
        setItems(Array.from(merged.values()).sort((a, b) => b.sale_amount - a.sale_amount));
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

  const clear = useCallback(() => {
    setSelectedDate(null);
    setSelectedChannel(null);
    setItems([]);
  }, []);

  return { items, loading, selectedDate, selectedChannel, fetchDetail, clear };
}

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
      const res = await fetch(
        `/api/sales/daily?date=${date}&storeId=${storeId}&channel=${channel}`
      );
      const json = await res.json();
      if (res.ok) {
        setItems(json.data);
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

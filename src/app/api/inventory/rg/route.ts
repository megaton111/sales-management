import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');

  if (!storeId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const [{ data: inventoryRows, error: invError }, { data: dbItems, error: nameError }] = await Promise.all([
      supabase
        .from('rg_inventory')
        .select('vendor_item_id, stock, sales_last_30, updated_at')
        .eq('store_id', storeId),
      supabase
        .from('daily_sales_items')
        .select('vendor_item_id, vendor_item_name, product_name, channel')
        .eq('store_id', storeId)
        .order('sale_date', { ascending: false })
        .limit(10000),
    ]);

    if (invError) throw invError;
    if (nameError) throw nameError;

    if (!inventoryRows || inventoryRows.length === 0) {
      return NextResponse.json({ data: [], updatedAt: null });
    }

    const nameMap = new Map<number, { vendorItemName: string; productName: string }>();
    for (const row of dbItems || []) {
      const id = Number(row.vendor_item_id);
      if (!nameMap.has(id) || row.channel === 'rocket_growth') {
        nameMap.set(id, { vendorItemName: row.vendor_item_name, productName: row.product_name });
      }
    }

    const mapped = inventoryRows
      .filter(item => nameMap.has(Number(item.vendor_item_id)))
      .map(item => {
        const names = nameMap.get(Number(item.vendor_item_id))!;
        const salesLast30 = item.sales_last_30;
        const dailyAvg = salesLast30 / 30;
        const stock = item.stock;
        const daysLeft = dailyAvg > 0 ? Math.round(stock / dailyAvg) : null;
        return {
          vendorItemId: item.vendor_item_id,
          productName: names.productName,
          vendorItemName: names.vendorItemName,
          stock,
          salesLast30,
          dailyAvg: Math.round(dailyAvg * 10) / 10,
          daysLeft,
        };
      });

    const deduped = new Map<string, typeof mapped[0]>();
    for (const item of mapped) {
      const existing = deduped.get(item.vendorItemName);
      if (!existing || item.stock > existing.stock) {
        deduped.set(item.vendorItemName, item);
      }
    }

    const result = Array.from(deduped.values()).sort((a, b) => b.stock - a.stock);
    const updatedAt = inventoryRows[0]?.updated_at ?? null;

    return NextResponse.json({ data: result, updatedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

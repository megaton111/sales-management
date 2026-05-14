import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchAllOrders } from '@/lib/coupang-api';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    kstDate.setDate(kstDate.getDate() - 1);
    const yesterday = kstDate.toISOString().split('T')[0];

    const { data: stores, error: storeError } = await supabase
      .from('stores')
      .select('id');

    if (storeError) throw storeError;

    const results = [];

    for (const store of stores || []) {
      const dailyMap = await fetchAllOrders(yesterday, yesterday);

      for (const [key, daily] of dailyMap) {
        const idx = key.indexOf('_');
        const date = key.substring(0, idx);
        const channel = key.substring(idx + 1);

        await supabase
          .from('daily_sales')
          .upsert({
            store_id: store.id,
            sale_date: date,
            channel,
            total_sale_amount: daily.totalSalePrice,
            total_settlement_amount: 0,
            order_count: daily.orderCount,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'store_id,sale_date,channel' });

        await supabase
          .from('daily_sales_items')
          .delete()
          .eq('store_id', store.id)
          .eq('sale_date', date)
          .eq('channel', channel);

        const itemRows = Array.from(daily.items.values()).map(item => ({
          store_id: store.id,
          sale_date: date,
          channel,
          vendor_item_id: item.vendorItemId,
          product_name: item.productName,
          vendor_item_name: item.vendorItemName,
          quantity: item.quantity,
          sale_amount: item.salePrice,
          settlement_amount: 0,
          sale_type: 'SALE',
        }));

        if (itemRows.length > 0) {
          await supabase.from('daily_sales_items').insert(itemRows);
        }
      }

      results.push({ storeId: store.id, date: yesterday });
    }

    return NextResponse.json({ message: '배치 완료', results });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

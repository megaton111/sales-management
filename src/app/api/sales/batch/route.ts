import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchAllOrders } from '@/lib/coupang-api';

export async function POST(request: NextRequest) {
  try {
    const { dateFrom, dateTo, storeId } = await request.json();

    if (!dateFrom || !dateTo || !storeId) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
    }

    const dailyMap = await fetchAllOrders(dateFrom, dateTo);
    const supabase = await createClient();

    // 이익금 스냅샷용 profitMap 생성
    const [{ data: salesData }, { data: mappingData }] = await Promise.all([
      supabase.from('product_sales').select('name, profit').eq('store_id', storeId),
      supabase.from('product_name_mapping').select('coupang_product_name, product_sale_name').eq('store_id', storeId),
    ]);

    const saleProfitMap: Record<string, number> = {};
    (salesData || []).forEach((s: { name: string; profit: number }) => {
      saleProfitMap[s.name] = s.profit;
    });

    const profitMap = new Map<string, number>();
    (mappingData || []).forEach((m: { coupang_product_name: string; product_sale_name: string }) => {
      const profit = saleProfitMap[m.product_sale_name];
      if (profit !== undefined) {
        profitMap.set(m.coupang_product_name, profit);
      }
    });

    let totalDays = 0;

    for (const [key, daily] of dailyMap) {
      const idx = key.indexOf('_');
      const date = key.substring(0, idx);
      const channel = key.substring(idx + 1);

      const { error: dailyError } = await supabase
        .from('daily_sales')
        .upsert({
          store_id: storeId,
          sale_date: date,
          channel,
          total_sale_amount: daily.totalSalePrice,
          total_settlement_amount: 0,
          order_count: daily.orderCount,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'store_id,sale_date,channel' });

      if (dailyError) throw dailyError;

      await supabase
        .from('daily_sales_items')
        .delete()
        .eq('store_id', storeId)
        .eq('sale_date', date)
        .eq('channel', channel);

      const itemRows = Array.from(daily.items.values()).map(item => ({
        store_id: storeId,
        sale_date: date,
        channel,
        vendor_item_id: item.vendorItemId,
        product_name: item.productName,
        vendor_item_name: item.vendorItemName,
        quantity: item.quantity,
        sale_amount: item.salePrice,
        settlement_amount: 0,
        unit_profit: profitMap.get(item.productName) ?? 0,
        sale_type: 'SALE',
      }));

      if (itemRows.length > 0) {
        const { error: itemsError } = await supabase
          .from('daily_sales_items')
          .insert(itemRows);

        if (itemsError) throw itemsError;
      }

      totalDays++;
    }

    return NextResponse.json({
      message: '매출 데이터 저장 완료',
      days: totalDays,
    });
  } catch (error: unknown) {
    console.error('배치 동기화 오류:', error);
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : JSON.stringify(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

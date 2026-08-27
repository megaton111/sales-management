import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchNaverOrders, NaverCredentials } from '@/lib/naver-api';

export async function POST(request: NextRequest) {
  try {
    const { dateFrom, dateTo, storeId } = await request.json();

    if (!dateFrom || !dateTo || !storeId) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: integration } = await supabase
      .from('store_integrations')
      .select('credentials')
      .eq('store_id', storeId)
      .eq('platform', 'smartstore')
      .single();

    if (!integration) {
      return NextResponse.json({ error: '스마트스토어 연동 정보가 없습니다. 스토어 관리에서 API 키를 등록해주세요.' }, { status: 400 });
    }

    const creds = integration.credentials as NaverCredentials;
    const { dailyMap } = await fetchNaverOrders(dateFrom, dateTo, creds);

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
          total_sale_amount: daily.totalSaleAmount,
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
        vendor_item_id: null,
        product_name: item.productName,
        vendor_item_name: item.optionName || item.productName,
        quantity: item.quantity,
        sale_amount: item.saleAmount,
        settlement_amount: 0,
        unit_profit: 0,
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
      message: '스마트스토어 매출 데이터 저장 완료',
      days: totalDays,
    });
  } catch (error: unknown) {
    console.error('스마트스토어 배치 동기화 오류:', error);
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

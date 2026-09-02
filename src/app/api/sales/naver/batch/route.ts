import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchNaverOrders, fetchNaverReturns, NaverCredentials } from '@/lib/naver-api';

// 상품명+옵션명으로 안정적인 숫자 ID 생성 (vendor_item_id NOT NULL 대응)
function hashId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return Math.abs(hash) || 1;
}

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
        vendor_item_id: hashId(`${item.productName}|${item.optionName}`),
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

      // daily_order_details 저장 (SS 주문별 상세)
      await supabase
        .from('daily_order_details')
        .delete()
        .eq('store_id', storeId)
        .eq('sale_date', date)
        .eq('channel', channel);

      const orderRows = daily.orders.map(o => ({
        store_id: storeId,
        sale_date: date,
        channel,
        vendor_item_id: hashId(`${o.productName}|${o.optionName}`),
        order_id: o.productOrderId,
        paid_at: o.paymentDate,
        quantity: o.quantity,
        unit_price: o.unitPrice,
        sale_amount: o.saleAmount,
      }));

      if (orderRows.length > 0) {
        const { error: orderError } = await supabase.from('daily_order_details').insert(orderRows);
        if (orderError) {
          console.error('[SS batch] daily_order_details insert error:', orderError, orderRows[0]);
          throw new Error(`daily_order_details 저장 실패: ${orderError.message}`);
        }
      }

      totalDays++;
    }

    // 반품 동기화
    const returnRecords = await fetchNaverReturns(dateFrom, dateTo, creds);

    if (returnRecords.length > 0) {
      const returnOrderIds = returnRecords.map(r => r.productOrderId);

      // 반품된 주문을 DB에서 조회 (채널=smartstore, order_id 기준)
      const { data: matchedOrders } = await supabase
        .from('daily_order_details')
        .select('order_id, sale_date, vendor_item_id, quantity, sale_amount')
        .eq('store_id', storeId)
        .eq('channel', 'smartstore')
        .in('order_id', returnOrderIds);

      const orderMap = new Map<string, { saleDate: string; vendorItemId: number; quantity: number; saleAmount: number }>();
      for (const o of matchedOrders || []) {
        orderMap.set(String(o.order_id), { saleDate: o.sale_date, vendorItemId: Number(o.vendor_item_id), quantity: Number(o.quantity), saleAmount: Number(o.sale_amount) });
      }

      // ss_refund 뱃지 집계 (원래 구매일 기준)
      const refundBadgeMap = new Map<string, { count: number; amount: number }>();
      const itemAdjustMap = new Map<string, { quantity: number; saleAmount: number }>();

      for (const r of returnRecords) {
        const info = orderMap.get(r.productOrderId);
        if (!info) continue;
        const key = info.saleDate;
        const existing = refundBadgeMap.get(key) ?? { count: 0, amount: 0 };
        existing.count += 1;
        existing.amount += info.saleAmount;
        refundBadgeMap.set(key, existing);

        const itemKey = `${info.saleDate}|${info.vendorItemId}`;
        const existingItem = itemAdjustMap.get(itemKey) ?? { quantity: 0, saleAmount: 0 };
        existingItem.quantity += info.quantity;
        existingItem.saleAmount += info.saleAmount;
        itemAdjustMap.set(itemKey, existingItem);
      }

      // ss_refund 뱃지 저장 (기존 삭제 후 재삽입)
      await supabase.from('daily_sales').delete()
        .eq('store_id', storeId).eq('channel', 'ss_refund')
        .gte('sale_date', dateFrom).lte('sale_date', dateTo);

      const refundRows = Array.from(refundBadgeMap.entries()).map(([date, { count, amount }]) => ({
        store_id: storeId,
        sale_date: date,
        channel: 'ss_refund',
        total_sale_amount: amount,
        total_settlement_amount: 0,
        order_count: count,
        updated_at: new Date().toISOString(),
      }));
      if (refundRows.length > 0) await supabase.from('daily_sales').insert(refundRows);

      // daily_sales smartstore 매출 차감
      for (const [saleDate, { amount: refAmount, count: refCount }] of refundBadgeMap) {
        const { data: cur } = await supabase.from('daily_sales').select('total_sale_amount, order_count')
          .eq('store_id', storeId).eq('sale_date', saleDate).eq('channel', 'smartstore').maybeSingle();
        if (cur) {
          await supabase.from('daily_sales').update({
            total_sale_amount: Math.max(0, Number(cur.total_sale_amount) - refAmount),
            order_count: Math.max(0, Number(cur.order_count) - refCount),
          }).eq('store_id', storeId).eq('sale_date', saleDate).eq('channel', 'smartstore');
        }
      }

      // daily_sales_items 수량/금액 차감
      for (const [key, { quantity: refQty, saleAmount: refAmt }] of itemAdjustMap) {
        const [saleDate, vendorItemIdStr] = key.split('|');
        const vendorItemId = Number(vendorItemIdStr);
        const { data: curItem } = await supabase.from('daily_sales_items').select('quantity, sale_amount')
          .eq('store_id', storeId).eq('sale_date', saleDate).eq('channel', 'smartstore').eq('vendor_item_id', vendorItemId).maybeSingle();
        if (curItem) {
          await supabase.from('daily_sales_items').update({
            quantity: Math.max(0, Number(curItem.quantity) - refQty),
            sale_amount: Math.max(0, Number(curItem.sale_amount) - refAmt),
          }).eq('store_id', storeId).eq('sale_date', saleDate).eq('channel', 'smartstore').eq('vendor_item_id', vendorItemId);
        }
      }

      // is_refunded 마킹 (전체 초기화 후 반품 건만 true)
      await supabase.from('daily_order_details').update({ is_refunded: false })
        .eq('store_id', storeId).eq('channel', 'smartstore')
        .gte('sale_date', dateFrom).lte('sale_date', dateTo);
      const matchedIds = returnOrderIds.filter(id => orderMap.has(id));
      if (matchedIds.length > 0) {
        await supabase.from('daily_order_details').update({ is_refunded: true })
          .eq('store_id', storeId).eq('channel', 'smartstore').in('order_id', matchedIds);
      }
    }

    return NextResponse.json({
      message: '스마트스토어 매출 데이터 저장 완료',
      days: totalDays,
      returns: returnRecords.length,
    });
  } catch (error: unknown) {
    console.error('스마트스토어 배치 동기화 오류:', error);
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    // 반품 동기화: CLAIM_REQUESTED_DATETIME 기준이므로 구매일보다 늦게 발생
    // → dateTo 이후 60일까지 확장해서 다음달 반품 신청 건도 포함
    const today = new Date().toISOString().slice(0, 10);
    const extendedTo = new Date(dateTo);
    extendedTo.setDate(extendedTo.getDate() + 60);
    const returnDateTo = extendedTo.toISOString().slice(0, 10) < today
      ? extendedTo.toISOString().slice(0, 10)
      : today;
    const returnRecords = await fetchNaverReturns(dateFrom, returnDateTo, creds);

    if (returnRecords.length > 0) {
      const returnOrderIds = returnRecords.map(r => r.productOrderId);

      // DB에 저장된 반품 주문 조회 (날짜 제한 없이 전체 — 구매일≠반품신청일인 경우 대응)
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

      // DB에 없는 반품 주문 삽입 (반품 시점에 이미 RETURNED 상태라 fetchNaverOrders에서 누락된 경우)
      const missingReturns = returnRecords.filter(r => !orderMap.has(r.productOrderId) && r.paymentDate);
      if (missingReturns.length > 0) {
        const insertRows = missingReturns.map(r => ({
          store_id: storeId,
          sale_date: r.paymentDate,
          channel: 'smartstore',
          vendor_item_id: hashId(`${r.productName}|${r.optionName}`),
          order_id: r.productOrderId,
          paid_at: r.paymentDate,
          quantity: r.quantity,
          unit_price: Math.round(r.totalPaymentAmount / r.quantity),
          sale_amount: r.totalPaymentAmount,
          is_refunded: true,
        }));
        const { error: insertErr } = await supabase.from('daily_order_details').upsert(insertRows, { onConflict: 'store_id,sale_date,channel,order_id,vendor_item_id' });
        if (insertErr) console.error('[SS batch] missing return insert error:', insertErr);

        // orderMap에도 추가
        for (const r of missingReturns) {
          const vid = hashId(`${r.productName}|${r.optionName}`);
          orderMap.set(r.productOrderId, { saleDate: r.paymentDate, vendorItemId: vid, quantity: r.quantity, saleAmount: r.totalPaymentAmount });
        }

        // daily_sales에 해당 날짜 smartstore 행이 없으면 생성
        const missingDates = [...new Set(missingReturns.map(r => r.paymentDate))];
        for (const d of missingDates) {
          await supabase.from('daily_sales').upsert({
            store_id: storeId, sale_date: d, channel: 'smartstore',
            total_sale_amount: 0, total_settlement_amount: 0, order_count: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'store_id,sale_date,channel' });
        }
      }

      // ss_refund 뱃지 집계 (구매일 기준)
      const refundBadgeMap = new Map<string, { count: number; amount: number }>();
      const itemAdjustMap = new Map<string, { quantity: number; saleAmount: number }>();

      for (const r of returnRecords) {
        const info = orderMap.get(r.productOrderId);
        if (!info) continue;
        const existing = refundBadgeMap.get(info.saleDate) ?? { count: 0, amount: 0 };
        existing.count += 1;
        existing.amount += info.saleAmount;
        refundBadgeMap.set(info.saleDate, existing);

        const itemKey = `${info.saleDate}|${info.vendorItemId}`;
        const existingItem = itemAdjustMap.get(itemKey) ?? { quantity: 0, saleAmount: 0 };
        existingItem.quantity += info.quantity;
        existingItem.saleAmount += info.saleAmount;
        itemAdjustMap.set(itemKey, existingItem);
      }

      // ss_refund 뱃지 저장 — 영향받는 날짜만 삭제 후 재삽입
      const affectedDates = Array.from(refundBadgeMap.keys());
      if (affectedDates.length > 0) {
        await supabase.from('daily_sales').delete()
          .eq('store_id', storeId).eq('channel', 'ss_refund').in('sale_date', affectedDates);
      }
      const refundRows = Array.from(refundBadgeMap.entries()).map(([date, { count, amount }]) => ({
        store_id: storeId, sale_date: date, channel: 'ss_refund',
        total_sale_amount: amount, total_settlement_amount: 0, order_count: count,
        updated_at: new Date().toISOString(),
      }));
      if (refundRows.length > 0) await supabase.from('daily_sales').insert(refundRows);

      // daily_sales smartstore 매출 차감 (반품 주문이 정상 집계된 날만)
      for (const [saleDate, { amount: refAmount, count: refCount }] of refundBadgeMap) {
        const { data: cur } = await supabase.from('daily_sales').select('total_sale_amount, order_count')
          .eq('store_id', storeId).eq('sale_date', saleDate).eq('channel', 'smartstore').maybeSingle();
        if (cur && Number(cur.total_sale_amount) > 0) {
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

      // is_refunded 마킹 — 동기화 기간 내 초기화 후 전체 반품 건 마킹
      await supabase.from('daily_order_details').update({ is_refunded: false })
        .eq('store_id', storeId).eq('channel', 'smartstore')
        .gte('sale_date', dateFrom).lte('sale_date', dateTo);
      if (returnOrderIds.length > 0) {
        await supabase.from('daily_order_details').update({ is_refunded: true })
          .eq('store_id', storeId).eq('channel', 'smartstore').in('order_id', returnOrderIds);
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

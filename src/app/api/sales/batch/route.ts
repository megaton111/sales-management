import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchAllOrders, fetchRevenueRefunds, fetchReturnRequests, CoupangCredentials } from '@/lib/coupang-api';

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
      .eq('platform', 'coupang')
      .single();

    if (!integration) {
      return NextResponse.json({ error: '쿠팡 연동 정보가 없습니다. 스토어 관리에서 API 키를 등록해주세요.' }, { status: 400 });
    }
    const creds = integration.credentials as CoupangCredentials;

    const { dailyMap, orderDetails } = await fetchAllOrders(dateFrom, dateTo, creds);
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
        unit_profit: profitMap.get(item.vendorItemName) ?? profitMap.get(item.productName) ?? 0,
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

    // 주문 상세 저장 (기존 데이터 삭제 후 재삽입)
    await supabase
      .from('daily_order_details')
      .delete()
      .eq('store_id', storeId)
      .gte('sale_date', dateFrom)
      .lte('sale_date', dateTo);

    if (orderDetails.length > 0) {
      const detailRows = orderDetails.map(d => ({
        store_id: storeId,
        sale_date: d.saleDate,
        channel: d.channel,
        order_id: d.orderId,
        vendor_item_id: d.vendorItemId,
        quantity: d.quantity,
        sale_amount: d.saleAmount,
        paid_at: d.paidAt,
        status: d.status ?? null,
        sales_price: d.salesPrice ?? null,
        order_price: d.orderPrice ?? null,
        discount_price: d.discountPrice ?? null,
        coupon_discount: d.couponDiscount ?? null,
        unit_price: d.unitPrice ?? null,
      }));

      const { error: detailError } = await supabase
        .from('daily_order_details')
        .upsert(detailRows, { onConflict: 'store_id,sale_date,channel,order_id,vendor_item_id' });

      if (detailError) throw detailError;
    }

    // 반품 동기화 (revenue-history + returnRequests API 병합)
    const [revenueRefunds, returnRequests] = await Promise.all([
      fetchRevenueRefunds(dateFrom, dateTo, creds),
      fetchReturnRequests(dateFrom, dateTo, creds),
    ]);

    // orderId 기준으로 중복 제거 병합 (revenue-history 우선)
    const refundMap_byOrderId = new Map<number, { orderId: number; paymentId?: number; receiptId?: number; vendorItemId?: number; shipmentBoxId?: number; date: string; amount: number }>();
    for (const r of revenueRefunds) {
      refundMap_byOrderId.set(r.orderId, { orderId: r.orderId, date: r.date, amount: r.amount });
    }
    for (const r of returnRequests) {
      if (!refundMap_byOrderId.has(r.orderId)) {
        refundMap_byOrderId.set(r.orderId, { orderId: r.orderId, paymentId: r.paymentId, receiptId: r.receiptId, vendorItemId: r.vendorItemId, shipmentBoxId: r.shipmentBoxId, date: r.date, amount: 0 });
      }
    }
    const refundRecords = Array.from(refundMap_byOrderId.values());


    if (refundRecords.length > 0) {
      const refundOrderIds = [...new Set(refundRecords.map(r => r.orderId))];

      // 1차: orderId로 DB 조회
      const { data: byOrderId } = await supabase
        .from('daily_order_details')
        .select('order_id, channel, sale_date, vendor_item_id, quantity, sale_amount')
        .eq('store_id', storeId)
        .in('order_id', refundOrderIds);

      const matchedSet = new Set((byOrderId || []).map(o => Number(o.order_id)));
      const unmatchedIds = refundOrderIds.filter(id => !matchedSet.has(id));

      // 2차: paymentId로 재시도
      const paymentIds = refundRecords
        .filter(r => unmatchedIds.includes(r.orderId) && r.paymentId)
        .map(r => r.paymentId as number);

      let byPaymentId: typeof byOrderId = [];
      if (paymentIds.length > 0) {
        const { data } = await supabase
          .from('daily_order_details')
          .select('order_id, channel, sale_date, vendor_item_id, quantity, sale_amount')
          .eq('store_id', storeId)
          .in('order_id', paymentIds);
        byPaymentId = data || [];
      }

      const paymentMatchedSet = new Set(byPaymentId.map(o => Number(o.order_id)));

      // 3차: vendorItemId 매칭 (returnItems[0].vendorItemId 기준, 반품일 이전 가장 최근 주문 1:1 매핑)
      const stillUnmatched = refundRecords.filter(r =>
        !matchedSet.has(r.orderId) && !(r.paymentId && paymentMatchedSet.has(r.paymentId))
      );
      const vendorItemIds = [...new Set(stillUnmatched.filter(r => r.vendorItemId).map(r => r.vendorItemId as number))];

      let byVendorItemId: typeof byOrderId = [];
      if (vendorItemIds.length > 0) {
        const { data } = await supabase
          .from('daily_order_details')
          .select('order_id, channel, sale_date, vendor_item_id, quantity, sale_amount')
          .eq('store_id', storeId)
          .eq('channel', 'rocket_growth')
          .in('vendor_item_id', vendorItemIds)
          .order('sale_date', { ascending: false });
        byVendorItemId = data || [];
      }

      // 반품 건별 1:1 매핑 (중복 방지, 반품일 이전 가장 최근 주문)
      const usedRgOrderIds = new Set<number>();
      const vendorItemMatchMap = new Map<number, number>(); // returnRecord.orderId → DB order_id
      for (const r of stillUnmatched) {
        if (!r.vendorItemId) continue;
        const candidate = byVendorItemId.find(o =>
          Number(o.vendor_item_id) === r.vendorItemId &&
          o.sale_date <= r.date &&
          !usedRgOrderIds.has(Number(o.order_id))
        );
        if (candidate) {
          usedRgOrderIds.add(Number(candidate.order_id));
          vendorItemMatchMap.set(r.orderId, Number(candidate.order_id));
        }
      }

      const matchedByVendorItem = [...vendorItemMatchMap.values()]
        .map(dbOrderId => byVendorItemId.find(o => Number(o.order_id) === dbOrderId)!)
        .filter(Boolean);

      // 전체 매칭 결과 합산
      const allDetails = [...(byOrderId || []), ...byPaymentId, ...matchedByVendorItem];

      // orderInfoMap: DB의 실제 order_id 기준
      const orderInfoMap = new Map<number, { channel: string; saleDate: string; saleAmount: number }>();
      const itemAdjustMap = new Map<string, { quantity: number; saleAmount: number }>();

      for (const o of allDetails) {
        const dbOrderId = Number(o.order_id);
        const existing = orderInfoMap.get(dbOrderId);
        if (existing) {
          existing.saleAmount += Number(o.sale_amount);
        } else {
          orderInfoMap.set(dbOrderId, { channel: o.channel, saleDate: o.sale_date, saleAmount: Number(o.sale_amount) });
        }
        const itemKey = `${o.sale_date}|${o.channel}|${o.vendor_item_id}`;
        const existingItem = itemAdjustMap.get(itemKey) ?? { quantity: 0, saleAmount: 0 };
        existingItem.quantity += Number(o.quantity);
        existingItem.saleAmount += Number(o.sale_amount);
        itemAdjustMap.set(itemKey, existingItem);
      }

      // refundMap: 반품 뱃지 집계
      const refundMap = new Map<string, { count: number; amount: number }>();

      // 매칭된 반품: 구매일 기준 뱃지
      for (const r of refundRecords) {
        const dbKey = matchedSet.has(r.orderId) ? r.orderId
          : (r.paymentId && paymentMatchedSet.has(r.paymentId)) ? r.paymentId
          : vendorItemMatchMap.has(r.orderId) ? vendorItemMatchMap.get(r.orderId)!
          : null;
        if (dbKey === null) continue;
        const info = orderInfoMap.get(dbKey);
        if (!info) continue;
        const refundChannel = info.channel === 'marketplace' ? 'mp_refund' : 'rg_refund';
        const key = `${info.saleDate}|${refundChannel}`;
        const existing = refundMap.get(key) ?? { count: 0, amount: 0 };
        existing.count += 1;
        existing.amount += info.saleAmount;
        refundMap.set(key, existing);
      }

      // 최종 미매칭 returnRequest 건: 반품일 기준 rg_refund 뱃지 (금액 0)
      for (const r of returnRequests) {
        const isMatched = matchedSet.has(r.orderId)
          || (r.paymentId && paymentMatchedSet.has(r.paymentId))
          || vendorItemMatchMap.has(r.orderId);
        if (isMatched) continue;
        const key = `${r.date}|rg_refund`;
        const existing = refundMap.get(key) ?? { count: 0, amount: 0 };
        existing.count += 1;
        refundMap.set(key, existing);
      }

      // dailyAdjustMap: 일별 매출 차감 집계
      const dailyAdjustMap = new Map<string, { amount: number; count: number }>();
      for (const [, info] of orderInfoMap) {
        const key = `${info.saleDate}|${info.channel}`;
        const existing = dailyAdjustMap.get(key) ?? { amount: 0, count: 0 };
        existing.amount += info.saleAmount;
        existing.count += 1;
        dailyAdjustMap.set(key, existing);
      }

      // 반품 뱃지 저장
      await supabase.from('daily_sales').delete()
        .eq('store_id', storeId).in('channel', ['mp_refund', 'rg_refund'])
        .gte('sale_date', dateFrom).lte('sale_date', dateTo);

      const refundRows = Array.from(refundMap.entries()).map(([key, { count, amount }]) => {
        const [date, channel] = key.split('|');
        return { store_id: storeId, sale_date: date, channel, total_sale_amount: amount, total_settlement_amount: 0, order_count: count, updated_at: new Date().toISOString() };
      });
      if (refundRows.length > 0) await supabase.from('daily_sales').insert(refundRows);

      // daily_sales 매출 차감
      for (const [key, { amount: refAmount, count: refCount }] of dailyAdjustMap) {
        const [saleDate, channel] = key.split('|');
        const { data: cur } = await supabase.from('daily_sales').select('total_sale_amount, order_count')
          .eq('store_id', storeId).eq('sale_date', saleDate).eq('channel', channel).maybeSingle();
        if (cur) {
          await supabase.from('daily_sales').update({
            total_sale_amount: Math.max(0, Number(cur.total_sale_amount) - refAmount),
            order_count: Math.max(0, Number(cur.order_count) - refCount),
          }).eq('store_id', storeId).eq('sale_date', saleDate).eq('channel', channel);
        }
      }

      // daily_sales_items 수량/금액 차감
      for (const [key, { quantity: refQty, saleAmount: refAmount }] of itemAdjustMap) {
        const parts = key.split('|');
        const vendorItemId = Number(parts[2]);
        const { data: curItem } = await supabase.from('daily_sales_items').select('quantity, sale_amount')
          .eq('store_id', storeId).eq('sale_date', parts[0]).eq('channel', parts[1]).eq('vendor_item_id', vendorItemId).maybeSingle();
        if (curItem) {
          await supabase.from('daily_sales_items').update({
            quantity: Math.max(0, Number(curItem.quantity) - refQty),
            sale_amount: Math.max(0, Number(curItem.sale_amount) - refAmount),
          }).eq('store_id', storeId).eq('sale_date', parts[0]).eq('channel', parts[1]).eq('vendor_item_id', vendorItemId);
        }
      }

      // is_refunded 마킹
      const dbOrderIdsToMark = [
        ...refundOrderIds.filter(id => matchedSet.has(id)),
        ...paymentIds.filter(id => byPaymentId.some(o => Number(o.order_id) === id)),
        ...[...vendorItemMatchMap.values()],
      ];
      await supabase.from('daily_order_details').update({ is_refunded: false })
        .eq('store_id', storeId).gte('sale_date', dateFrom).lte('sale_date', dateTo);
      if (dbOrderIdsToMark.length > 0) {
        await supabase.from('daily_order_details').update({ is_refunded: true })
          .eq('store_id', storeId).in('order_id', dbOrderIdsToMark);
      }
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

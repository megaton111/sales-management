import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const year = searchParams.get('year');
  const storeId = searchParams.get('storeId');

  if (!year || !storeId) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  try {
    const supabase = await createClient();

    // 1. 반품된 주문의 vendor_item_id + channel + quantity 조회
    const { data: refunds, error: refErr } = await supabase
      .from('daily_order_details')
      .select('vendor_item_id, channel, quantity')
      .eq('store_id', storeId)
      .eq('is_refunded', true)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    if (refErr) throw refErr;
    if (!refunds || refunds.length === 0) return NextResponse.json({ refunds: [] });

    const vendorItemIds = [...new Set(refunds.map(r => Number(r.vendor_item_id)))];

    // 2. vendor_item_id로 상품명 조회 (중복 제거 — 날짜마다 같은 상품이 여러 번 나올 수 있음)
    const { data: itemNames, error: nameErr } = await supabase
      .from('daily_sales_items')
      .select('vendor_item_id, channel, product_name, vendor_item_name')
      .eq('store_id', storeId)
      .in('vendor_item_id', vendorItemIds);

    if (nameErr) throw nameErr;

    // vendor_item_id + channel → 상품명 매핑, channel 무시 폴백도 함께 저장
    const nameMap = new Map<string, { product_name: string; vendor_item_name: string }>();
    for (const item of itemNames ?? []) {
      const channelKey = `${item.vendor_item_id}|${item.channel}`;
      if (!nameMap.has(channelKey)) nameMap.set(channelKey, { product_name: item.product_name, vendor_item_name: item.vendor_item_name });
      const idKey = String(item.vendor_item_id);
      if (!nameMap.has(idKey)) nameMap.set(idKey, { product_name: item.product_name, vendor_item_name: item.vendor_item_name });
    }

    // 3. 상품별 반품 건수 집계
    const countMap = new Map<string, { name: string; channel: string; count: number }>();
    for (const r of refunds) {
      const names = nameMap.get(`${r.vendor_item_id}|${r.channel}`) ?? nameMap.get(String(r.vendor_item_id));
      if (!names) continue;

      const vin = names.vendor_item_name;
      const pn = names.product_name;
      const displayName = !vin || vin === pn
        ? pn
        : vin.startsWith(pn) ? vin : `${pn} ${vin}`;
      const rankKey = `${r.channel}|${displayName}`;

      const existing = countMap.get(rankKey);
      if (existing) {
        existing.count += Number(r.quantity);
      } else {
        countMap.set(rankKey, { name: displayName, channel: r.channel, count: Number(r.quantity) });
      }
    }

    const result = Array.from(countMap.values()).sort((a, b) => b.count - a.count);
    return NextResponse.json({ refunds: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

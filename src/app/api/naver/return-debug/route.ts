import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { NaverCredentials, getNaverAccessToken } from '@/lib/naver-api';

const BASE_URL = 'https://api.commerce.naver.com/external';

function toNaverDT(dateStr: string, end = false) {
  return `${dateStr}T${end ? '23:59:59.999' : '00:00:00.000'}+09:00`;
}

function getDates(from: string, to: string) {
  const dates: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function naverGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, data: json };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
  const dateTo = searchParams.get('dateTo');     // YYYY-MM-DD
  const rangeType = searchParams.get('rangeType') ?? 'CLAIM_REQUESTED_DATETIME';

  if (!storeId || !dateFrom || !dateTo) {
    return NextResponse.json({ error: 'storeId, dateFrom, dateTo 필요' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: integration } = await supabase
    .from('store_integrations')
    .select('credentials')
    .eq('store_id', storeId)
    .eq('platform', 'smartstore')
    .single();

  if (!integration) return NextResponse.json({ error: '스마트스토어 연동 없음' }, { status: 400 });
  const creds = integration.credentials as NaverCredentials;
  const token = await getNaverAccessToken(creds);

  // 날짜별로 하루씩 조회 (24시간 제한 대응)
  const dates = getDates(dateFrom, dateTo);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allReturns: any[] = [];
  const dayResults: Record<string, { status: number; count: number }> = {};

  for (let i = 0; i < dates.length; i++) {
    if (i > 0) await sleep(500);
    const date = dates[i];
    const res = await naverGet('/v1/pay-order/seller/product-orders', token, {
      from: toNaverDT(date),
      to: toNaverDT(date, true),
      rangeType,
      productOrderStatuses: 'RETURNED',
      pageSize: '20',
      page: '1',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents = (res.data as any)?.data?.contents ?? [];
    dayResults[date] = { status: res.status, count: contents.length };
    allReturns.push(...contents);
  }

  // DB의 SS 주문 조회
  const { data: dbOrders, count } = await supabase
    .from('daily_order_details')
    .select('order_id, sale_date', { count: 'exact' })
    .eq('store_id', storeId)
    .eq('channel', 'smartstore')
    .gte('sale_date', dateFrom)
    .lte('sale_date', dateTo);

  const dbOrderIds = new Set((dbOrders || []).map(o => String(o.order_id)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const returnSamples = allReturns.slice(0, 5).map((item: any) => {
    const po = item.content?.productOrder ?? {};
    const claim = item.content?.currentClaim ?? {};
    const orderId = String(po.productOrderId ?? '');
    return {
      productOrderId: orderId,
      inDB: dbOrderIds.has(orderId),
      productOrderStatus: po.productOrderStatus,
      paymentDate: item.content?.order?.paymentDate?.slice(0, 10),
      claimRequestDate: claim.claimRequestDate?.slice(0, 10),
      totalPaymentAmount: po.totalPaymentAmount,
    };
  });

  return NextResponse.json({
    rangeType,
    dateRange: `${dateFrom} ~ ${dateTo}`,
    totalReturnsFound: allReturns.length,
    dbSSOrderCount: count,
    returnSamples,
    dayResults,
  });
}

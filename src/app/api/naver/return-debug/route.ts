import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { NaverCredentials, getNaverAccessToken } from '@/lib/naver-api';

const BASE_URL = 'https://api.commerce.naver.com/external';

function toNaverDT(dateStr: string, end = false) {
  return `${dateStr}T${end ? '23:59:59.999' : '00:00:00.000'}+09:00`;
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
  const dateTo = searchParams.get('dateTo');     // YYYY-MM-DD

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

  const results: Record<string, unknown> = {};

  // 각 rangeType + RETURNED 조합 테스트
  for (const rangeType of ['PAYED_DATETIME', 'CLAIM_REQUESTED_DATETIME', 'CLAIM_COMPLETED_DATETIME']) {
    const res = await naverGet('/v1/pay-order/seller/product-orders', token, {
      from: toNaverDT(dateFrom),
      to: toNaverDT(dateTo, true),
      rangeType,
      productOrderStatuses: 'RETURNED',
      pageSize: '20',
      page: '1',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents = (res.data as any)?.data?.contents ?? [];
    results[rangeType] = {
      httpStatus: res.status,
      count: contents.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sample: contents.slice(0, 2).map((item: any) => ({
        productOrderId: item.content?.productOrder?.productOrderId,
        productOrderStatus: item.content?.productOrder?.productOrderStatus,
        paymentDate: item.content?.order?.paymentDate,
        claimRequestDate: item.content?.currentClaim?.claimRequestDate,
        claimCompletedDate: item.content?.currentClaim?.claimCompletedDate,
        totalPaymentAmount: item.content?.productOrder?.totalPaymentAmount,
      })),
    };
  }

  // DB에 저장된 SS 주문 건수 확인
  const { count } = await supabase
    .from('daily_order_details')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('channel', 'smartstore')
    .gte('sale_date', dateFrom)
    .lte('sale_date', dateTo);
  results['db_ss_orders_count'] = count;

  return NextResponse.json(results);
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchRgOrders, CoupangCredentials } from '@/lib/coupang-api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const vendorItemId = searchParams.get('vendorItemId');
  const storeId = searchParams.get('storeId');

  if (!date || !vendorItemId || !storeId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  try {
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

    const orders = await fetchRgOrders(date, date, creds);
    const vid = Number(vendorItemId);

    const result: { orderId: number; paidAt: string; quantity: number; unitSalesPrice: number; saleAmount: number }[] = [];

    for (const order of orders) {
      const paidMs = Number(order.paidAt);
      const kstDate = new Date(paidMs + 9 * 60 * 60 * 1000);
      const orderDateStr = kstDate.toISOString().split('T')[0];
      if (orderDateStr !== date) continue;

      const matched = order.orderItems.filter(i => i.vendorItemId === vid);
      if (matched.length === 0) continue;

      const quantity = matched.reduce((sum, i) => sum + i.salesQuantity, 0);
      const unitSalesPrice = Math.floor(Number(matched[0].unitSalesPrice));
      const saleAmount = matched.reduce((sum, i) => sum + Math.floor(Number(i.unitSalesPrice)) * i.salesQuantity, 0);

      result.push({ orderId: order.orderId, paidAt: order.paidAt, quantity, unitSalesPrice, saleAmount });
    }

    result.sort((a, b) => Number(b.paidAt) - Number(a.paidAt));

    return NextResponse.json({ orders: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

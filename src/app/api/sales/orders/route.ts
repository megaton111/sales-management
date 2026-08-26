import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchOrderSheetsByDate, CoupangCredentials } from '@/lib/coupang-api';

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

    const orders = await fetchOrderSheetsByDate(date, creds);
    const vid = Number(vendorItemId);

    const result: {
      orderId: number;
      paidAt: string;
      status: string;
      quantity: number;
      salesPrice: number;
      orderPrice: number;
      discountPrice: number;
      coupangDiscount: number;
      saleAmount: number;
    }[] = [];

    for (const order of orders) {
      const matched = order.orderItems.filter(i => i.vendorItemId === vid && !i.canceled);
      if (matched.length === 0) continue;

      const quantity = matched.reduce((sum, i) => sum + i.shippingCount, 0);
      const salesPrice = matched.reduce((sum, i) => sum + i.salesPrice * i.shippingCount, 0);
      const orderPrice = matched.reduce((sum, i) => sum + i.orderPrice, 0);
      const discountPrice = matched.reduce((sum, i) => sum + i.discountPrice, 0);
      const coupangDiscount = matched.reduce((sum, i) => sum + i.coupangDiscount, 0);
      const saleAmount = orderPrice - coupangDiscount;

      result.push({ orderId: order.orderId, paidAt: order.paidAt, status: order.status, quantity, salesPrice, orderPrice, discountPrice, coupangDiscount, saleAmount });
    }

    result.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

    return NextResponse.json({ orders: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

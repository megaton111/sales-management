import { NextRequest, NextResponse } from 'next/server';
import { fetchRgOrders } from '@/lib/coupang-api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const vendorItemId = searchParams.get('vendorItemId');

  if (!date || !vendorItemId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  try {
    const orders = await fetchRgOrders(date, date);
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

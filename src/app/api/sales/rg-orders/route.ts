import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

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

    const { data, error } = await supabase
      .from('daily_order_details')
      .select('order_id, paid_at, quantity, unit_price, sale_amount')
      .eq('store_id', storeId)
      .eq('sale_date', date)
      .eq('channel', 'rocket_growth')
      .eq('vendor_item_id', vendorItemId);

    if (error) throw error;

    const orders = (data || [])
      .map(r => ({
        orderId: Number(r.order_id),
        paidAt: r.paid_at ?? '',
        quantity: r.quantity,
        unitSalesPrice: r.unit_price ?? 0,
        saleAmount: r.sale_amount,
      }))
      .sort((a, b) => Number(b.paidAt) - Number(a.paidAt));

    return NextResponse.json({ orders });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

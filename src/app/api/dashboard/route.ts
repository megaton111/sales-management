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

    const [salesRes, itemsRes, expensesRes] = await Promise.all([
      supabase
        .from('daily_sales')
        .select('sale_date, channel, total_sale_amount')
        .eq('store_id', storeId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate),
      supabase
        .from('daily_sales_items')
        .select('sale_date, channel, product_name, quantity, unit_profit, sale_amount')
        .eq('store_id', storeId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate),
      supabase
        .from('expenses')
        .select('expense_date, amount')
        .eq('store_id', storeId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate),
    ]);

    if (salesRes.error) throw salesRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (expensesRes.error) throw expensesRes.error;

    return NextResponse.json({
      sales: salesRes.data || [],
      items: itemsRes.data || [],
      expenses: expensesRes.data || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

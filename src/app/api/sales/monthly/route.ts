import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const storeId = searchParams.get('storeId');

  if (!year || !month || !storeId) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  try {
    const supabase = await createClient();

    const [{ data, error }, { data: itemsData, error: itemsError }] = await Promise.all([
      supabase
        .from('daily_sales')
        .select('*')
        .eq('store_id', storeId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: true }),
      supabase
        .from('daily_sales_items')
        .select('sale_date, channel, product_name, quantity')
        .eq('store_id', storeId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate),
    ]);

    if (error) throw error;
    if (itemsError) throw itemsError;

    return NextResponse.json({ data: data || [], items: itemsData || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

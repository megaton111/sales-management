import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get('date');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const storeId = searchParams.get('storeId');
  const channel = searchParams.get('channel');

  if (!storeId) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    let query = supabase
      .from('daily_sales_items')
      .select('*')
      .eq('store_id', storeId);

    if (dateFrom && dateTo) {
      query = query.gte('sale_date', dateFrom).lte('sale_date', dateTo);
    } else if (date) {
      query = query.eq('sale_date', date);
    } else {
      return NextResponse.json({ error: '날짜 파라미터가 누락되었습니다' }, { status: 400 });
    }

    if (channel && channel !== 'all') {
      query = query.eq('channel', channel);
    }

    const { data, error } = await query.order('sale_amount', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

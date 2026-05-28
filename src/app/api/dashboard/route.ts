import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

async function fetchAll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  select: string,
  filters: { storeId: string; dateColumn: string; startDate: string; endDate: string }
) {
  const PAGE_SIZE = 1000;
  let allData: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('store_id', filters.storeId)
      .gte(filters.dateColumn, filters.startDate)
      .lte(filters.dateColumn, filters.endDate)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

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

    const [sales, items, expenses] = await Promise.all([
      fetchAll(supabase, 'daily_sales', 'sale_date, channel, total_sale_amount', {
        storeId, dateColumn: 'sale_date', startDate, endDate,
      }),
      fetchAll(supabase, 'daily_sales_items', 'sale_date, channel, product_name, quantity, unit_profit, sale_amount', {
        storeId, dateColumn: 'sale_date', startDate, endDate,
      }),
      fetchAll(supabase, 'expenses', 'expense_date, amount', {
        storeId, dateColumn: 'expense_date', startDate, endDate,
      }),
    ]);

    return NextResponse.json({ sales, items, expenses });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

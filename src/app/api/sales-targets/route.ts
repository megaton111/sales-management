import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const storeId = searchParams.get('storeId');
  const year = searchParams.get('year');

  if (!storeId || !year) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales_targets')
    .select('month, target_amount')
    .eq('store_id', storeId)
    .eq('year', year);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ targets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { storeId, year, month, targetAmount } = await request.json();

  if (!storeId || !year || !month || targetAmount == null) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('sales_targets')
    .upsert(
      { store_id: storeId, year, month, target_amount: targetAmount, updated_at: new Date().toISOString() },
      { onConflict: 'store_id,year,month' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

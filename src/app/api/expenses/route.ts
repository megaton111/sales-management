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
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('store_id', storeId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { storeId, expenseDate, expenseType, amount, memo } = await request.json();

    if (!storeId || !expenseDate || !expenseType || amount === undefined) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        store_id: storeId,
        expense_date: expenseDate,
        expense_type: expenseType,
        amount,
        memo: memo || '',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('지출 저장 오류:', error);
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : JSON.stringify(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, expenseDate, expenseType, amount, memo } = await request.json();

    if (!id || !expenseDate || !expenseType || amount === undefined) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('expenses')
      .update({
        expense_date: expenseDate,
        expense_type: expenseType,
        amount,
        memo: memo || '',
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id가 누락되었습니다' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

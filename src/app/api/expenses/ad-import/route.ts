import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { storeId, entries } = await request.json() as {
      storeId: number;
      entries: { date: string; amount: number }[];
    };

    if (!storeId || !entries?.length) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
    }

    const dates = entries.map(e => e.date);
    const supabase = await createClient();

    // 해당 날짜의 기존 '쿠팡 광고비' 항목 삭제
    await supabase
      .from('expenses')
      .delete()
      .eq('store_id', storeId)
      .eq('expense_type', '쿠팡 광고비')
      .in('expense_date', dates);

    // 새 항목 일괄 등록
    const { error } = await supabase.from('expenses').insert(
      entries.map(e => ({
        store_id: storeId,
        expense_date: e.date,
        expense_type: '쿠팡 광고비',
        amount: e.amount,
        memo: '쿠팡 광고센터 보고서',
      }))
    );

    if (error) throw error;

    return NextResponse.json({ success: true, count: entries.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

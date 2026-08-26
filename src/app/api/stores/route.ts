import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  if (!storeId) return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from('stores').delete().eq('id', storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

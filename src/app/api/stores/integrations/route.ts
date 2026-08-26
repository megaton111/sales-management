import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  if (!storeId) return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('store_integrations')
    .select('id, platform, is_active, updated_at')
    .eq('store_id', storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req: NextRequest) {
  const { storeId, platform, credentials } = await req.json();
  if (!storeId || !platform || !credentials) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('store_integrations')
    .upsert({
      store_id: storeId,
      platform,
      credentials,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,platform' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  const platform = searchParams.get('platform');
  if (!storeId || !platform) return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from('store_integrations')
    .delete()
    .eq('store_id', storeId)
    .eq('platform', platform);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

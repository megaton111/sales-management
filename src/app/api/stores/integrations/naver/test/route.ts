import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { testNaverConnection, NaverCredentials } from '@/lib/naver-api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  if (!storeId) return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });

  const supabase = await createClient();
  const { data: integration } = await supabase
    .from('store_integrations')
    .select('credentials')
    .eq('store_id', storeId)
    .eq('platform', 'smartstore')
    .single();

  if (!integration) {
    return NextResponse.json({ error: '스마트스토어 연동 정보가 없습니다' }, { status: 400 });
  }

  try {
    const creds = integration.credentials as NaverCredentials;
    const ok = await testNaverConnection(creds);
    return NextResponse.json({ success: ok });
  } catch (error) {
    const message = error instanceof Error ? error.message : '연결 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

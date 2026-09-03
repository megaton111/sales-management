import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST() {
  try {
    const supabase = await createClient();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const { data: integrations } = await supabase
      .from('store_integrations')
      .select('store_id, platform');

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ message: '연동된 스토어 없음', synced: [] });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const results: { storeId: number; platform: string; ok: boolean; error?: string }[] = [];

    for (const integration of integrations) {
      const { store_id, platform } = integration;
      try {
        let url = '';
        if (platform === 'coupang') url = `${baseUrl}/api/sales/batch`;
        else if (platform === 'smartstore') url = `${baseUrl}/api/sales/naver/batch`;
        else continue;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId: store_id, dateFrom: monthStart, dateTo: today }),
        });

        results.push({ storeId: store_id, platform, ok: res.ok, error: res.ok ? undefined : await res.text() });
      } catch (e) {
        results.push({ storeId: store_id, platform, ok: false, error: String(e) });
      }
    }

    return NextResponse.json({ message: '동기화 완료', synced: results });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

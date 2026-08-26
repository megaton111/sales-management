import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchRgInventory, CoupangCredentials } from '@/lib/coupang-api';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');

  if (!storeId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: integration } = await supabase
      .from('store_integrations')
      .select('credentials')
      .eq('store_id', storeId)
      .eq('platform', 'coupang')
      .single();

    if (!integration) {
      return NextResponse.json({ error: '쿠팡 연동 정보가 없습니다. 스토어 관리에서 API 키를 등록해주세요.' }, { status: 400 });
    }
    const creds = integration.credentials as CoupangCredentials;

    const inventoryItems = await fetchRgInventory(creds);

    if (inventoryItems.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const rows = inventoryItems.map(item => ({
      store_id: Number(storeId),
      vendor_item_id: item.vendorItemId,
      stock: item.inventoryDetails?.totalOrderableQuantity ?? 0,
      sales_last_30: item.salesCountMap?.SALES_COUNT_LAST_THIRTY_DAYS ?? 0,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('rg_inventory')
      .upsert(rows, { onConflict: 'store_id,vendor_item_id' });

    if (error) throw error;

    return NextResponse.json({ count: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

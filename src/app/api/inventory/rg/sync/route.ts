import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchRgInventory, fetchSellerProductNames, CoupangCredentials } from '@/lib/coupang-api';

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

    const vendorItemIds = inventoryItems.map(item => item.vendorItemId);
    const { data: salesItems } = await supabase
      .from('daily_sales_items')
      .select('vendor_item_id, product_name, vendor_item_name')
      .eq('store_id', storeId)
      .in('vendor_item_id', vendorItemIds);

    const nameMap = new Map<number, { product_name: string; vendor_item_name: string }>();
    for (const row of salesItems || []) {
      const id = Number(row.vendor_item_id);
      if (!nameMap.has(id) || row.vendor_item_name === row.product_name) {
        nameMap.set(id, { product_name: row.product_name, vendor_item_name: row.vendor_item_name });
      }
    }

    // daily_sales_items에 없는 항목은 판매자 상품 카탈로그 API로 조회
    const unmatchedItems = inventoryItems.filter(item => !nameMap.has(item.vendorItemId));
    console.log(`[재고 sync] 전체=${inventoryItems.length} nameMap=${nameMap.size} 미매칭=${unmatchedItems.length}`, unmatchedItems.map(i => i.vendorItemId));
    const hasUnmatched = unmatchedItems.length > 0;
    if (hasUnmatched) {
      const catalogMap = await fetchSellerProductNames(creds);
      for (const [vendorItemId, names] of catalogMap) {
        if (!nameMap.has(vendorItemId)) {
          nameMap.set(vendorItemId, { product_name: names.productName, vendor_item_name: names.vendorItemName });
        }
      }
    }

    const rows = inventoryItems.map(item => ({
      store_id: Number(storeId),
      vendor_item_id: item.vendorItemId,
      stock: item.inventoryDetails?.totalOrderableQuantity ?? 0,
      sales_last_30: item.salesCountMap?.SALES_COUNT_LAST_THIRTY_DAYS ?? 0,
      updated_at: new Date().toISOString(),
      ...(nameMap.get(item.vendorItemId) ?? {}),
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchRgInventory } from '@/lib/coupang-api';

// 임시 디버그용 — 재고 API ID와 DB ID 비교
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');
  const search = searchParams.get('search') ?? '';

  if (!storeId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  const [inventoryItems, supabase] = await Promise.all([
    fetchRgInventory(),
    createClient(),
  ]);

  const { data: dbItems } = await supabase
    .from('daily_sales_items')
    .select('vendor_item_id, vendor_item_name, product_name, channel')
    .eq('store_id', storeId)
    .ilike('product_name', `%${search}%`);

  const dbIds = new Set((dbItems || []).map(r => Number(r.vendor_item_id)));

  const unmatched = inventoryItems
    .filter(item => !dbIds.has(Number(item.vendorItemId)))
    .slice(0, 30)
    .map(item => ({
      vendorItemId: item.vendorItemId,
      externalSkuId: item.externalSkuId,
      stock: item.inventoryDetails?.totalOrderableQuantity,
      sales30: item.salesCountMap?.SALES_COUNT_LAST_THIRTY_DAYS,
    }));

  const dbMatches = (dbItems || [])
    .filter(r => search)
    .map(r => ({
      vendor_item_id: r.vendor_item_id,
      product_name: r.product_name,
      vendor_item_name: r.vendor_item_name,
      channel: r.channel,
    }));

  return NextResponse.json({
    totalInventoryItems: inventoryItems.length,
    totalDbItems: dbItems?.length ?? 0,
    unmatchedCount: inventoryItems.filter(item => !dbIds.has(Number(item.vendorItemId))).length,
    unmatched_sample: unmatched,
    db_search_results: dbMatches,
  });
}

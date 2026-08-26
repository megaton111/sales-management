import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchRgInventory, CoupangCredentials } from '@/lib/coupang-api';

export async function GET(req: NextRequest) {
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

    const { data: dbItems, error } = await supabase
      .from('daily_sales_items')
      .select('vendor_item_id, vendor_item_name, product_name, channel')
      .eq('store_id', storeId)
      .order('sale_date', { ascending: false })
      .limit(10000);

    if (error) throw error;

    // 같은 vendorItemId가 여러 채널에 있을 때 rocket_growth 우선으로 이름 저장
    const nameMap = new Map<number, { vendorItemName: string; productName: string }>();
    for (const row of dbItems || []) {
      const id = Number(row.vendor_item_id);
      if (!nameMap.has(id) || row.channel === 'rocket_growth') {
        nameMap.set(id, {
          vendorItemName: row.vendor_item_name,
          productName: row.product_name,
        });
      }
    }

    const mapped = inventoryItems.filter(item => nameMap.has(Number(item.vendorItemId)))
      .map(item => {
        const names = nameMap.get(Number(item.vendorItemId))!;
        const salesLast30 = item.salesCountMap?.SALES_COUNT_LAST_THIRTY_DAYS ?? 0;
        const dailyAvg = salesLast30 / 30;
        const stock = item.inventoryDetails?.totalOrderableQuantity ?? 0;
        const daysLeft = dailyAvg > 0 ? Math.round(stock / dailyAvg) : null;

        return {
          vendorItemId: item.vendorItemId,
          productName: names.productName,
          vendorItemName: names.vendorItemName,
          stock,
          salesLast30,
          dailyAvg: Math.round(dailyAvg * 10) / 10,
          daysLeft,
        };
      });

    // 같은 vendorItemName이 두 번 나오는 경우 재고가 더 많은 항목 우선 유지
    const deduped = new Map<string, typeof mapped[0]>();
    for (const item of mapped) {
      const existing = deduped.get(item.vendorItemName);
      if (!existing || item.stock > existing.stock) {
        deduped.set(item.vendorItemName, item);
      }
    }

    const result = Array.from(deduped.values()).sort((a, b) => b.stock - a.stock);

    return NextResponse.json({ data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

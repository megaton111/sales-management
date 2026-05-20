import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get('storeId');

  if (!storeId) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('product_name_mapping')
      .select('*')
      .eq('store_id', storeId);

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { storeId, productSaleName, mappingItems } = await request.json();

    if (!storeId || !productSaleName || !Array.isArray(mappingItems)) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
    }

    const supabase = await createClient();

    const { error: deleteError } = await supabase
      .from('product_name_mapping')
      .delete()
      .eq('store_id', storeId)
      .eq('product_sale_name', productSaleName);

    if (deleteError) throw deleteError;

    if (mappingItems.length > 0) {
      const { error: insertError } = await supabase
        .from('product_name_mapping')
        .insert(
          mappingItems.map((item: { coupangProductName: string }) => ({
            store_id: storeId,
            coupang_product_name: item.coupangProductName,
            product_sale_name: productSaleName,
          }))
        );

      if (insertError) throw insertError;
    }

    return NextResponse.json({ message: '매핑 저장 완료' });
  } catch (error: unknown) {
    console.error('매핑 저장 오류:', error);
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : JSON.stringify(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('product_name_mapping')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: '매핑 삭제 완료' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

-- 배수별 상품 별도 관리 마이그레이션
-- Supabase SQL Editor에서 실행해주세요

-- 1. product_sales에 배수 관리 컬럼 추가
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS base_name text;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS multiplier integer NOT NULL DEFAULT 1;

-- 기존 데이터: 모두 1개 상품이므로 base_name = name
UPDATE product_sales SET base_name = name WHERE base_name IS NULL;

-- 2. product_name_mapping에서 multiplier > 1인 매핑을 배수 상품으로 변환
-- 각 (product_sale_name, multiplier) 조합에 대해 product_sales에 배수 행 생성
INSERT INTO product_sales (name, store_id, base_name, multiplier, category, unit_cost, selling_price, market_commission, warehouse_fee, shipping_fee, barcode_fee, box_fee, other_fee, profit, memo)
SELECT DISTINCT
  ps.name || ' (x' || m.multiplier || ')',
  ps.store_id,
  ps.name,
  m.multiplier,
  ps.category,
  ps.unit_cost * m.multiplier,
  0,
  0,
  0,
  0,
  ps.barcode_fee * m.multiplier,
  ps.box_fee,
  0,
  0,
  ''
FROM product_name_mapping m
JOIN product_sales ps ON ps.name = m.product_sale_name AND ps.store_id = m.store_id
WHERE m.multiplier > 1
ON CONFLICT (name, store_id) DO NOTHING;

-- 3. 매핑의 product_sale_name을 새 배수 상품명으로 업데이트
UPDATE product_name_mapping
SET product_sale_name = product_sale_name || ' (x' || multiplier || ')'
WHERE multiplier > 1;

-- 4. product_name_mapping에서 multiplier 컬럼 제거
ALTER TABLE product_name_mapping DROP COLUMN IF EXISTS multiplier;

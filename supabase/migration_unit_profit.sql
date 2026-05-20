-- 매출 기록 시점 이익금 스냅샷 마이그레이션
-- Supabase SQL Editor에서 실행해주세요

-- daily_sales_items에 unit_profit 컬럼 추가
ALTER TABLE daily_sales_items ADD COLUMN IF NOT EXISTS unit_profit numeric NOT NULL DEFAULT 0;

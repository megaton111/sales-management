-- 평균 원가 변동 이력 테이블 마이그레이션
-- Supabase SQL Editor에서 실행해주세요

CREATE TABLE IF NOT EXISTS product_cost_history (
  id serial primary key,
  name text not null,
  store_id integer not null references stores(id),
  average_unit_cost numeric not null,
  created_at timestamptz default now()
);

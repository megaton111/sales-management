-- 스토어 단위 관리 마이그레이션
-- Supabase SQL Editor에서 실행해주세요

-- 1. stores 테이블 생성
create table if not exists stores (
  id serial primary key,
  name text not null unique,
  created_at timestamptz default now()
);

-- 2. 기본 스토어 "스토어1" 생성
insert into stores (name) values ('스토어1') on conflict do nothing;

-- 3. products 테이블에 store_id 추가
alter table products add column if not exists store_id integer references stores(id);
update products set store_id = 1 where store_id is null;
alter table products alter column store_id set not null;

-- 4. product_averages 테이블 변경
-- PK를 name → (name, store_id) 복합키로 변경
alter table product_averages add column if not exists store_id integer references stores(id);
update product_averages set store_id = 1 where store_id is null;
alter table product_averages alter column store_id set not null;
alter table product_averages drop constraint product_averages_pkey;
alter table product_averages add primary key (name, store_id);

-- 5. product_sales 테이블 변경
-- store 텍스트 컬럼 제거, store_id FK로 교체
-- PK를 name → (name, store_id) 복합키로 변경
alter table product_sales add column if not exists store_id integer references stores(id);
update product_sales set store_id = 1 where store_id is null;
alter table product_sales alter column store_id set not null;
alter table product_sales drop constraint product_sales_pkey;
alter table product_sales add primary key (name, store_id);
alter table product_sales drop column if exists store;

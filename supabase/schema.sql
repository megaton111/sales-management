-- 스토어 테이블
create table if not exists stores (
  id serial primary key,
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists products (
  id text primary key,
  store_id integer not null references stores(id),
  name text not null,
  country text not null check (country in ('US', 'CN')),
  exchange_rate numeric not null,
  quantity integer not null,
  unit_price_foreign numeric not null,
  unit_price_krw numeric not null,
  total_product_price numeric not null,
  purchase_fee_foreign numeric not null default 0,
  purchase_fee numeric not null default 0,
  local_shipping_foreign numeric not null default 0,
  local_shipping numeric not null default 0,
  first_payment numeric not null,
  first_payment_date date,
  inspection_fee numeric not null default 0,
  customs_clearance_fee numeric not null default 0,
  second_payment numeric not null,
  second_payment_date date,
  international_shipping numeric not null default 0,
  origin_certificate_fee numeric not null default 0,
  customs_duty numeric not null default 0,
  vat numeric not null default 0,
  customs_broker_fee numeric not null default 0,
  domestic_shipping numeric not null default 0,
  third_payment numeric not null,
  third_payment_date date,
  total_cost numeric not null,
  unit_cost numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists product_averages (
  name text not null,
  store_id integer not null references stores(id),
  average_unit_cost numeric not null default 0,
  updated_at timestamptz default now(),
  primary key (name, store_id)
);

create table if not exists product_sales (
  name text not null,
  store_id integer not null references stores(id),
  category text default '',
  selling_price numeric not null default 0,
  market_commission numeric not null default 0,
  unit_cost numeric not null default 0,
  warehouse_fee numeric not null default 0,
  shipping_fee numeric not null default 0,
  barcode_fee numeric not null default 150,
  box_fee numeric not null default 100,
  profit numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (name, store_id)
);

-- 쿠팡 상품명 ↔ 상품관리 상품명 매핑
create table if not exists product_name_mapping (
  id serial primary key,
  store_id integer not null references stores(id),
  coupang_product_name text not null,
  product_sale_name text not null,
  multiplier integer not null default 1,
  created_at timestamptz default now(),
  unique (store_id, coupang_product_name)
);

-- 일별 매출 요약 (채널별)
create table if not exists daily_sales (
  id serial primary key,
  store_id integer not null references stores(id),
  sale_date date not null,
  channel text not null default 'marketplace',
  total_sale_amount numeric not null default 0,
  total_settlement_amount numeric not null default 0,
  order_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (store_id, sale_date, channel)
);

-- 일별 매출 상품별 상세
create table if not exists daily_sales_items (
  id serial primary key,
  store_id integer not null references stores(id),
  sale_date date not null,
  channel text not null default 'marketplace',
  vendor_item_id bigint not null,
  product_name text not null,
  vendor_item_name text not null,
  quantity integer not null default 0,
  sale_amount numeric not null default 0,
  settlement_amount numeric not null default 0,
  sale_type text not null default 'SALE',
  created_at timestamptz default now(),
  unique (store_id, sale_date, channel, vendor_item_id, sale_type)
);

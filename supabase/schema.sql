create table if not exists products (
  id text primary key,
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
  name text primary key,
  average_unit_cost numeric not null default 0,
  updated_at timestamptz default now()
);

create table if not exists product_sales (
  name text primary key,
  store text default '',
  category text default '',
  selling_price numeric not null default 0,
  market_commission numeric not null default 0,
  unit_cost numeric not null default 0,
  warehouse_fee numeric not null default 0,
  shipping_fee numeric not null default 0,
  profit numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- schema_v2.sql
-- Run this in your Supabase SQL Editor to create the new tables.

create table if not exists public.expenses (
  id text primary key,
  shop_id text not null,
  amount numeric not null default 0,
  description text,
  date timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  sync_status text,
  last_modified_device_id text
);

create table if not exists public.purchases (
  id text primary key,
  shop_id text not null,
  category text,
  amount numeric not null default 0,
  description text,
  date timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  sync_status text,
  last_modified_device_id text
);

create table if not exists public.worker_sessions (
  id text primary key,
  shop_id text not null,
  worker_name text,
  sign_in_at timestamp with time zone,
  sign_out_at timestamp with time zone,
  status text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  sync_status text,
  last_modified_device_id text
);

create table if not exists public.customers (
  id text primary key,
  shop_id text not null,
  name text,
  phone text,
  address text,
  first_order_at timestamp with time zone,
  last_order_at timestamp with time zone,
  total_orders integer default 0,
  total_spent numeric default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  sync_status text,
  last_modified_device_id text
);

create table if not exists public.bank_transactions (
  id text primary key,
  shop_id text not null,
  type text,
  amount numeric not null default 0,
  reference text,
  date timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  sync_status text,
  last_modified_device_id text
);

create table if not exists public.reconciliations (
  id text primary key,
  shop_id text not null,
  expected numeric,
  actual numeric,
  difference numeric,
  notes text,
  date timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  sync_status text,
  last_modified_device_id text
);

-- Note: We are keeping pos_state for pure settings/menus/shift status, 
-- and orders will continue using the existing public.orders table.
-- We are keeping historical orders inside the orders table by simply setting done=true.

create extension if not exists pgcrypto;

create table if not exists public.pos_state (
  id text primary key,
  shop_id text not null,
  state jsonb not null default '{}'::jsonb,
  writer_id text,
  write_seq bigint not null default 0,
  client_time bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  order_no integer,
  day_id text,
  shift_started_at timestamptz,
  shift_ended_at timestamptz,
  device_id text,
  worker text,
  payment text,
  payment_parts jsonb default '[]'::jsonb,
  order_type text,
  delivery_fee numeric default 0,
  delivery_name text,
  delivery_phone text,
  delivery_email text,
  delivery_address text,
  delivery_zone_id text,
  delivery_zone_name text,
  notify_via_whatsapp boolean default false,
  whatsapp_sent_at timestamptz,
  total numeric default 0,
  items_total numeric default 0,
  discount_percentage numeric default 0,
  discount_amount numeric default 0,
  cash_received numeric,
  change_due numeric,
  done boolean default false,
  voided boolean default false,
  void_reason text,
  note text,
  date timestamptz,
  restocked_at timestamptz,
  cart jsonb default '[]'::jsonb,
  idem_key text,
  source text,
  online_order_id text,
  online_order_key text,
  online_source_collection text,
  online_source_doc_id text,
  channel text,
  channel_order_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.counters (
  shop_id text primary key,
  last_order_no integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  device_id text primary key,
  shop_id text not null,
  label text,
  mode text not null default 'pending'
    check (mode in ('pending', 'listen', 'write', 'read_write', 'admin', 'blocked')),
  os text,
  browser text,
  platform text,
  last_ip text,
  user_agent text,
  approved_by text,
  blocked_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pos_state_shop_id on public.pos_state (shop_id);
create index if not exists idx_orders_shop_id on public.orders (shop_id);
create index if not exists idx_orders_order_no on public.orders (order_no);
create index if not exists idx_orders_shop_day_id on public.orders (shop_id, day_id);
create index if not exists idx_orders_shop_day_date on public.orders (shop_id, day_id, date desc);
create index if not exists idx_orders_device_id on public.orders (device_id);
create index if not exists idx_orders_created_at on public.orders (created_at);
create index if not exists idx_orders_date on public.orders (date);
create index if not exists idx_orders_done on public.orders (done);
create index if not exists idx_orders_voided on public.orders (voided);
create index if not exists idx_orders_online_order_id on public.orders (online_order_id);
create index if not exists idx_orders_idem_key on public.orders (idem_key);
create index if not exists idx_devices_shop_id on public.devices (shop_id);
create index if not exists idx_devices_mode on public.devices (mode);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pos_state_touch_updated_at on public.pos_state;
create trigger trg_pos_state_touch_updated_at
before update on public.pos_state
for each row execute function public.touch_updated_at();

drop trigger if exists trg_orders_touch_updated_at on public.orders;
create trigger trg_orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

drop trigger if exists trg_counters_touch_updated_at on public.counters;
create trigger trg_counters_touch_updated_at
before update on public.counters
for each row execute function public.touch_updated_at();

drop trigger if exists trg_devices_touch_updated_at on public.devices;
create trigger trg_devices_touch_updated_at
before update on public.devices
for each row execute function public.touch_updated_at();

create or replace function public.allocate_order_no(p_shop_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  insert into public.counters (shop_id, last_order_no, updated_at)
  values (p_shop_id, 0, now())
  on conflict (shop_id) do nothing;

  update public.counters
  set last_order_no = last_order_no + 1,
      updated_at = now()
  where shop_id = p_shop_id
  returning last_order_no into v_next;

  return v_next;
end;
$$;

create or replace function public.reset_order_counter(p_shop_id text, p_last_order_no integer default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.counters (shop_id, last_order_no, updated_at)
  values (p_shop_id, greatest(0, coalesce(p_last_order_no, 0)), now())
  on conflict (shop_id)
  do update set
    last_order_no = excluded.last_order_no,
    updated_at = now();

  return greatest(0, coalesce(p_last_order_no, 0));
end;
$$;

alter table public.pos_state replica identity full;
alter table public.orders replica identity full;
alter table public.counters replica identity full;
alter table public.devices replica identity full;

create extension if not exists pgcrypto;

create table if not exists public.pos_state (
  id text primary key,
  shop_id text not null,
  state jsonb not null default '{}'::jsonb,
  writer_id text,
  last_modified_device_id text,
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
  last_modified_device_id text,
  sync_status text default 'pending',
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
  id text primary key,
  device_id text,
  shop_id text not null,
  label text,
  app_surface text,
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
  last_sync_at timestamptz,
  pending_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pos_state add column if not exists last_modified_device_id text;
alter table public.orders add column if not exists last_modified_device_id text;
alter table public.orders add column if not exists sync_status text default 'pending';
alter table public.orders add column if not exists day_id text;
alter table public.orders add column if not exists shift_started_at timestamptz;
alter table public.orders add column if not exists shift_ended_at timestamptz;
alter table public.orders add column if not exists device_id text;
alter table public.devices add column if not exists id text;
alter table public.devices add column if not exists device_id text;
alter table public.devices add column if not exists mode text default 'pending';
alter table public.devices add column if not exists os text;
alter table public.devices add column if not exists browser text;
alter table public.devices add column if not exists platform text;
alter table public.devices add column if not exists last_ip text;
alter table public.devices add column if not exists user_agent text;
alter table public.devices add column if not exists approved_by text;
alter table public.devices add column if not exists blocked_at timestamptz;
alter table public.devices add column if not exists first_seen_at timestamptz default now();
alter table public.devices add column if not exists last_sync_at timestamptz;
alter table public.devices add column if not exists pending_count integer default 0;

update public.devices
set device_id = coalesce(nullif(device_id, ''), id)
where nullif(device_id, '') is null;

update public.devices
set id = coalesce(nullif(id, ''), device_id)
where nullif(id, '') is null;

create index if not exists idx_pos_state_shop_id on public.pos_state (shop_id);
create index if not exists idx_orders_shop_id on public.orders (shop_id);
create index if not exists idx_orders_order_no on public.orders (order_no);
create index if not exists idx_orders_shop_order_no on public.orders (shop_id, order_no);
create index if not exists idx_orders_shop_created_at on public.orders (shop_id, created_at desc);
create index if not exists idx_orders_shop_date on public.orders (shop_id, date);
create index if not exists idx_orders_shop_day_id on public.orders (shop_id, day_id);
create index if not exists idx_orders_shop_day_date on public.orders (shop_id, day_id, date desc);
create index if not exists idx_orders_device_id on public.orders (device_id);
create index if not exists idx_orders_created_at on public.orders (created_at);
create index if not exists idx_orders_date on public.orders (date);
create index if not exists idx_orders_done on public.orders (done);
create index if not exists idx_orders_voided on public.orders (voided);
create index if not exists idx_orders_online_order_id on public.orders (online_order_id);
create index if not exists idx_orders_idem_key on public.orders (idem_key);
create index if not exists idx_orders_shop_idem_key on public.orders (shop_id, idem_key);
create index if not exists idx_devices_shop_id on public.devices (shop_id);
create unique index if not exists idx_devices_device_id_unique on public.devices (device_id);
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

alter table public.pos_state enable row level security;
alter table public.orders enable row level security;
alter table public.counters enable row level security;
alter table public.devices enable row level security;

drop policy if exists "anon can select pos_state" on public.pos_state;
create policy "anon can select pos_state" on public.pos_state for select to anon using (true);
drop policy if exists "anon can insert pos_state" on public.pos_state;
create policy "anon can insert pos_state" on public.pos_state for insert to anon with check (true);
drop policy if exists "anon can update pos_state" on public.pos_state;
create policy "anon can update pos_state" on public.pos_state for update to anon using (true) with check (true);
drop policy if exists "anon can delete pos_state" on public.pos_state;
create policy "anon can delete pos_state" on public.pos_state for delete to anon using (true);

drop policy if exists "anon can select orders" on public.orders;
create policy "anon can select orders" on public.orders for select to anon using (true);
drop policy if exists "anon can insert orders" on public.orders;
create policy "anon can insert orders" on public.orders for insert to anon with check (true);
drop policy if exists "anon can update orders" on public.orders;
create policy "anon can update orders" on public.orders for update to anon using (true) with check (true);
drop policy if exists "anon can delete orders" on public.orders;
create policy "anon can delete orders" on public.orders for delete to anon using (true);

drop policy if exists "anon can select counters" on public.counters;
create policy "anon can select counters" on public.counters for select to anon using (true);
drop policy if exists "anon can insert counters" on public.counters;
create policy "anon can insert counters" on public.counters for insert to anon with check (true);
drop policy if exists "anon can update counters" on public.counters;
create policy "anon can update counters" on public.counters for update to anon using (true) with check (true);
drop policy if exists "anon can delete counters" on public.counters;
create policy "anon can delete counters" on public.counters for delete to anon using (true);

drop policy if exists "anon can select devices" on public.devices;
create policy "anon can select devices" on public.devices for select to anon using (true);
drop policy if exists "anon can insert devices" on public.devices;
create policy "anon can insert devices" on public.devices for insert to anon with check (true);
drop policy if exists "anon can update devices" on public.devices;
create policy "anon can update devices" on public.devices for update to anon using (true) with check (true);
drop policy if exists "anon can delete devices" on public.devices;
create policy "anon can delete devices" on public.devices for delete to anon using (true);

grant usage on schema public to anon;
grant select, insert, update, delete on public.pos_state to anon;
grant select, insert, update, delete on public.orders to anon;
grant select, insert, update, delete on public.counters to anon;
grant select, insert, update, delete on public.devices to anon;
grant execute on function public.allocate_order_no(text) to anon;
grant execute on function public.reset_order_counter(text, integer) to anon;

do $$
begin
  begin
    alter publication supabase_realtime add table public.pos_state;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.orders;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.counters;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.devices;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

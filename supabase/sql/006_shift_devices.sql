alter table public.orders
  add column if not exists day_id text,
  add column if not exists shift_started_at timestamptz,
  add column if not exists shift_ended_at timestamptz,
  add column if not exists device_id text;

create index if not exists idx_orders_shop_day_id
on public.orders (shop_id, day_id);

create index if not exists idx_orders_shop_day_date
on public.orders (shop_id, day_id, date desc);

create index if not exists idx_orders_device_id
on public.orders (device_id);

update public.orders
set day_id = 'legacy_' || to_char(coalesce(date, created_at) at time zone 'UTC', 'YYYY-MM-DD')
where nullif(day_id, '') is null;

update public.orders
set shift_started_at = date_trunc('day', coalesce(date, created_at))
where shift_started_at is null;

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

create index if not exists idx_devices_shop_id
on public.devices (shop_id);

create index if not exists idx_devices_mode
on public.devices (mode);

drop trigger if exists trg_devices_touch_updated_at on public.devices;
create trigger trg_devices_touch_updated_at
before update on public.devices
for each row execute function public.touch_updated_at();

alter table public.devices replica identity full;
alter table public.devices enable row level security;

drop policy if exists "anon can select devices" on public.devices;
create policy "anon can select devices"
on public.devices for select
to anon
using (true);

drop policy if exists "anon can insert devices" on public.devices;
create policy "anon can insert devices"
on public.devices for insert
to anon
with check (true);

drop policy if exists "anon can update devices" on public.devices;
create policy "anon can update devices"
on public.devices for update
to anon
using (true)
with check (true);

grant select, insert, update on public.devices to anon;

do $$
begin
  begin
    alter publication supabase_realtime add table public.devices;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

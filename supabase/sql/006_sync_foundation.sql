-- Lightweight sync foundation for local Electron and online web usage.
-- This keeps the existing app shape, but gives retries and device tracking
-- stable database fields.

alter table public.orders add column if not exists last_modified_device_id text;
alter table public.orders add column if not exists sync_status text default 'pending';
alter table public.orders add column if not exists day_id text;
alter table public.orders add column if not exists shift_started_at timestamptz;
alter table public.orders add column if not exists shift_ended_at timestamptz;
alter table public.orders add column if not exists device_id text;

create unique index if not exists idx_orders_shop_idem_key_unique
on public.orders (shop_id, idem_key)
where idem_key is not null and idem_key <> '';

create index if not exists idx_orders_shop_updated_at
on public.orders (shop_id, updated_at desc);

create index if not exists idx_orders_shop_day_id
on public.orders (shop_id, day_id);

create index if not exists idx_orders_shop_day_date
on public.orders (shop_id, day_id, date desc);

create index if not exists idx_orders_device_id
on public.orders (device_id);

with active_shift as (
  select
    shop_id,
    coalesce(
      nullif(state #>> '{dayMeta,dayId}', ''),
      'day_' || floor(extract(epoch from ((state #>> '{dayMeta,startedAt}')::timestamptz)) * 1000)::text
    ) as day_id,
    (state #>> '{dayMeta,startedAt}')::timestamptz as started_at,
    nullif(state #>> '{dayMeta,endedAt}', '')::timestamptz as ended_at
  from public.pos_state
  where nullif(state #>> '{dayMeta,startedAt}', '') is not null
)
update public.orders as o
set day_id = active_shift.day_id,
    shift_started_at = active_shift.started_at,
    shift_ended_at = active_shift.ended_at
from active_shift
where o.shop_id = active_shift.shop_id
  and nullif(o.day_id, '') is null
  and coalesce(o.date, o.created_at) >= active_shift.started_at
  and (
    active_shift.ended_at is null
    or coalesce(o.date, o.created_at) <= active_shift.ended_at
  );

update public.orders
set day_id = 'legacy_' || to_char(coalesce(date, created_at) at time zone 'UTC', 'YYYY-MM-DD')
where nullif(day_id, '') is null;

update public.orders
set shift_started_at = date_trunc('day', coalesce(date, created_at))
where shift_started_at is null;

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

alter table public.devices add column if not exists id text;
alter table public.devices add column if not exists device_id text;
alter table public.devices add column if not exists label text;
alter table public.devices add column if not exists app_surface text;
alter table public.devices add column if not exists mode text default 'pending';
alter table public.devices add column if not exists os text;
alter table public.devices add column if not exists browser text;
alter table public.devices add column if not exists platform text;
alter table public.devices add column if not exists last_ip text;
alter table public.devices add column if not exists user_agent text;
alter table public.devices add column if not exists approved_by text;
alter table public.devices add column if not exists blocked_at timestamptz;
alter table public.devices add column if not exists first_seen_at timestamptz default now();
alter table public.devices add column if not exists last_seen_at timestamptz default now();
alter table public.devices add column if not exists last_sync_at timestamptz;
alter table public.devices add column if not exists pending_count integer default 0;

update public.devices
set device_id = coalesce(nullif(device_id, ''), id)
where nullif(device_id, '') is null;

update public.devices
set id = coalesce(nullif(id, ''), device_id)
where nullif(id, '') is null;

update public.devices
set first_seen_at = coalesce(first_seen_at, created_at, last_seen_at, now()),
    last_seen_at = coalesce(last_seen_at, updated_at, now()),
    pending_count = coalesce(pending_count, 0),
    mode = coalesce(nullif(mode, ''), 'pending');

create index if not exists idx_devices_shop_id on public.devices (shop_id);
create unique index if not exists idx_devices_device_id_unique on public.devices (device_id);
create index if not exists idx_devices_mode on public.devices (mode);

drop trigger if exists trg_devices_touch_updated_at on public.devices;
create trigger trg_devices_touch_updated_at
before update on public.devices
for each row execute function public.touch_updated_at();

alter table public.devices replica identity full;
alter table public.devices enable row level security;

drop policy if exists "anon can select devices" on public.devices;
create policy "anon can select devices" on public.devices for select to anon using (true);
drop policy if exists "anon can insert devices" on public.devices;
create policy "anon can insert devices" on public.devices for insert to anon with check (true);
drop policy if exists "anon can update devices" on public.devices;
create policy "anon can update devices" on public.devices for update to anon using (true) with check (true);
drop policy if exists "anon can delete devices" on public.devices;
create policy "anon can delete devices" on public.devices for delete to anon using (true);

grant select, insert, update, delete on public.devices to anon;

do $$
begin
  begin
    alter publication supabase_realtime add table public.devices;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

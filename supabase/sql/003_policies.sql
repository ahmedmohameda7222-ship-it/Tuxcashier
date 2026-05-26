alter table public.pos_state enable row level security;
alter table public.orders enable row level security;
alter table public.counters enable row level security;

drop policy if exists "anon can select pos_state" on public.pos_state;
create policy "anon can select pos_state"
on public.pos_state for select
to anon
using (true);

drop policy if exists "anon can insert pos_state" on public.pos_state;
create policy "anon can insert pos_state"
on public.pos_state for insert
to anon
with check (true);

drop policy if exists "anon can update pos_state" on public.pos_state;
create policy "anon can update pos_state"
on public.pos_state for update
to anon
using (true)
with check (true);

drop policy if exists "anon can delete pos_state" on public.pos_state;
create policy "anon can delete pos_state"
on public.pos_state for delete
to anon
using (true);

drop policy if exists "anon can select orders" on public.orders;
create policy "anon can select orders"
on public.orders for select
to anon
using (true);

drop policy if exists "anon can insert orders" on public.orders;
create policy "anon can insert orders"
on public.orders for insert
to anon
with check (true);

drop policy if exists "anon can update orders" on public.orders;
create policy "anon can update orders"
on public.orders for update
to anon
using (true)
with check (true);

drop policy if exists "anon can delete orders" on public.orders;
create policy "anon can delete orders"
on public.orders for delete
to anon
using (true);

drop policy if exists "anon can select counters" on public.counters;
create policy "anon can select counters"
on public.counters for select
to anon
using (true);

drop policy if exists "anon can insert counters" on public.counters;
create policy "anon can insert counters"
on public.counters for insert
to anon
with check (true);

drop policy if exists "anon can update counters" on public.counters;
create policy "anon can update counters"
on public.counters for update
to anon
using (true)
with check (true);

drop policy if exists "anon can delete counters" on public.counters;
create policy "anon can delete counters"
on public.counters for delete
to anon
using (true);

grant usage on schema public to anon;
grant select, insert, update, delete on public.pos_state to anon;
grant select, insert, update, delete on public.orders to anon;
grant select, insert, update, delete on public.counters to anon;
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
end $$;

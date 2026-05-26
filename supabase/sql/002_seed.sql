insert into public.pos_state (id, shop_id, state)
values ('pos', 'tux', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.counters (shop_id, last_order_no)
values ('tux', 0)
on conflict (shop_id) do nothing;

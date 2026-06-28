alter table public.orders
add column if not exists order_key text;

create unique index if not exists idx_orders_shop_order_key_unique
on public.orders (shop_id, order_key)
where order_key is not null and order_key <> '';

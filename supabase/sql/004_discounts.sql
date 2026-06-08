alter table public.orders
  add column if not exists discount_percentage numeric default 0,
  add column if not exists discount_amount numeric default 0;

update public.orders
set
  discount_percentage = coalesce(discount_percentage, 0),
  discount_amount = coalesce(discount_amount, 0);

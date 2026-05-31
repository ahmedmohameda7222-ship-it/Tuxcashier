alter table public.orders
  add column if not exists discount_fee_percentage numeric default 0,
  add column if not exists discount_fee_amount numeric default 0,
  add column if not exists discount_fee_type text default 'discount';

update public.orders
set
  discount_fee_percentage = coalesce(discount_fee_percentage, 0),
  discount_fee_amount = coalesce(discount_fee_amount, 0),
  discount_fee_type = coalesce(nullif(discount_fee_type, ''), 'discount');

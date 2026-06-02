-- Beverages and combo metadata live in the existing JSON state/order payloads.
-- This keeps existing orders intact while giving older pos_state rows safe defaults.

update public.pos_state
set state = jsonb_set(
  jsonb_set(
    coalesce(state, '{}'::jsonb),
    '{beverages}',
    coalesce(state->'beverages', '[]'::jsonb),
    true
  ),
  '{menu}',
  coalesce(
    (
      select jsonb_agg(
        case
          when item ? 'isCombo' then item
          else item || jsonb_build_object('isCombo', false)
        end
      )
      from jsonb_array_elements(coalesce(state->'menu', '[]'::jsonb)) as item
    ),
    coalesce(state->'menu', '[]'::jsonb)
  ),
  true
)
where not (coalesce(state, '{}'::jsonb) ? 'beverages')
   or exists (
     select 1
     from jsonb_array_elements(coalesce(state->'menu', '[]'::jsonb)) as item
     where not (item ? 'isCombo')
   );

-- Migration: simplify device modes to listen / read_write / admin
-- Run this in the Supabase SQL editor after the existing migrations.

-- Normalize old/invalid modes to listen
update public.devices
set mode = 'listen'
where mode is null
   or mode = ''
   or mode in ('pending', 'write', 'blocked');

-- Change default to listen
alter table public.devices
alter column mode set default 'listen';

-- Drop old check constraint and add new one
alter table public.devices
drop constraint if exists devices_mode_check;

alter table public.devices
add constraint devices_mode_check
check (mode in ('listen', 'read_write', 'admin'));

-- Add write-ready tracking columns
alter table public.devices add column if not exists write_ready_at timestamptz;
alter table public.devices add column if not exists local_reset_at timestamptz;

-- Also update the add-column migration section for fresh installs
alter table public.devices add column if not exists mode text default 'listen';

-- If the old check constraint was added via add column, it won't have a name;
-- the above drop/add handles the named constraint. For unnamed constraints,
-- fresh installs should use the updated 001_schema.sql which creates the table
-- with the correct check from the start.

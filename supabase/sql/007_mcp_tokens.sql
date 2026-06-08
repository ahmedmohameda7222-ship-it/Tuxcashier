-- ChatGPT MCP connection tokens and audit logs.
-- Run this in Supabase SQL editor after the existing 001-006 migrations.

create extension if not exists pgcrypto;

create table if not exists public.mcp_connection_tokens (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  token_hash text not null,
  token_prefix text not null,
  name text,
  scopes jsonb not null default '["read"]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by text,
  note text
);

create table if not exists public.mcp_audit_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  token_id uuid references public.mcp_connection_tokens(id) on delete set null,
  tool_name text not null,
  action_type text not null,
  input_summary jsonb,
  success boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_mcp_connection_tokens_token_hash
on public.mcp_connection_tokens (token_hash);

create index if not exists idx_mcp_connection_tokens_shop_id
on public.mcp_connection_tokens (shop_id);

create index if not exists idx_mcp_connection_tokens_shop_active
on public.mcp_connection_tokens (shop_id, active);

create index if not exists idx_mcp_connection_tokens_created_at
on public.mcp_connection_tokens (created_at desc);

create index if not exists idx_mcp_audit_logs_shop_id
on public.mcp_audit_logs (shop_id);

create index if not exists idx_mcp_audit_logs_token_id
on public.mcp_audit_logs (token_id);

create index if not exists idx_mcp_audit_logs_tool_name
on public.mcp_audit_logs (tool_name);

create index if not exists idx_mcp_audit_logs_created_at
on public.mcp_audit_logs (created_at desc);

alter table public.mcp_connection_tokens enable row level security;
alter table public.mcp_audit_logs enable row level security;

revoke all on public.mcp_connection_tokens from anon, authenticated;
revoke all on public.mcp_audit_logs from anon, authenticated;

drop policy if exists "service role can manage mcp tokens" on public.mcp_connection_tokens;
create policy "service role can manage mcp tokens"
on public.mcp_connection_tokens
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role can manage mcp audit logs" on public.mcp_audit_logs;
create policy "service role can manage mcp audit logs"
on public.mcp_audit_logs
for all
to service_role
using (true)
with check (true);

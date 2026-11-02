alter table public.subscriptions add column if not exists payment_url text;
create table if not exists public.asaas_webhook_events (
  id text primary key,
  event text not null,
  processed_at timestamptz not null default now()
);
alter table public.asaas_webhook_events enable row level security;
revoke all on public.asaas_webhook_events from public, anon, authenticated;

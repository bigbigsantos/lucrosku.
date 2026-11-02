alter table public.subscriptions add column if not exists kiwify_order_id text;
alter table public.subscriptions add column if not exists kiwify_subscription_id text;
create index if not exists subscriptions_kiwify_subscription_idx on public.subscriptions(kiwify_subscription_id) where kiwify_subscription_id is not null;
create table if not exists public.kiwify_webhook_events (
  id text primary key,
  event text not null,
  order_id text not null,
  processed_at timestamptz not null default now()
);
alter table public.kiwify_webhook_events enable row level security;
revoke all on public.kiwify_webhook_events from public, anon, authenticated;

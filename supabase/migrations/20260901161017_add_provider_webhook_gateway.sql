create table public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.affiliate_providers(id) on delete restrict,
  provider_key text not null,
  provider_event_id text not null,
  event_type text not null,
  request_id uuid not null,
  signature_valid boolean not null default false,
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'processing', 'processed', 'failed', 'held')),
  payload_sha256 text not null check (char_length(payload_sha256) = 64),
  payload_bytes integer not null check (payload_bytes >= 0 and payload_bytes <= 524288),
  source_ip inet,
  error_code text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider_id, provider_event_id)
);

create table public.provider_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  provider_id uuid references public.affiliate_providers(id) on delete set null,
  provider_key text not null,
  provider_event_id text,
  event_type text not null,
  signature_valid boolean not null default false,
  outcome text not null check (outcome in ('accepted', 'duplicate', 'rejected', 'failed')),
  response_status integer not null check (response_status between 100 and 599),
  error_code text,
  payload_sha256 text,
  payload_bytes integer,
  source_ip inet,
  received_at timestamptz not null default now()
);

create table private.provider_webhook_payloads (
  event_id uuid primary key references public.provider_webhook_events(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index provider_webhook_events_provider_time_idx on public.provider_webhook_events(provider_id, created_at desc);
create index provider_webhook_events_status_time_idx on public.provider_webhook_events(delivery_status, created_at desc);
create index provider_webhook_deliveries_provider_time_idx on public.provider_webhook_deliveries(provider_key, received_at desc);
create index provider_webhook_deliveries_error_time_idx on public.provider_webhook_deliveries(outcome, received_at desc) where outcome in ('rejected', 'failed');

alter table public.provider_webhook_events enable row level security;
alter table public.provider_webhook_deliveries enable row level security;
alter table private.provider_webhook_payloads enable row level security;
revoke all on public.provider_webhook_events, public.provider_webhook_deliveries from public, anon;
revoke all on private.provider_webhook_payloads from public, anon, authenticated;
grant select on public.provider_webhook_events, public.provider_webhook_deliveries to authenticated;

create policy "aal2 active admins view provider webhook events" on public.provider_webhook_events
for select to authenticated using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status in ('active', 'invited')
  )
);
create policy "aal2 active admins view provider webhook deliveries" on public.provider_webhook_deliveries
for select to authenticated using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status in ('active', 'invited')
  )
);

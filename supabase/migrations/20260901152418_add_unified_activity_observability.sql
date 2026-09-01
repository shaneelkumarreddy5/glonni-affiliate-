create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  request_id uuid not null default gen_random_uuid(),
  session_id uuid,
  device_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null default 'anonymous',
  surface text not null default 'web' check (surface in ('customer', 'admin', 'api', 'ai', 'system', 'web')),
  event_type text not null check (char_length(event_type) between 2 and 120),
  endpoint text,
  http_method text,
  request_status integer check (request_status between 100 and 599),
  response_time_ms integer check (response_time_ms >= 0),
  ip_address inet,
  user_agent text,
  error_code text,
  error_details text,
  entity_type text,
  entity_id uuid,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  retention_until timestamptz not null default (now() + interval '180 days')
);

create index activity_events_actor_time_idx on public.activity_events(actor_id, occurred_at desc);
create index activity_events_request_idx on public.activity_events(request_id);
create index activity_events_session_time_idx on public.activity_events(session_id, occurred_at desc);
create index activity_events_endpoint_time_idx on public.activity_events(endpoint, occurred_at desc);
create index activity_events_errors_idx on public.activity_events(request_status, occurred_at desc) where request_status >= 400;

alter table public.activity_events enable row level security;
revoke all on public.activity_events from public;
grant insert on public.activity_events to anon, authenticated;
grant select on public.activity_events to authenticated;

create or replace function private.enrich_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare resolved_role text;
begin
  if new.actor_id is not null then
    if auth.uid() is not null and new.actor_id <> auth.uid() then
      raise exception 'activity actor must match the authenticated user';
    end if;
    select role::text into resolved_role from public.profiles where id = new.actor_id;
    new.actor_role := coalesce(resolved_role, 'unknown');
  else
    new.actor_role := 'anonymous';
  end if;
  new.endpoint := left(coalesce(new.endpoint, ''), 500);
  new.user_agent := left(coalesce(new.user_agent, ''), 500);
  new.error_code := left(coalesce(new.error_code, ''), 120);
  new.error_details := left(coalesce(new.error_details, ''), 1000);
  return new;
end;
$$;
revoke all on function private.enrich_activity_event() from public, anon, authenticated;
create trigger activity_events_enrich before insert on public.activity_events for each row execute function private.enrich_activity_event();

create policy "actors record only their own activity" on public.activity_events for insert to anon, authenticated
with check (actor_id is null or actor_id = (select auth.uid()));
create policy "customers view own activity" on public.activity_events for select to authenticated
using (actor_id = (select auth.uid()));
create policy "aal2 admins view all activity" on public.activity_events for select to authenticated
using (
  (select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin', 'editor')
  and coalesce((select auth.jwt()->>'aal'), '') = 'aal2'
);

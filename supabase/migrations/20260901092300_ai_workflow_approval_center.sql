
create type public.ai_work_status as enum ('pending_approval', 'approved', 'rejected', 'on_hold', 'completed');
create type public.ai_work_area as enum ('marketing', 'content', 'provider_policy', 'catalogue', 'finance', 'security', 'customer_operations');

create table public.ai_work_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  summary text not null check (char_length(summary) between 3 and 2000),
  area public.ai_work_area not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  status public.ai_work_status not null default 'pending_approval',
  requires_owner_approval boolean not null default true,
  proposed_by text not null,
  context jsonb not null default '{}'::jsonb,
  requested_by uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('approved','rejected','on_hold','completed')) = (decided_at is not null))
);

create table public.ai_owner_instructions (
  id uuid primary key default gen_random_uuid(),
  instruction text not null check (char_length(instruction) between 3 and 4000),
  scope text not null default 'all_agents' check (scope in ('all_agents','marketing','content','provider_policy','catalogue','finance','security','customer_operations')),
  status text not null default 'active' check (status in ('active','superseded','revoked')),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_work_events (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.ai_work_items(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_work_items_status_created_idx on public.ai_work_items(status, created_at desc);
create index ai_work_items_area_status_idx on public.ai_work_items(area, status);
create index ai_work_events_item_created_idx on public.ai_work_events(work_item_id, created_at desc);

alter table public.ai_work_items enable row level security;
alter table public.ai_owner_instructions enable row level security;
alter table public.ai_work_events enable row level security;
revoke all on public.ai_work_items, public.ai_owner_instructions, public.ai_work_events from public, anon;
grant select, insert, update on public.ai_work_items, public.ai_owner_instructions, public.ai_work_events to authenticated;

create policy "aal2 staff read ai work" on public.ai_work_items for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 marketing staff submit ai work" on public.ai_work_items for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor') and (select auth.uid()) = requested_by);
create policy "aal2 owner decides ai work" on public.ai_work_items for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner')
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner');

create policy "aal2 staff read ai events" on public.ai_work_events for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 owner writes ai events" on public.ai_work_events for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner');

create policy "aal2 staff read owner instructions" on public.ai_owner_instructions for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 owner manages instructions" on public.ai_owner_instructions for all to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner')
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner' and (select auth.uid()) = issued_by);

insert into public.ai_work_items(title, summary, area, risk_level, proposed_by, context) values
('Ad campaign recommendation', 'Proposed ₹300/day controlled test. The campaign is paused until you approve a platform, budget cap, destination and creative.', 'marketing', 'medium', 'Marketing Manager', '{"channel":"paid_ads","daily_budget_inr":300,"state":"draft"}'),
('Provider policy change', 'Twelve offer descriptions may need updated cashback wording after a provider policy review. Keep existing wording paused until you decide.', 'provider_policy', 'high', 'Provider Policy & Compliance Manager', '{"affected_offers":12,"state":"review"}'),
('Cashback claim exception', 'A ₹350 cashback claim needs an owner decision because no provider-confirmed conversion is available.', 'finance', 'high', 'Finance, Cashback & Risk Manager', '{"amount_inr":350,"state":"exception"}')
on conflict do nothing;

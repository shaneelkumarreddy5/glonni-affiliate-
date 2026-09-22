-- One support record can begin in chatbot, email, or voice and then move
-- safely between AI and human handling without duplicating the conversation.
alter table public.support_tickets
  add column if not exists source_channel text not null default 'email'
    check (source_channel in ('chatbot', 'email', 'voice')),
  add column if not exists support_state text not null default 'needs_human_review'
    check (support_state in ('ai_handling', 'needs_human_review', 'human_assigned', 'waiting_on_provider', 'on_hold', 'resolved')),
  add column if not exists assigned_team text,
  add column if not exists assigned_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists ai_summary text,
  add column if not exists ai_confidence integer check (ai_confidence between 0 and 100),
  add column if not exists ai_recommendation jsonb not null default '{}'::jsonb,
  add column if not exists source_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists resolution_type text,
  add column if not exists resolution_note text,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 120),
  detail jsonb not null default '{}'::jsonb,
  visibility text not null default 'internal' check (visibility in ('customer', 'internal')),
  created_at timestamptz not null default now()
);

create table if not exists public.support_overrides (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  override_type text not null check (override_type in ('cashback_adjustment', 'case_resolution', 'account_recovery', 'other')),
  decision text not null check (char_length(decision) between 3 and 160),
  reason text not null check (char_length(reason) between 10 and 2000),
  evidence_reference text,
  customer_message text not null check (char_length(customer_message) between 10 and 3000),
  adjustment_amount numeric(12,2) check (adjustment_amount is null or adjustment_amount >= 0),
  requires_owner_approval boolean not null default true,
  approval_status text not null default 'pending_approval'
    check (approval_status in ('pending_approval', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists support_tickets_channel_state_updated_idx
  on public.support_tickets(source_channel, support_state, updated_at desc);
create index if not exists support_tickets_assigned_updated_idx
  on public.support_tickets(assigned_to, updated_at desc);
create index if not exists support_ticket_events_ticket_created_idx
  on public.support_ticket_events(ticket_id, created_at desc);
create index if not exists support_overrides_ticket_created_idx
  on public.support_overrides(ticket_id, created_at desc);

alter table public.support_ticket_events enable row level security;
alter table public.support_overrides enable row level security;

revoke all on public.support_ticket_events, public.support_overrides from public, anon;
grant select on public.support_ticket_events to authenticated;
grant select, insert, update on public.support_overrides to authenticated;
grant insert on public.support_ticket_events to authenticated;

-- Replace the earlier broad staff policies with active, 2FA-verified staff access.
drop policy if exists "support staff manage tickets" on public.support_tickets;
drop policy if exists "support staff manage messages" on public.support_messages;
drop policy if exists "support staff manage FAQs" on public.support_faqs;

create policy "aal2 active support staff manage tickets"
on public.support_tickets for all to authenticated
using (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
)
with check (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

create policy "aal2 active support staff manage messages"
on public.support_messages for all to authenticated
using (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
)
with check (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

create policy "aal2 active support staff manage FAQs"
on public.support_faqs for all to authenticated
using (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
)
with check (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

create policy "aal2 active staff view support events"
on public.support_ticket_events for select to authenticated
using (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

create policy "aal2 active staff add support events"
on public.support_ticket_events for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

create policy "aal2 active managers manage support overrides"
on public.support_overrides for all to authenticated
using (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin')
      and e.status = 'active'
  )
)
with check (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin')
      and e.status = 'active'
  )
);

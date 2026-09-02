create table public.support_faqs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'general' check (scope in ('general','merchant','offer','deal','cashback','wallet','account')),
  merchant_id uuid references public.merchants(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete cascade,
  question text not null check (char_length(question) between 5 and 240),
  answer text not null check (char_length(answer) between 10 and 5000),
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope <> 'merchant' or merchant_id is not null),
  check (scope <> 'offer' or offer_id is not null)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ticket_number bigint generated always as identity unique,
  category text not null check (category in ('cashback','withdrawal','order','deal','account','security','other')),
  subject text not null check (char_length(subject) between 4 and 180),
  status text not null default 'open' check (status in ('open','waiting_on_customer','in_review','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  merchant_id uuid references public.merchants(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  cashback_claim_id uuid references public.cashback_claims(id) on delete set null,
  escalation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_type text not null check (author_type in ('customer','assistant','agent','system')),
  body text not null check (char_length(body) between 1 and 5000),
  visibility text not null default 'customer' check (visibility in ('customer','internal')),
  created_at timestamptz not null default now()
);

create index support_faqs_scope_active_idx on public.support_faqs(scope, is_active, display_order);
create index support_tickets_profile_updated_idx on public.support_tickets(profile_id, updated_at desc);
create index support_tickets_status_updated_idx on public.support_tickets(status, updated_at desc);
create index support_messages_ticket_created_idx on public.support_messages(ticket_id, created_at);

alter table public.support_faqs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_faqs, public.support_tickets, public.support_messages from public, anon;
grant select on public.support_faqs to anon, authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;

create policy "active support FAQs are readable" on public.support_faqs for select to anon, authenticated using (is_active);
create policy "customers view own support tickets" on public.support_tickets for select to authenticated using (profile_id = (select auth.uid()));
create policy "customers open own support tickets" on public.support_tickets for insert to authenticated with check (profile_id = (select auth.uid()) and status = 'open' and priority in ('low','normal'));
create policy "customers update own support tickets" on public.support_tickets for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "support staff manage tickets" on public.support_tickets for all to authenticated using ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor')) with check ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor'));
create policy "customers view their support messages" on public.support_messages for select to authenticated using (visibility = 'customer' and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.profile_id = (select auth.uid())));
create policy "customers add to their support tickets" on public.support_messages for insert to authenticated with check (author_id = (select auth.uid()) and author_type = 'customer' and visibility = 'customer' and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.profile_id = (select auth.uid())));
create policy "support staff manage messages" on public.support_messages for all to authenticated using ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor')) with check ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor'));

insert into public.support_faqs(scope, question, answer, keywords, display_order) values
('general','How does Glonni cashback work?','Cashback is shown only on eligible offers. It becomes withdrawable only after the merchant or affiliate provider confirms the purchase and eligibility.','{cashback,eligible,confirmation,withdrawal}',10),
('general','Why is cashback missing or pending?','Tracking can be affected by returns, cancellations, excluded payment methods, coupon conditions, attribution, or a provider confirmation delay. Use Report missing cashback only for an offer that showed cashback when you clicked through Glonni.','{missing,pending,tracking,claim}',20),
('wallet','When can I withdraw cashback?','Only confirmed, eligible cashback is available to withdraw. A withdrawal request is reviewed before any money moves.','{withdrawal,wallet,available}',30),
('deal','Why does a deal have no cashback?','Not every merchant or affiliate program permits customer cashback. Glonni shows cashback only when the exact offer is eligible.','{no cashback,merchant,deal}',40),
('account','How do I keep my account secure?','Never share your password or verification code. For a suspected account issue, select Security when escalating to human support.','{security,password,account}',50)
on conflict do nothing;

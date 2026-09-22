create table if not exists public.ai_provider_connections (
  provider_key text primary key check (provider_key in ('openai','gemini','deepseek','jiao')),
  display_name text not null,
  connection_status text not null default 'not_configured' check (connection_status in ('connected','not_configured','invalid')),
  secret_ref text,
  updated_at timestamptz not null default now()
);

insert into public.ai_provider_connections(provider_key, display_name, connection_status, secret_ref)
values ('openai','OpenAI','connected','OPENAI_API_KEY'),('gemini','Google Gemini','not_configured','GOOGLE_GEMINI_API_KEY'),('deepseek','DeepSeek','not_configured','DEEPSEEK_API_KEY'),('jiao','Jiao','not_configured','JIAO_API_KEY')
on conflict (provider_key) do update set display_name=excluded.display_name, secret_ref=excluded.secret_ref;

create table if not exists public.ai_provider_assignments (
  workflow_key text primary key check (workflow_key in ('decision','generative','research','support','execution')),
  provider_key text not null references public.ai_provider_connections(provider_key) on update cascade,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ai_provider_assignments(workflow_key, provider_key)
values ('decision','openai'),('generative','openai'),('research','openai'),('support','openai'),('execution','openai')
on conflict (workflow_key) do nothing;

alter table public.ai_provider_connections enable row level security;
alter table public.ai_provider_assignments enable row level security;
revoke all on public.ai_provider_connections, public.ai_provider_assignments from public, anon;
grant select on public.ai_provider_connections, public.ai_provider_assignments to authenticated;
grant update on public.ai_provider_assignments to authenticated;

create policy "admins read AI provider connections" on public.ai_provider_connections for select to authenticated using ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin'));
create policy "admins read AI provider assignments" on public.ai_provider_assignments for select to authenticated using ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin'));
create policy "admins update AI provider assignments" on public.ai_provider_assignments for update to authenticated using ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin')) with check ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin'));

create index if not exists ai_provider_assignments_provider_idx on public.ai_provider_assignments(provider_key);

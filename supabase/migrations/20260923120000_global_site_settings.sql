create table public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  global_rules text not null default '' check (char_length(global_rules) <= 5000),
  work_controls jsonb not null default '{"product_intake":true,"scheduled_promotions":true,"nonessential_notifications":true,"ai_workflows":true,"pause_all":false}'::jsonb check (jsonb_typeof(work_controls) = 'object'),
  require_admin_approval boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public, anon, authenticated;
grant select, insert, update on public.platform_settings to authenticated;

create policy "aal2 admins read global settings" on public.platform_settings
for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

create policy "aal2 admins insert global settings" on public.platform_settings
for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

create table public.website_identity (
  id smallint primary key default 1 check (id = 1),
  site_name text not null default 'Glonni' check (char_length(site_name) between 2 and 80),
  logo_url text not null default '' check (logo_url = '' or logo_url ~ '^https://'),
  default_language text not null default 'en-IN' check (default_language in ('en-IN', 'en-US')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.website_identity (id) values (1) on conflict (id) do nothing;
alter table public.website_identity enable row level security;
revoke all on public.website_identity from public, anon, authenticated;
grant select (site_name, logo_url, default_language) on public.website_identity to anon, authenticated;
grant update (site_name, logo_url, default_language, updated_by, updated_at) on public.website_identity to authenticated;
create policy "public reads safe website identity" on public.website_identity
for select to anon, authenticated using (id = 1);
create policy "aal2 admins update website identity" on public.website_identity
for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

create or replace function private.enqueue_customer_notification(
  p_profile_id uuid, p_template_key text, p_source_table text, p_source_id text, p_event_key text,
  p_vars jsonb default '{}'::jsonb, p_destination text default null, p_is_promotional boolean default false
) returns void language plpgsql security definer set search_path=''
as $$
declare t public.notification_templates%rowtype; v_title text; v_body text; v_key text; v_value text;
begin
  if p_profile_id is null then return; end if;
  select * into t from public.notification_templates where template_key=p_template_key and status='active' and in_app_enabled;
  if t.id is null then return; end if;
  if (p_is_promotional or t.is_promotional) and exists (
    select 1 from public.platform_settings ps where ps.id=1
      and ((ps.work_controls->>'pause_all')='true' or (ps.work_controls->>'nonessential_notifications')='false')
  ) then return; end if;
  if (p_is_promotional or t.is_promotional) and not exists(select 1 from public.customer_preferences cp where cp.profile_id=p_profile_id and cp.marketing_updates) then return; end if;
  v_title:=t.subject; v_body:=t.body;
  for v_key,v_value in select key,value from jsonb_each_text(coalesce(p_vars,'{}'::jsonb)) loop
    v_title:=replace(v_title,'{{'||v_key||'}}',left(v_value,240));
    v_body:=replace(v_body,'{{'||v_key||'}}',left(v_value,800));
  end loop;
  insert into public.customer_notifications(profile_id,template_id,category,title,body,source_table,source_id,event_key,destination,metadata)
  values(p_profile_id,t.id,t.category,v_title,v_body,p_source_table,p_source_id,p_event_key,p_destination,coalesce(p_vars,'{}'::jsonb))
  on conflict(profile_id,source_table,source_id,event_key) do nothing;
end;
$$;
revoke all on function private.enqueue_customer_notification(uuid,text,text,text,text,jsonb,text,boolean) from public,anon,authenticated;

create policy "aal2 admins update global settings" on public.platform_settings
for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

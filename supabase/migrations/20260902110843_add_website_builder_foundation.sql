create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  seo_title text,
  seo_description text,
  status text not null default 'draft' check (status in ('draft','pending','published','paused')),
  device_visibility text not null default 'all' check (device_visibility in ('all','desktop','mobile')),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.site_page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  block_type text not null check (block_type in ('hero','banner','text','cta','faq','product_rail','store_rail','category_grid','trust_strip')),
  title text,
  body text,
  cta_label text,
  cta_href text,
  image_url text,
  config jsonb not null default '{}'::jsonb,
  display_order integer not null default 100,
  device_visibility text not null default 'all' check (device_visibility in ('all','desktop','mobile')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.site_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  change_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(page_id, version_number)
);
create table public.site_popups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  title text not null,
  body text,
  cta_label text,
  cta_href text,
  trigger_type text not null default 'page_load' check (trigger_type in ('page_load','exit_intent','scroll','manual')),
  target_scope text not null default 'all_pages' check (target_scope in ('all_pages','home','selected_page','selected_store','selected_category')),
  device_visibility text not null default 'all' check (device_visibility in ('all','desktop','mobile')),
  status text not null default 'draft' check (status in ('draft','pending','published','paused')),
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index site_page_blocks_page_order_idx on public.site_page_blocks(page_id, display_order);
create index site_pages_status_idx on public.site_pages(status, published_at desc);
create index site_popups_status_idx on public.site_popups(status, updated_at desc);
alter table public.site_pages enable row level security;
alter table public.site_page_blocks enable row level security;
alter table public.site_page_versions enable row level security;
alter table public.site_popups enable row level security;
revoke all on public.site_pages, public.site_page_blocks, public.site_page_versions, public.site_popups from public, anon;
grant select on public.site_pages, public.site_page_blocks to anon, authenticated;
grant select, insert, update, delete on public.site_pages, public.site_page_blocks, public.site_page_versions, public.site_popups to authenticated;
create policy "published pages are readable" on public.site_pages for select to anon, authenticated using (status = 'published');
create policy "published page blocks are readable" on public.site_page_blocks for select to anon, authenticated using (is_active and exists (select 1 from public.site_pages p where p.id = page_id and p.status = 'published'));
create policy "content staff manage pages" on public.site_pages for all to authenticated using ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor')) with check ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor'));
create policy "content staff manage page blocks" on public.site_page_blocks for all to authenticated using ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor')) with check ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor'));
create policy "content staff manage page versions" on public.site_page_versions for all to authenticated using ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor')) with check ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor'));
create policy "content staff manage popups" on public.site_popups for all to authenticated using ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor')) with check ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor'));

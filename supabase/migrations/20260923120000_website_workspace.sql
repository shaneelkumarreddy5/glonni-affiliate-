alter table public.site_pages
  add column if not exists published_layout jsonb,
  add column if not exists layout_published_at timestamptz;

insert into public.site_pages (title, slug, description, status)
values
  ('Home', 'system-home', 'Homepage content and merchandising sections.', 'pending'),
  ('Store pages', 'system-stores', 'Shared store page sections.', 'pending'),
  ('Product pages', 'system-product', 'Shared product detail page sections.', 'pending')
on conflict (slug) do nothing;

-- Draft edits are kept as versions. Only publishing copies a layout into the
-- public site_pages row, so customers never see an unsaved edit.
drop policy if exists "content staff manage pages" on public.site_pages;
create policy "aal2 active content staff manage pages"
on public.site_pages for all to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
)
with check (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

drop policy if exists "content staff manage page blocks" on public.site_page_blocks;
create policy "aal2 active content staff manage page blocks"
on public.site_page_blocks for all to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
)
with check (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

drop policy if exists "content staff manage page versions" on public.site_page_versions;
create policy "aal2 active content staff manage page versions"
on public.site_page_versions for all to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
)
with check (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-banners',
  'website-banners',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "aal2 staff upload website banners" on storage.objects;
create policy "aal2 staff upload website banners"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'website-banners'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

drop policy if exists "aal2 staff update website banners" on storage.objects;
create policy "aal2 staff update website banners"
on storage.objects for update to authenticated
using (
  bucket_id = 'website-banners'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
)
with check (
  bucket_id = 'website-banners'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

drop policy if exists "aal2 staff delete website banners" on storage.objects;
create policy "aal2 staff delete website banners"
on storage.objects for delete to authenticated
using (
  bucket_id = 'website-banners'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

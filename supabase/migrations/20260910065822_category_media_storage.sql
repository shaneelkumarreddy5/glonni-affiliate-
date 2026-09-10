insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'category-media',
  'category-media',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "administrators upload category media" on storage.objects;
drop policy if exists "administrators update category media" on storage.objects;
drop policy if exists "administrators delete category media" on storage.objects;

create policy "administrators upload category media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'category-media'
  and exists (
    select 1
    from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin')
      and e.status = 'active'
  )
);

create policy "administrators update category media"
on storage.objects for update to authenticated
using (
  bucket_id = 'category-media'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner', 'admin') and e.status = 'active'
  )
)
with check (
  bucket_id = 'category-media'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner', 'admin') and e.status = 'active'
  )
);

create policy "administrators delete category media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'category-media'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner', 'admin') and e.status = 'active'
  )
);

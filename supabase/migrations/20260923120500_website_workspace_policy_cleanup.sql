drop policy if exists "published pages are readable" on public.site_pages;
drop policy if exists "aal2 active content staff manage pages" on public.site_pages;

create policy "published pages and aal2 staff can read"
on public.site_pages for select to anon, authenticated
using (
  status = 'published'
  or (
    ((select auth.jwt()) ->> 'aal') = 'aal2'
    and exists (
      select 1 from public.profiles p
      join public.employees e on e.profile_id = p.id
      where p.id = (select auth.uid())
        and p.role in ('owner', 'admin', 'editor')
        and e.status = 'active'
    )
  )
);

create policy "aal2 active content staff insert pages"
on public.site_pages for insert to authenticated
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

create policy "aal2 active content staff update pages"
on public.site_pages for update to authenticated
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

create policy "aal2 active content staff delete pages"
on public.site_pages for delete to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

drop policy if exists "published page blocks are readable" on public.site_page_blocks;
drop policy if exists "aal2 active content staff manage page blocks" on public.site_page_blocks;

create policy "published page blocks and aal2 staff can read"
on public.site_page_blocks for select to anon, authenticated
using (
  (
    is_active
    and exists (select 1 from public.site_pages p where p.id = page_id and p.status = 'published')
  )
  or (
    ((select auth.jwt()) ->> 'aal') = 'aal2'
    and exists (
      select 1 from public.profiles p
      join public.employees e on e.profile_id = p.id
      where p.id = (select auth.uid())
        and p.role in ('owner', 'admin', 'editor')
        and e.status = 'active'
    )
  )
);

create policy "aal2 active content staff insert page blocks"
on public.site_page_blocks for insert to authenticated
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

create policy "aal2 active content staff update page blocks"
on public.site_page_blocks for update to authenticated
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

create policy "aal2 active content staff delete page blocks"
on public.site_page_blocks for delete to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

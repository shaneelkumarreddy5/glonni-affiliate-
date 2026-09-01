-- A single read rule keeps customer self-service history and AAL2 admin audit
-- visibility together without evaluating overlapping permissive policies.
drop policy if exists "customers view own activity" on public.activity_events;
drop policy if exists "aal2 admins view all activity" on public.activity_events;

create policy "actors or aal2 admins view activity" on public.activity_events
for select to authenticated
using (
  actor_id = (select auth.uid())
  or (
    (select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin', 'editor')
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
  )
);

-- The Owner policy already grants SELECT through FOR ALL. Restrict the staff
-- read policy to non-owner staff so one authenticated request evaluates one
-- applicable SELECT policy, while preserving the exact access model.
drop policy if exists "aal2 staff read owner instructions" on public.ai_owner_instructions;

create policy "aal2 staff read owner instructions" on public.ai_owner_instructions for select to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('admin','editor')
);

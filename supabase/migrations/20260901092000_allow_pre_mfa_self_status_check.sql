-- Login and middleware must read the signed-in employee's own status at AAL1
-- before deciding whether to route them to MFA enrollment or challenge.
-- The existing employee SELECT policy exposes only the caller's own record at AAL1;
-- directory access and every write remain protected by AAL2 role policies.
drop policy if exists "active admin account required" on public.employees;

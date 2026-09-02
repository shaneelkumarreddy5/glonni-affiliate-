drop policy if exists "customers update own support tickets" on public.support_tickets;
revoke update on public.support_tickets from authenticated;
grant update on public.support_tickets to authenticated;
-- Updates are now available only through the staff policy; customers can open tickets and add messages, but cannot alter status, priority, assignee or linked financial records.

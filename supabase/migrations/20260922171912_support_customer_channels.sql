-- Customer entry points may create a tracked ticket, but cannot self-assign,
-- resolve, or inject internal/AI workflow state.
drop policy if exists "customers open own support tickets" on public.support_tickets;

create policy "customers open own support tickets"
on public.support_tickets for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and status = 'open'
  and priority in ('low', 'normal')
  and source_channel in ('chatbot', 'email', 'voice')
  and support_state = 'needs_human_review'
  and assigned_to is null
  and resolved_at is null
  and resolved_by is null
  and resolution_type is null
  and resolution_note is null
);

-- Keep the admin queue current when a customer replies without granting
-- customers permission to edit ticket ownership, financial links, or outcomes.
create or replace function private.bump_support_ticket_after_customer_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.author_type = 'customer' and NEW.visibility = 'customer'
     and exists (
       select 1 from public.support_tickets
       where id = NEW.ticket_id and profile_id = (select auth.uid())
     ) then
    update public.support_tickets
    set status = 'open', support_state = 'needs_human_review',
        escalation_reason = 'Customer replied and needs support review.',
        updated_at = now()
    where id = NEW.ticket_id;
  end if;
  return NEW;
end;
$$;

revoke all on function private.bump_support_ticket_after_customer_message() from public, anon, authenticated;
drop trigger if exists support_ticket_customer_message_bump on public.support_messages;
create trigger support_ticket_customer_message_bump
after insert on public.support_messages
for each row execute function private.bump_support_ticket_after_customer_message();

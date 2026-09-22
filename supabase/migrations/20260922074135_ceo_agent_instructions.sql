-- CEO instructions are scoped to the specialist agent that must follow them.
alter table public.ai_owner_instructions
  drop constraint if exists ai_owner_instructions_scope_check;

alter table public.ai_owner_instructions
  add constraint ai_owner_instructions_scope_check check (scope in (
    'all_agents','affiliate_partnerships','marketing','content','provider_policy',
    'catalogue','finance','security','customer_operations'
  ));

-- Seed safe defaults for the CEO control centre when an owner profile already exists.
do $$
declare
  owner_id uuid;
begin
  select id into owner_id from public.profiles where role = 'owner' limit 1;
  if owner_id is not null then
    insert into public.ai_owner_instructions (instruction, scope, issued_by)
    select seed.instruction, seed.scope, owner_id
    from (values
      ('Use connected affiliate stores only and keep every source reference.', 'catalogue'),
      ('Never publish a product without CEO and admin approval.', 'catalogue'),
      ('Prepare campaigns for review and never publish or spend automatically.', 'marketing'),
      ('Flag commission or cashback exceptions before recommending changes.', 'finance'),
      ('Verify provider tracking readiness and flag duplicate store connections.', 'affiliate_partnerships'),
      ('Show the source and effective date for every policy recommendation.', 'provider_policy'),
      ('Keep customer-facing copy accurate and submit it for approval before publishing.', 'content'),
      ('Recommend security holds with evidence; never block accounts or funds automatically.', 'security'),
      ('Use relevant customer records only and escalate sensitive or high-value cases.', 'customer_operations')
    ) as seed(instruction, scope)
    where not exists (
      select 1 from public.ai_owner_instructions existing
      where existing.scope = seed.scope and existing.instruction = seed.instruction
    );
  end if;
end $$;

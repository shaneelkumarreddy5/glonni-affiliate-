alter table public.ai_agents
  add column if not exists description text,
  add column if not exists operating_mode text not null default 'not_connected'
    check (operating_mode in ('live','shadow','approval_required','watch','not_connected')),
  add column if not exists runtime_status text not null default 'disabled'
    check (runtime_status in ('idle','running','failed','disabled','not_connected')),
  add column if not exists last_run_at timestamptz,
  add column if not exists next_run_at timestamptz,
  add column if not exists success_count bigint not null default 0,
  add column if not exists failure_count bigint not null default 0,
  add column if not exists latest_error text,
  add column if not exists last_duration_ms integer,
  add column if not exists capability_status text not null default 'interface_only'
    check (capability_status in ('operational','partial','interface_only','mock'));

insert into public.ai_agents (key, name, description, mode, is_enabled, operating_mode, runtime_status, capability_status, guardrails)
values
  ('ceo_operations', 'CEO & Operations Manager', 'Owner guidance, daily briefs and operational escalation.', 'approval_required', true, 'approval_required', 'idle', 'operational', '{"requires_approval":true,"execution_path":"ai-owner-chat"}'),
  ('affiliate_partnerships', 'Affiliate Partnerships & Provider Manager', 'Provider onboarding, merchant relationships and connection readiness.', 'manual', false, 'not_connected', 'not_connected', 'interface_only', '{"requires_live_provider":true,"requires_approval":true}'),
  ('provider_compliance', 'Provider Policy & Compliance Manager', 'Provider policy monitoring and compliance recommendations.', 'manual', false, 'not_connected', 'not_connected', 'interface_only', '{"requires_live_provider":true,"requires_approval":true}'),
  ('catalogue_merchandising', 'Catalogue & Merchandising Manager', 'Product enrichment, catalogue quality and merchandising proposals.', 'approval_required', true, 'approval_required', 'idle', 'partial', '{"requires_approval":true,"execution_path":"ai-product-enrichment"}'),
  ('content_experience', 'Content & Experience Manager', 'Customer-facing content and creative recommendations.', 'manual', false, 'not_connected', 'not_connected', 'interface_only', '{"requires_approval":true}'),
  ('marketing', 'Marketing Manager', 'Campaign and distribution recommendations.', 'manual', false, 'not_connected', 'not_connected', 'interface_only', '{"requires_external_channels":true,"requires_approval":true}'),
  ('finance_cashback_risk', 'Finance, Cashback & Risk Manager', 'Commission, cashback, dispute and withdrawal analysis.', 'manual', false, 'not_connected', 'not_connected', 'interface_only', '{"requires_live_provider":true,"requires_approval":true}'),
  ('fraud_security', 'Fraud & Security Manager', 'Suspicious activity and affiliate abuse monitoring.', 'manual', false, 'not_connected', 'not_connected', 'interface_only', '{"requires_event_pipeline":true,"requires_approval":true}'),
  ('customer_operations', 'Customer Operations & Trust Manager', 'Support triage and missing-order workflow recommendations.', 'manual', false, 'not_connected', 'not_connected', 'interface_only', '{"requires_approval":true}')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  mode = excluded.mode,
  is_enabled = excluded.is_enabled,
  operating_mode = excluded.operating_mode,
  runtime_status = excluded.runtime_status,
  capability_status = excluded.capability_status,
  guardrails = excluded.guardrails,
  updated_at = now();

update public.ai_agents
set runtime_status = 'disabled', operating_mode = 'not_connected', capability_status = 'interface_only'
where key in ('deal_discovery','product_normalization','offer_quality','paid_marketing');

create index if not exists ai_agents_runtime_status_idx on public.ai_agents(runtime_status, is_enabled);

alter table public.customer_preferences
  add column if not exists email_deal_updates boolean not null default true,
  add column if not exists whatsapp_deal_updates boolean not null default false,
  add column if not exists sms_deal_updates boolean not null default false;

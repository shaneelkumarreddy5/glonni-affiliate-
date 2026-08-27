create index audit_events_actor_id_idx on public.audit_events(actor_id);
create index products_category_id_idx on public.products(category_id);
create index redirect_events_merchant_id_idx on public.redirect_events(merchant_id);

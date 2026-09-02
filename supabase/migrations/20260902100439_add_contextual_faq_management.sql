grant insert, update, delete on public.support_faqs to authenticated;
create policy "support staff manage FAQs" on public.support_faqs for all to authenticated using ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor')) with check ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin','editor'));

create table public.product_duplicate_decisions (
  id uuid primary key default gen_random_uuid(),
  product_a_id uuid references public.products(id) on delete set null,
  product_b_id uuid references public.products(id) on delete set null,
  product_a_snapshot jsonb not null,
  product_b_snapshot jsonb not null,
  confidence integer not null check (confidence between 0 and 100),
  match_reasons text[] not null default '{}',
  decision text not null check (decision in ('merged','keep_separate','rejected_duplicate')),
  canonical_product_id uuid references public.products(id) on delete set null,
  review_note text,
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now()
);

create index product_duplicate_decisions_products_idx on public.product_duplicate_decisions(product_a_id,product_b_id);
alter table public.product_duplicate_decisions enable row level security;
revoke all on public.product_duplicate_decisions from public, anon;
grant select, insert on public.product_duplicate_decisions to authenticated;
create policy "aal2 product admins review duplicates" on public.product_duplicate_decisions for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

create or replace function public.merge_duplicate_products(canonical_id uuid, duplicate_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare canonical public.products%rowtype; duplicate public.products%rowtype;
begin
  if (select auth.jwt()->>'aal') <> 'aal2' or not exists(
    select 1 from public.profiles p join public.employees e on e.profile_id=p.id
    where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'
  ) then raise exception 'Verified administrator required'; end if;
  if canonical_id=duplicate_id then raise exception 'Products must be different'; end if;
  select * into canonical from public.products where id=canonical_id for update;
  select * into duplicate from public.products where id=duplicate_id for update;
  if canonical.id is null or duplicate.id is null then raise exception 'Product not found'; end if;

  update public.products set
    brand=coalesce(nullif(canonical.brand,''),duplicate.brand),
    description=case when char_length(coalesce(duplicate.description,''))>char_length(coalesce(canonical.description,'')) then duplicate.description else canonical.description end,
    category_id=coalesce(canonical.category_id,duplicate.category_id),
    image_url=coalesce(canonical.image_url,duplicate.image_url),
    gallery_images=case when jsonb_array_length(canonical.gallery_images)>=jsonb_array_length(duplicate.gallery_images) then canonical.gallery_images else duplicate.gallery_images end,
    variants=case when jsonb_array_length(canonical.variants)>=jsonb_array_length(duplicate.variants) then canonical.variants else duplicate.variants end,
    specifications=case when jsonb_array_length(canonical.specifications)>=jsonb_array_length(duplicate.specifications) then canonical.specifications else duplicate.specifications end,
    product_information=duplicate.product_information || canonical.product_information,
    is_active=canonical.is_active or duplicate.is_active,
    updated_at=now()
  where id=canonical_id;

  update public.offers set product_id=canonical_id where product_id=duplicate_id;
  update public.product_price_history set product_id=canonical_id where product_id=duplicate_id;
  update public.import_batch_rows set product_id=canonical_id where product_id=duplicate_id;
  update public.ai_jobs set product_draft_id=canonical_id where product_draft_id=duplicate_id;
  update public.product_refresh_runs set product_id=canonical_id where product_id=duplicate_id;
  update public.product_change_sets set product_id=canonical_id where product_id=duplicate_id;
  update public.product_change_snapshots set product_id=canonical_id where product_id=duplicate_id;
  if exists(select 1 from public.product_refresh_policies where product_id=canonical_id) then
    delete from public.product_refresh_policies where product_id=duplicate_id;
  else
    update public.product_refresh_policies set product_id=canonical_id where product_id=duplicate_id;
  end if;
  delete from public.products where id=duplicate_id;
end;
$$;
revoke all on function public.merge_duplicate_products(uuid,uuid) from public, anon;
grant execute on function public.merge_duplicate_products(uuid,uuid) to authenticated;

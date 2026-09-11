create or replace function public.delete_category_branch(
  p_category_id uuid,
  p_replacement_category_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_branch_ids uuid[];
  v_product_count integer := 0;
  v_category_count integer := 0;
  v_category_id uuid;
begin
  select role into v_role from public.profiles where id = (select auth.uid());
  if v_role is null or v_role not in ('owner'::public.app_role, 'admin'::public.app_role) then
    raise exception 'Only an owner or administrator can permanently delete categories.';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'A verified 2FA session is required to permanently delete categories.';
  end if;

  with recursive branch(id, depth) as (
    select id, 0 from public.categories where id = p_category_id
    union all
    select child.id, branch.depth + 1
    from public.categories child
    join branch on child.parent_id = branch.id
  )
  select array_agg(id order by depth desc), count(*)::integer
  into v_branch_ids, v_category_count
  from branch;

  if v_branch_ids is null then raise exception 'Category not found.'; end if;

  select count(*)::integer into v_product_count
  from public.products where category_id = any(v_branch_ids);

  if v_product_count > 0 then
    if p_replacement_category_id is null then
      raise exception 'Choose another category before deleting. This branch contains % product(s).', v_product_count;
    end if;
    if p_replacement_category_id = any(v_branch_ids) then
      raise exception 'Products cannot be moved into the category branch being deleted.';
    end if;
    if not exists (select 1 from public.categories where id = p_replacement_category_id and archived_at is null) then
      raise exception 'The destination category is not available.';
    end if;
    update public.products
      set category_id = p_replacement_category_id, updated_at = now()
      where category_id = any(v_branch_ids);
  end if;

  foreach v_category_id in array v_branch_ids loop
    delete from public.categories where id = v_category_id;
  end loop;

  return jsonb_build_object('deleted_categories', v_category_count, 'moved_products', v_product_count);
end;
$$;

revoke all on function public.delete_category_branch(uuid, uuid) from public, anon;
grant execute on function public.delete_category_branch(uuid, uuid) to authenticated;;

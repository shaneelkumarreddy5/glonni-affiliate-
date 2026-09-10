alter table public.categories drop constraint if exists categories_level_check;

create or replace function public.validate_category_hierarchy()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_level smallint;
  cycle_found boolean;
begin
  if new.parent_id is null then
    new.level := 1;
  else
    select level into parent_level from public.categories where id = new.parent_id;
    if parent_level is null then raise exception 'Parent category does not exist'; end if;
    new.level := parent_level + 1;
    with recursive ancestors as (
      select id, parent_id from public.categories where id = new.parent_id
      union all
      select c.id, c.parent_id from public.categories c join ancestors a on c.id = a.parent_id
    )
    select exists(select 1 from ancestors where id = new.id) into cycle_found;
    if cycle_found then raise exception 'A category cannot be moved inside its own subtree'; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.refresh_category_descendant_levels()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  with recursive descendants as (
    select id, new.level + 1 as calculated_level
    from public.categories where parent_id = new.id
    union all
    select c.id, d.calculated_level + 1
    from public.categories c join descendants d on c.parent_id = d.id
  )
  update public.categories c
  set level = d.calculated_level, updated_at = now()
  from descendants d where c.id = d.id;
  return null;
end;
$$;

revoke all on function public.validate_category_hierarchy() from public, anon, authenticated;
revoke all on function public.refresh_category_descendant_levels() from public, anon, authenticated;

drop trigger if exists categories_refresh_descendant_levels on public.categories;
create trigger categories_refresh_descendant_levels
after update of parent_id on public.categories
for each row execute function public.refresh_category_descendant_levels();

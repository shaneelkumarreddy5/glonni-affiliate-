alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete restrict,
  add column if not exists level smallint not null default 1 check (level between 1 and 3),
  add column if not exists description text,
  add column if not exists icon_name text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists show_on_homepage boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add constraint categories_not_own_parent check (parent_id is null or parent_id <> id);

create index if not exists categories_parent_order_idx on public.categories(parent_id, display_order);
create index if not exists categories_active_level_idx on public.categories(is_active, level);

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
    if parent_level >= 3 then raise exception 'Categories support a maximum of three levels'; end if;
    new.level := parent_level + 1;
    with recursive ancestors as (
      select id,parent_id from public.categories where id = new.parent_id
      union all
      select c.id,c.parent_id from public.categories c join ancestors a on c.id = a.parent_id
    ) select exists(select 1 from ancestors where id = new.id) into cycle_found;
    if cycle_found then raise exception 'A category cannot be moved inside its own subtree'; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_category_hierarchy() from public, anon, authenticated;
drop trigger if exists categories_validate_hierarchy on public.categories;
create trigger categories_validate_hierarchy
before insert or update of parent_id on public.categories
for each row execute function public.validate_category_hierarchy();

update public.categories
set show_on_homepage = true
where is_active and display_order between 1 and 8;

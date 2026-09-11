alter table public.categories
  add column if not exists navigation_label text,
  add column if not exists short_description text,
  add column if not exists category_type text not null default 'category',
  add column if not exists banner_url text,
  add column if not exists mobile_banner_url text,
  add column if not exists seo_keywords text[] not null default '{}',
  add column if not exists canonical_url text,
  add column if not exists show_in_navigation boolean not null default true,
  add column if not exists is_searchable boolean not null default true,
  add column if not exists sort_mode text not null default 'featured',
  add column if not exists product_assignment text not null default 'manual',
  add column if not exists filter_configuration jsonb not null default '{}'::jsonb,
  add constraint categories_type_check check (category_type in ('department','category','subcategory','collection')),
  add constraint categories_sort_mode_check check (sort_mode in ('featured','popularity','newest','price_low_high','price_high_low','discount')),
  add constraint categories_product_assignment_check check (product_assignment in ('manual','rules','provider'));

create index if not exists categories_navigation_idx
  on public.categories (show_in_navigation, is_active, parent_id, display_order)
  where archived_at is null;

create index if not exists categories_searchable_idx
  on public.categories (is_searchable, is_active)
  where archived_at is null;

comment on column public.categories.category_type is 'Merchandising role; hierarchy depth remains independent and unlimited.';
comment on column public.categories.filter_configuration is 'Category-specific storefront filter/facet configuration.';
;

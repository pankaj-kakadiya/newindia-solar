create table public.product_catalogues (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(btrim(title)) between 1 and 120),
 description text not null default '' check (length(description)<=1000),
 scope text not null default 'all' check (scope in ('all','categories','products')),
 category_ids uuid[] not null default '{}' check (cardinality(category_ids)<=1000),
 product_ids uuid[] not null default '{}' check (cardinality(product_ids)<=10000),
 show_prices boolean not null default false,
 is_published boolean not null default false,
 sort_order integer not null default 0 check (sort_order between 0 and 9999),
 created_at timestamptz not null default now(),
 check (scope <> 'categories' or cardinality(category_ids)>0),
 check (scope <> 'products' or cardinality(product_ids)>0)
);
alter table public.product_catalogues enable row level security;
revoke all on public.product_catalogues from anon, authenticated;
grant select on public.product_catalogues to anon;
grant select,insert,update,delete on public.product_catalogues to authenticated;
create policy catalogue_public_read on public.product_catalogues for select to anon,authenticated using (is_published);
create policy catalogue_staff_read on public.product_catalogues for select to authenticated using ((select public.has_admin_permission('content','view')));
create policy catalogue_staff_create on public.product_catalogues for insert to authenticated with check ((select public.has_admin_permission('content','create')));
create policy catalogue_staff_edit on public.product_catalogues for update to authenticated using ((select public.has_admin_permission('content','edit'))) with check ((select public.has_admin_permission('content','edit')));
create policy catalogue_staff_delete on public.product_catalogues for delete to authenticated using ((select public.has_admin_permission('content','delete')));
create index product_catalogues_published_sort_idx on public.product_catalogues (sort_order,id) where is_published;
-- Ready-to-review definitions only. Admin chooses when to publish them.
insert into public.product_catalogues(title,description,scope) values ('Complete Product Catalogue','Explore the New India Solar product range.','all');
insert into public.product_catalogues(title,description,scope,category_ids)
 select name || ' Catalogue','Current published ' || name || ' products.','categories',array[id] from public.categories where is_active and slug in ('acdb','dcdb');

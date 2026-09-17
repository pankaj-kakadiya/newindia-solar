-- Synthetic identities with the actual reviewed production permission functions.
-- No user rows or catalogue values are copied from production.
create table public.profiles(id uuid primary key, role text, admin_role text, staff_status text);
create table public.admin_user_permissions(user_id uuid,module_key text,action_key text,allowed boolean);
create table public.admin_role_permissions(role_key text,module_key text,can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_approve boolean,can_export boolean);
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.role::text in ('admin','staff')
      and p.staff_status='active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(p_module text, p_action text DEFAULT 'view'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_admin_role text;
  v_status text;
  v_override boolean;
  v_result boolean:=false;
begin
  select role::text,admin_role,staff_status into v_role,v_admin_role,v_status from public.profiles where id=auth.uid();
  if v_status is distinct from 'active' then return false; end if;
  if v_role='admin' then return true; end if;
  if v_role is distinct from 'staff' then return false; end if;

  select allowed into v_override from public.admin_user_permissions
  where user_id=auth.uid() and module_key=p_module and action_key=p_action;
  if found then return v_override; end if;

  select case p_action
    when 'view' then can_view
    when 'create' then can_create
    when 'edit' then can_edit
    when 'delete' then can_delete
    when 'approve' then can_approve
    when 'export' then can_export
    else false end
  into v_result
  from public.admin_role_permissions
  where role_key=coalesce(v_admin_role,'general') and module_key=p_module;
  return coalesce(v_result,false);
end;
$function$;


alter table public.product_variants enable row level security;
create policy public_read_product_variants on public.product_variants for select using (is_active=true);
create policy product_variants_staff_all on public.product_variants to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy rbac_products_view_product_variants on public.product_variants as restrictive for select to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('products','view'));
create policy rbac_products_create_product_variants on public.product_variants as restrictive for insert to authenticated with check ((not public.is_staff_or_admin()) or public.has_admin_permission('products','create'));
create policy rbac_products_edit_product_variants on public.product_variants as restrictive for update to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('products','edit')) with check ((not public.is_staff_or_admin()) or public.has_admin_permission('products','edit'));
create policy rbac_products_delete_product_variants on public.product_variants as restrictive for delete to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('products','delete'));
-- Deliberately seed both table-level and redundant column-level grants.
grant select on public.product_variants to public;
grant select(cost_price) on public.product_variants to public,anon,authenticated;

alter table public.components enable row level security;
create policy public_read_components on public.components for select using (is_active=true);
create policy components_staff_all on public.components to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy rbac_components_view_components on public.components as restrictive for select to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('components','view'));
create policy rbac_components_create_components on public.components as restrictive for insert to authenticated with check ((not public.is_staff_or_admin()) or public.has_admin_permission('components','create'));
create policy rbac_components_edit_components on public.components as restrictive for update to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('components','edit')) with check ((not public.is_staff_or_admin()) or public.has_admin_permission('components','edit'));
create policy rbac_components_delete_components on public.components as restrictive for delete to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('components','delete'));
-- Deliberately seed both table-level and redundant column-level grants.
grant select on public.components to public;
grant select(cost_price) on public.components to public,anon,authenticated;

alter table public.enclosures enable row level security;
create policy public_read_enclosures on public.enclosures for select using (is_active=true);
create policy enclosures_staff_all on public.enclosures to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy rbac_inventory_view_enclosures on public.enclosures as restrictive for select to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('inventory','view'));
create policy rbac_inventory_create_enclosures on public.enclosures as restrictive for insert to authenticated with check ((not public.is_staff_or_admin()) or public.has_admin_permission('inventory','create'));
create policy rbac_inventory_edit_enclosures on public.enclosures as restrictive for update to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('inventory','edit')) with check ((not public.is_staff_or_admin()) or public.has_admin_permission('inventory','edit'));
create policy rbac_inventory_delete_enclosures on public.enclosures as restrictive for delete to authenticated using ((not public.is_staff_or_admin()) or public.has_admin_permission('inventory','delete'));
-- Deliberately seed both table-level and redundant column-level grants.
grant select on public.enclosures to public;
grant select(cost_price) on public.enclosures to public,anon,authenticated;


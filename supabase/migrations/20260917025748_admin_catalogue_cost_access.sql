-- Step 2 phase A: additive; deploy before the matching website release.
-- Costs remain in their original tables so existing server-side pricing,
-- purchasing, imports, reports and production snapshots retain their behavior.
create or replace function public.admin_catalogue_costs(
  p_item_type text,
  p_item_ids uuid[],
  p_module text
)
returns table(item_id uuid, cost_price numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(public.is_staff_or_admin(),false) then
    raise exception 'Active staff access required' using errcode='42501';
  end if;
  -- A caller cannot supply an unrelated module they happen to have access to.
  if not coalesce(
    (p_item_type='variant' and p_module in ('products','pricing','inventory','purchasing','workflows')) or
    (p_item_type='component' and p_module in ('components','configurator','pricing','inventory','purchasing','workflows')) or
    (p_item_type='enclosure' and p_module in ('configurator','pricing','inventory','purchasing','workflows')),
    false
  ) then
    raise exception 'Unsupported catalogue cost scope' using errcode='22023';
  end if;
  if not coalesce(public.has_admin_permission(p_module,'view'),false) then
    raise exception 'Module view permission required' using errcode='42501';
  end if;
  if p_item_ids is null or cardinality(p_item_ids)>1000 or array_position(p_item_ids,null) is not null then
    raise exception 'Provide at most 1000 non-null item IDs' using errcode='22023';
  end if;
  if p_item_type='variant' then
    return query select v.id,v.cost_price from public.product_variants v where v.id=any(p_item_ids);
  elsif p_item_type='component' then
    return query select c.id,c.cost_price from public.components c where c.id=any(p_item_ids);
  else
    return query select e.id,e.cost_price from public.enclosures e where e.id=any(p_item_ids);
  end if;
end;
$$;
revoke all on function public.admin_catalogue_costs(text,uuid[],text) from public,anon;
grant execute on function public.admin_catalogue_costs(text,uuid[],text) to authenticated;
comment on function public.admin_catalogue_costs(text,uuid[],text) is
  'Staff-only bounded cost lookup; checks current profile status and module permission on every request.';
notify pgrst, 'reload schema';

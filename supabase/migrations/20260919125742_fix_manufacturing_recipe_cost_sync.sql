-- Make protected catalogue costs available to authorised production users.
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
  if not coalesce(
    (p_item_type='variant' and p_module in ('products','pricing','inventory','purchasing','workflows','production')) or
    (p_item_type='component' and p_module in ('components','configurator','pricing','inventory','purchasing','workflows','production')) or
    (p_item_type='enclosure' and p_module in ('configurator','pricing','inventory','purchasing','workflows','production')),
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

-- Recipe save, BOM replacement and output-product cost sync are one transaction.
create or replace function public.save_manufacturing_recipe(
 p_recipe_id uuid,p_variant_id uuid,p_name text,p_box_type text,p_status text,p_labour_cost numeric,
 p_overhead_cost numeric,p_packaging_cost numeric,p_target_margin_percent numeric,p_notes text,p_items jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_id uuid;
 v_version integer;
 v_item jsonb;
 v_locked boolean:=false;
 v_total_cost numeric;
begin
 if not (public.has_admin_permission('production','create') or public.has_admin_permission('production','edit')) then raise exception 'Production edit permission required'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Recipe name is required'; end if;
 if p_box_type not in('acdb','dcdb','combo') or p_status not in('draft','active','archived') then raise exception 'Invalid recipe type or status'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one BOM item'; end if;
 if not exists(select 1 from public.product_variants where id=p_variant_id) then raise exception 'Output finished product not found'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'item_type'='variant' and (x->>'item_id')::uuid=p_variant_id) then raise exception 'A recipe cannot consume its own output variant'; end if;
 if p_recipe_id is not null then
  select exists(select 1 from public.production_jobs where manufacturing_recipe_id=p_recipe_id) into v_locked;
 end if;
 if p_status='active' then update public.manufacturing_recipes set status='archived',updated_by=auth.uid() where variant_id=p_variant_id and status='active' and id is distinct from p_recipe_id; end if;
 if p_recipe_id is null or v_locked then
  select coalesce(max(version),0)+1 into v_version from public.manufacturing_recipes where variant_id=p_variant_id;
  if v_locked then update public.manufacturing_recipes set status='archived',updated_by=auth.uid() where id=p_recipe_id; end if;
  insert into public.manufacturing_recipes(variant_id,name,box_type,version,status,labour_cost,overhead_cost,packaging_cost,target_margin_percent,notes,created_by,updated_by)
  values(p_variant_id,trim(p_name),p_box_type,v_version,p_status,coalesce(p_labour_cost,0),coalesce(p_overhead_cost,0),coalesce(p_packaging_cost,0),coalesce(p_target_margin_percent,25),nullif(trim(p_notes),''),auth.uid(),auth.uid()) returning id into v_id;
 else
  update public.manufacturing_recipes set variant_id=p_variant_id,name=trim(p_name),box_type=p_box_type,status=p_status,
   labour_cost=coalesce(p_labour_cost,0),overhead_cost=coalesce(p_overhead_cost,0),packaging_cost=coalesce(p_packaging_cost,0),target_margin_percent=coalesce(p_target_margin_percent,25),notes=nullif(trim(p_notes),''),updated_by=auth.uid(),updated_at=now()
  where id=p_recipe_id returning id into v_id;
  if v_id is null then raise exception 'Recipe not found'; end if;
  delete from public.manufacturing_recipe_items where recipe_id=v_id;
 end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  insert into public.manufacturing_recipe_items(recipe_id,component_id,enclosure_id,variant_id,quantity,wastage_percent,unit,notes,sort_order)
  values(v_id,case when v_item->>'item_type'='component' then (v_item->>'item_id')::uuid end,
   case when v_item->>'item_type'='enclosure' then (v_item->>'item_id')::uuid end,
   case when v_item->>'item_type'='variant' then (v_item->>'item_id')::uuid end,
   greatest(coalesce((v_item->>'quantity')::numeric,0),0.0001),greatest(least(coalesce((v_item->>'wastage_percent')::numeric,0),100),0),coalesce(nullif(v_item->>'unit',''),'pcs'),nullif(v_item->>'notes',''),coalesce((v_item->>'sort_order')::integer,0));
 end loop;

 if exists(
  select 1 from public.manufacturing_recipe_items i
  left join public.components c on c.id=i.component_id
  left join public.enclosures e on e.id=i.enclosure_id
  left join public.product_variants pv on pv.id=i.variant_id
  where i.recipe_id=v_id and coalesce(c.cost_price,e.cost_price,pv.cost_price) is null
 ) then
  raise exception 'Every selected BOM material must have a cost price before the recipe can be saved';
 end if;

 select round(
  coalesce(sum(i.quantity*(1+i.wastage_percent/100)*coalesce(c.cost_price,e.cost_price,pv.cost_price,0)),0)
  + coalesce(p_labour_cost,0)+coalesce(p_overhead_cost,0)+coalesce(p_packaging_cost,0),2
 ) into v_total_cost
 from public.manufacturing_recipe_items i
 left join public.components c on c.id=i.component_id
 left join public.enclosures e on e.id=i.enclosure_id
 left join public.product_variants pv on pv.id=i.variant_id
 where i.recipe_id=v_id;

 update public.product_variants
 set cost_price=v_total_cost,updated_at=now()
 where id=p_variant_id;
 return v_id;
end $$;
revoke all on function public.save_manufacturing_recipe(uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,text,jsonb) from public,anon;
grant execute on function public.save_manufacturing_recipe(uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,text,jsonb) to authenticated;

notify pgrst, 'reload schema';

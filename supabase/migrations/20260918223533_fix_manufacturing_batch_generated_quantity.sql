-- required_qty is generated from quantity; do not write it explicitly.
create or replace function public.create_manufacturing_batch(p_recipe_id uuid,p_quantity numeric,p_due_date date default null,p_priority text default 'normal',p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.manufacturing_recipes%rowtype; v_job uuid; v_job_no text; v_product text; v_cost record; i record; v_required numeric;
begin
 if not public.has_admin_permission('production','create') then raise exception 'Production create permission required'; end if;
 if coalesce(p_quantity,0)<=0 then raise exception 'Build quantity must be positive'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('newindia-manufacturing-build'));
 select * into r from public.manufacturing_recipes where id=p_recipe_id and status='active';
 if not found then raise exception 'An active manufacturing recipe is required'; end if;
 select p.name||case when pv.title<>'Standard' then ' · '||pv.title else '' end into v_product from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=r.variant_id;
 select * into v_cost from public.manufacturing_recipe_costs(r.id);
 if v_cost.item_count=0 then raise exception 'Recipe has no materials'; end if;
 if v_cost.buildable_qty<p_quantity then raise exception 'Only % unit(s) can be built with current stock',v_cost.buildable_qty; end if;
 v_job_no:='MFG-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.manufacturing_job_sequence')::text,5,'0');
 insert into public.production_jobs(job_number,product_name,quantity,status,priority,due_date,internal_notes,build_mode,manufacturing_recipe_id,target_variant_id,estimated_unit_cost,non_material_unit_cost,bom_snapshot)
 values(v_job_no,v_product,p_quantity,'bom_ready',coalesce(p_priority,'normal'),p_due_date,p_notes,'make_to_stock',r.id,r.variant_id,v_cost.total_cost,r.labour_cost+r.overhead_cost+r.packaging_cost,'[]'::jsonb)
 returning id into v_job;
 for i in select ri.*,c.name component_name,c.category,c.sku component_sku,c.cost_price component_cost,e.name enclosure_name,e.sku enclosure_sku,e.cost_price enclosure_cost,p.name product_name,pv.title variant_title,pv.sku variant_sku,pv.cost_price variant_cost
  from public.manufacturing_recipe_items ri left join public.components c on c.id=ri.component_id left join public.enclosures e on e.id=ri.enclosure_id left join public.product_variants pv on pv.id=ri.variant_id left join public.products p on p.id=pv.product_id where ri.recipe_id=r.id order by ri.sort_order
 loop
  v_required:=i.quantity*(1+i.wastage_percent/100)*p_quantity;
  insert into public.production_bom_items(production_job_id,recipe_item_id,component_id,enclosure_id,variant_id,component_category,component_name,sku_snapshot,quantity,unit,unit_cost_snapshot,wastage_percent)
  values(v_job,i.id,i.component_id,i.enclosure_id,i.variant_id,coalesce(i.category,case when i.enclosure_id is not null then 'Enclosure' else 'Finished product' end),coalesce(i.component_name,i.enclosure_name,i.product_name||' · '||i.variant_title),coalesce(i.component_sku,i.enclosure_sku,i.variant_sku),v_required,i.unit,coalesce(i.component_cost,i.enclosure_cost,i.variant_cost,0),i.wastage_percent);
  insert into public.inventory_reservations(order_id,production_job_id,component_id,enclosure_id,variant_id,quantity,status)
  values(null,v_job,i.component_id,i.enclosure_id,i.variant_id,v_required,'reserved');
 end loop;
 return v_job;
end $$;
revoke all on function public.create_manufacturing_batch(uuid,numeric,date,text,text) from public,anon;
grant execute on function public.create_manufacturing_batch(uuid,numeric,date,text,text) to authenticated;

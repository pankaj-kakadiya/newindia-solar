-- Start an idempotent recipe-backed assembly job directly from an order item.
create unique index if not exists production_jobs_one_per_order_item
 on public.production_jobs(order_item_id)
 where order_item_id is not null;

create or replace function public.start_order_item_assembly(p_order_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  oi public.order_items%rowtype;
  o public.orders%rowtype;
  r public.manufacturing_recipes%rowtype;
  v_job uuid;
  v_job_no text;
  v_cost record;
  i record;
  v_required numeric;
begin
  if not public.has_admin_permission('production','create') then
    raise exception 'Production create permission required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('newindia-order-assembly-' || p_order_item_id::text));

  select id into v_job
  from public.production_jobs
  where order_item_id=p_order_item_id
  order by created_at desc
  limit 1;
  if v_job is not null then return v_job; end if;

  select * into oi from public.order_items where id=p_order_item_id for update;
  if not found then raise exception 'Order item not found'; end if;
  if oi.item_type='custom' then
    raise exception 'Custom configurations create their production job automatically';
  end if;
  if oi.variant_id is null then raise exception 'This order item has no product variant'; end if;

  select * into o from public.orders where id=oi.order_id;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('confirmed','processing') then
    raise exception 'Confirm the order before starting assembly';
  end if;

  select * into r
  from public.manufacturing_recipes
  where variant_id=oi.variant_id and status='active';
  if not found then raise exception 'Create and activate a recipe for this product first'; end if;

  select * into v_cost from public.manufacturing_recipe_costs(r.id);
  if v_cost.item_count=0 then raise exception 'Recipe has no materials'; end if;
  if v_cost.buildable_qty<oi.quantity then
    raise exception 'Only % unit(s) can be assembled with current component stock',v_cost.buildable_qty;
  end if;

  v_job_no:='ASM-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.manufacturing_job_sequence')::text,5,'0');
  insert into public.production_jobs(
    job_number,order_id,order_item_id,product_name,quantity,status,priority,
    internal_notes,build_mode,manufacturing_recipe_id,target_variant_id,
    estimated_unit_cost,non_material_unit_cost,bom_snapshot
  ) values (
    v_job_no,o.id,oi.id,oi.name_snapshot,oi.quantity,'bom_ready','normal',
    'Assembly started from order '||o.order_number,'make_to_order',r.id,r.variant_id,
    v_cost.total_cost,r.labour_cost+r.overhead_cost+r.packaging_cost,'[]'::jsonb
  ) returning id into v_job;

  for i in
    select ri.*,c.name component_name,c.category,c.sku component_sku,c.cost_price component_cost,
      e.name enclosure_name,e.sku enclosure_sku,e.cost_price enclosure_cost,
      p.name product_name,pv.title variant_title,pv.sku variant_sku,pv.cost_price variant_cost
    from public.manufacturing_recipe_items ri
    left join public.components c on c.id=ri.component_id
    left join public.enclosures e on e.id=ri.enclosure_id
    left join public.product_variants pv on pv.id=ri.variant_id
    left join public.products p on p.id=pv.product_id
    where ri.recipe_id=r.id
    order by ri.sort_order
  loop
    v_required:=i.quantity*(1+i.wastage_percent/100)*oi.quantity;
    insert into public.production_bom_items(
      production_job_id,recipe_item_id,component_id,enclosure_id,variant_id,
      component_category,component_name,sku_snapshot,quantity,unit,
      unit_cost_snapshot,wastage_percent
    ) values (
      v_job,i.id,i.component_id,i.enclosure_id,i.variant_id,
      coalesce(i.category,case when i.enclosure_id is not null then 'Enclosure' else 'Finished product' end),
      coalesce(i.component_name,i.enclosure_name,i.product_name||' · '||i.variant_title),
      coalesce(i.component_sku,i.enclosure_sku,i.variant_sku),v_required,i.unit,
      coalesce(i.component_cost,i.enclosure_cost,i.variant_cost,0),i.wastage_percent
    );
    insert into public.inventory_reservations(
      order_id,order_item_id,production_job_id,component_id,enclosure_id,variant_id,quantity,status
    ) values (
      o.id,oi.id,v_job,i.component_id,i.enclosure_id,i.variant_id,v_required,'reserved'
    );
  end loop;

  if o.status='confirmed' and public.has_admin_permission('orders','edit') then
    update public.orders set status='processing' where id=o.id;
    insert into public.order_status_history(order_id,from_status,to_status,note,changed_by)
    values(o.id,'confirmed','processing','Assembly job '||v_job_no||' started from order control center',auth.uid());
  end if;

  return v_job;
end;
$$;

revoke all on function public.start_order_item_assembly(uuid) from public,anon;
grant execute on function public.start_order_item_assembly(uuid) to authenticated;

comment on function public.start_order_item_assembly(uuid) is
 'Creates one recipe-backed make-to-order assembly job for an eligible order item and reserves its BOM materials.';

-- Deployment trigger: order assembly workflow verified on 2026-09-19.

-- Allow production planning before every material is in stock, while keeping
-- reservation and assembly transitions protected.

create or replace function public.reserve_production_job_materials(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  j public.production_jobs%rowtype;
  b record;
  v_on_hand numeric;
  v_other_reserved numeric;
  v_job_reserved numeric;
  v_needed numeric;
begin
  if not (
    public.has_admin_permission('production','create') or
    public.has_admin_permission('production','edit')
  ) then
    raise exception 'Production create or edit permission required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('newindia-production-reserve-'||p_job_id::text));
  select * into j from public.production_jobs where id=p_job_id for update;
  if not found then raise exception 'Production job not found'; end if;
  if j.status in ('completed','cancelled') then
    raise exception 'Materials cannot be reserved for a % job',j.status;
  end if;

  if not exists(select 1 from public.production_bom_items where production_job_id=p_job_id) then
    raise exception 'Production job has no BOM materials';
  end if;

  -- Validate the whole BOM first so reservation remains all-or-nothing.
  for b in
    select * from public.production_bom_items
    where production_job_id=p_job_id
    order by created_at,id
  loop
    select coalesce(sum(ir.quantity),0) into v_job_reserved
    from public.inventory_reservations ir
    where ir.production_job_id=p_job_id and ir.status='reserved'
      and ir.component_id is not distinct from b.component_id
      and ir.enclosure_id is not distinct from b.enclosure_id
      and ir.variant_id is not distinct from b.variant_id;
    v_needed:=greatest(coalesce(b.required_qty,b.quantity,0)-v_job_reserved,0);
    if v_needed=0 then continue; end if;

    if b.component_id is not null then
      select c.stock_qty into v_on_hand from public.components c where c.id=b.component_id for update;
    elsif b.enclosure_id is not null then
      select e.stock_qty into v_on_hand from public.enclosures e where e.id=b.enclosure_id for update;
    elsif b.variant_id is not null then
      select v.stock_qty into v_on_hand from public.product_variants v where v.id=b.variant_id for update;
    else
      raise exception 'BOM material % is not linked to inventory',b.component_name;
    end if;

    select coalesce(sum(ir.quantity),0) into v_other_reserved
    from public.inventory_reservations ir
    where ir.status='reserved' and ir.production_job_id is distinct from p_job_id
      and ((b.component_id is not null and ir.component_id=b.component_id)
        or (b.enclosure_id is not null and ir.enclosure_id=b.enclosure_id)
        or (b.variant_id is not null and ir.variant_id=b.variant_id));

    if coalesce(v_on_hand,0)-v_other_reserved<v_needed then
      raise exception 'Not enough stock for %. Need %, available %',
        b.component_name,v_needed,greatest(coalesce(v_on_hand,0)-v_other_reserved,0);
    end if;
  end loop;

  for b in
    select * from public.production_bom_items
    where production_job_id=p_job_id
    order by created_at,id
  loop
    select coalesce(sum(ir.quantity),0) into v_job_reserved
    from public.inventory_reservations ir
    where ir.production_job_id=p_job_id and ir.status='reserved'
      and ir.component_id is not distinct from b.component_id
      and ir.enclosure_id is not distinct from b.enclosure_id
      and ir.variant_id is not distinct from b.variant_id;
    v_needed:=greatest(coalesce(b.required_qty,b.quantity,0)-v_job_reserved,0);
    if v_needed>0 then
      insert into public.inventory_reservations(
        order_id,order_item_id,production_job_id,component_id,enclosure_id,variant_id,quantity,status
      ) values (
        j.order_id,j.order_item_id,j.id,b.component_id,b.enclosure_id,b.variant_id,v_needed,'reserved'
      );
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.reserve_production_job_materials(uuid) from public,anon;
grant execute on function public.reserve_production_job_materials(uuid) to authenticated;

create or replace function public.create_manufacturing_batch(
  p_recipe_id uuid,p_quantity numeric,p_due_date date default null,
  p_priority text default 'normal',p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.manufacturing_recipes%rowtype;
  v_job uuid;
  v_job_no text;
  v_product text;
  v_cost record;
  i record;
  v_required numeric;
begin
  if not public.has_admin_permission('production','create') then raise exception 'Production create permission required'; end if;
  if coalesce(p_quantity,0)<=0 then raise exception 'Assembly quantity must be positive'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('newindia-manufacturing-build'));
  select * into r from public.manufacturing_recipes where id=p_recipe_id and status='active';
  if not found then raise exception 'An active manufacturing recipe is required'; end if;
  select p.name||case when pv.title<>'Standard' then ' · '||pv.title else '' end
    into v_product from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=r.variant_id;
  select * into v_cost from public.manufacturing_recipe_costs(r.id);
  if v_cost.item_count=0 then raise exception 'Recipe has no materials'; end if;
  v_job_no:='MFG-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.manufacturing_job_sequence')::text,5,'0');
  insert into public.production_jobs(
    job_number,product_name,quantity,status,priority,due_date,internal_notes,build_mode,
    manufacturing_recipe_id,target_variant_id,estimated_unit_cost,non_material_unit_cost,bom_snapshot
  ) values (
    v_job_no,v_product,p_quantity,'bom_ready',coalesce(p_priority,'normal'),p_due_date,p_notes,'make_to_stock',
    r.id,r.variant_id,v_cost.total_cost,r.labour_cost+r.overhead_cost+r.packaging_cost,'[]'::jsonb
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
    where ri.recipe_id=r.id order by ri.sort_order
  loop
    v_required:=i.quantity*(1+i.wastage_percent/100)*p_quantity;
    insert into public.production_bom_items(
      production_job_id,recipe_item_id,component_id,enclosure_id,variant_id,component_category,
      component_name,sku_snapshot,quantity,unit,unit_cost_snapshot,wastage_percent
    ) values (
      v_job,i.id,i.component_id,i.enclosure_id,i.variant_id,
      coalesce(i.category,case when i.enclosure_id is not null then 'Enclosure' else 'Finished product' end),
      coalesce(i.component_name,i.enclosure_name,i.product_name||' · '||i.variant_title),
      coalesce(i.component_sku,i.enclosure_sku,i.variant_sku),v_required,i.unit,
      coalesce(i.component_cost,i.enclosure_cost,i.variant_cost,0),i.wastage_percent
    );
  end loop;
  if v_cost.buildable_qty>=p_quantity then perform public.reserve_production_job_materials(v_job); end if;
  return v_job;
end;
$$;

revoke all on function public.create_manufacturing_batch(uuid,numeric,date,text,text) from public,anon;
grant execute on function public.create_manufacturing_batch(uuid,numeric,date,text,text) to authenticated;

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
  if not public.has_admin_permission('production','create') then raise exception 'Production create permission required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('newindia-order-assembly-'||p_order_item_id::text));
  select id into v_job from public.production_jobs where order_item_id=p_order_item_id order by created_at desc limit 1;
  if v_job is not null then return v_job; end if;
  select * into oi from public.order_items where id=p_order_item_id for update;
  if not found then raise exception 'Order item not found'; end if;
  if oi.item_type='custom' then raise exception 'Custom configurations create their production job automatically'; end if;
  if oi.variant_id is null then raise exception 'This order item has no product variant'; end if;
  select * into o from public.orders where id=oi.order_id;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('confirmed','processing') then raise exception 'Confirm the order before starting assembly'; end if;
  select * into r from public.manufacturing_recipes where variant_id=oi.variant_id and status='active';
  if not found then raise exception 'Create and activate a recipe for this product first'; end if;
  select * into v_cost from public.manufacturing_recipe_costs(r.id);
  if v_cost.item_count=0 then raise exception 'Recipe has no materials'; end if;
  v_job_no:='ASM-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.manufacturing_job_sequence')::text,5,'0');
  insert into public.production_jobs(
    job_number,order_id,order_item_id,product_name,quantity,status,priority,internal_notes,
    build_mode,manufacturing_recipe_id,target_variant_id,estimated_unit_cost,non_material_unit_cost,bom_snapshot
  ) values (
    v_job_no,o.id,oi.id,oi.name_snapshot,oi.quantity,'bom_ready','normal','Assembly started from order '||o.order_number,
    'make_to_order',r.id,r.variant_id,v_cost.total_cost,r.labour_cost+r.overhead_cost+r.packaging_cost,'[]'::jsonb
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
    where ri.recipe_id=r.id order by ri.sort_order
  loop
    v_required:=i.quantity*(1+i.wastage_percent/100)*oi.quantity;
    insert into public.production_bom_items(
      production_job_id,recipe_item_id,component_id,enclosure_id,variant_id,component_category,
      component_name,sku_snapshot,quantity,unit,unit_cost_snapshot,wastage_percent
    ) values (
      v_job,i.id,i.component_id,i.enclosure_id,i.variant_id,
      coalesce(i.category,case when i.enclosure_id is not null then 'Enclosure' else 'Finished product' end),
      coalesce(i.component_name,i.enclosure_name,i.product_name||' · '||i.variant_title),
      coalesce(i.component_sku,i.enclosure_sku,i.variant_sku),v_required,i.unit,
      coalesce(i.component_cost,i.enclosure_cost,i.variant_cost,0),i.wastage_percent
    );
  end loop;
  if v_cost.buildable_qty>=oi.quantity then perform public.reserve_production_job_materials(v_job); end if;
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

comment on function public.reserve_production_job_materials(uuid) is
 'Atomically reserves every outstanding BOM material for a planned production job once stock is available.';

-- Deployment trigger: planned assembly workflow verified on 2026-09-19.

-- Versioned ACDB/DCDB/combo recipes, costing and make-to-stock production.

create sequence if not exists public.manufacturing_job_sequence start 1;

create table public.manufacturing_recipes(
 id uuid primary key default gen_random_uuid(),
 variant_id uuid not null references public.product_variants(id) on delete restrict,
 name text not null,
 box_type text not null check(box_type in('acdb','dcdb','combo')),
 version integer not null default 1 check(version>0),
 status text not null default 'draft' check(status in('draft','active','archived')),
 labour_cost numeric not null default 0 check(labour_cost>=0),
 overhead_cost numeric not null default 0 check(overhead_cost>=0),
 packaging_cost numeric not null default 0 check(packaging_cost>=0),
 target_margin_percent numeric not null default 25 check(target_margin_percent>=0 and target_margin_percent<100),
 notes text,
 created_by uuid references public.profiles(id) on delete set null default auth.uid(),
 updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(variant_id,version)
);
create unique index manufacturing_one_active_recipe on public.manufacturing_recipes(variant_id) where status='active';
create index manufacturing_recipes_status on public.manufacturing_recipes(status,box_type);

create table public.manufacturing_recipe_items(
 id uuid primary key default gen_random_uuid(),
 recipe_id uuid not null references public.manufacturing_recipes(id) on delete cascade,
 component_id uuid references public.components(id) on delete restrict,
 enclosure_id uuid references public.enclosures(id) on delete restrict,
 variant_id uuid references public.product_variants(id) on delete restrict,
 quantity numeric not null check(quantity>0),
 wastage_percent numeric not null default 0 check(wastage_percent>=0 and wastage_percent<=100),
 unit text not null default 'pcs',
 notes text,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint manufacturing_recipe_item_one_source check(num_nonnulls(component_id,enclosure_id,variant_id)=1)
);
create index manufacturing_recipe_items_recipe on public.manufacturing_recipe_items(recipe_id,sort_order,id);
create unique index manufacturing_recipe_component_once on public.manufacturing_recipe_items(recipe_id,component_id) where component_id is not null;
create unique index manufacturing_recipe_enclosure_once on public.manufacturing_recipe_items(recipe_id,enclosure_id) where enclosure_id is not null;
create unique index manufacturing_recipe_variant_once on public.manufacturing_recipe_items(recipe_id,variant_id) where variant_id is not null;

alter table public.production_jobs alter column order_id drop not null;
alter table public.production_jobs alter column order_item_id drop not null;
alter table public.production_jobs add column manufacturing_recipe_id uuid references public.manufacturing_recipes(id) on delete set null;
alter table public.production_jobs add column target_variant_id uuid references public.product_variants(id) on delete restrict;
alter table public.production_jobs add column build_mode text not null default 'make_to_order' check(build_mode in('make_to_order','make_to_stock'));
alter table public.production_jobs add column estimated_unit_cost numeric;
alter table public.production_jobs add column non_material_unit_cost numeric not null default 0;
alter table public.production_jobs add column actual_material_cost numeric;
alter table public.production_jobs add column actual_unit_cost numeric;
alter table public.production_jobs add column output_recorded_at timestamptz;
create index production_jobs_recipe on public.production_jobs(manufacturing_recipe_id,created_at desc);
create index production_jobs_target_variant on public.production_jobs(target_variant_id,status);

alter table public.production_bom_items add column recipe_item_id uuid references public.manufacturing_recipe_items(id) on delete set null;
alter table public.production_bom_items add column enclosure_id uuid references public.enclosures(id) on delete restrict;
alter table public.production_bom_items add column variant_id uuid references public.product_variants(id) on delete restrict;
alter table public.production_bom_items add column wastage_percent numeric not null default 0;

alter table public.inventory_reservations alter column order_id drop not null;
alter table public.inventory_reservations add constraint inventory_reservation_has_owner check(order_id is not null or production_job_id is not null) not valid;
alter table public.inventory_reservations validate constraint inventory_reservation_has_owner;

alter table public.manufacturing_recipes enable row level security;
alter table public.manufacturing_recipe_items enable row level security;
create policy manufacturing_recipes_select on public.manufacturing_recipes for select to authenticated
 using(public.has_admin_permission('production','view'));
create policy manufacturing_recipes_insert on public.manufacturing_recipes for insert to authenticated
 with check(public.has_admin_permission('production','create'));
create policy manufacturing_recipes_update on public.manufacturing_recipes for update to authenticated
 using(public.has_admin_permission('production','edit')) with check(public.has_admin_permission('production','edit'));
create policy manufacturing_recipes_delete on public.manufacturing_recipes for delete to authenticated
 using(public.has_admin_permission('production','delete'));
create policy manufacturing_recipe_items_select on public.manufacturing_recipe_items for select to authenticated
 using(public.has_admin_permission('production','view'));
create policy manufacturing_recipe_items_insert on public.manufacturing_recipe_items for insert to authenticated
 with check(public.has_admin_permission('production','create') or public.has_admin_permission('production','edit'));
create policy manufacturing_recipe_items_update on public.manufacturing_recipe_items for update to authenticated
 using(public.has_admin_permission('production','edit')) with check(public.has_admin_permission('production','edit'));
create policy manufacturing_recipe_items_delete on public.manufacturing_recipe_items for delete to authenticated
 using(public.has_admin_permission('production','edit') or public.has_admin_permission('production','delete'));
revoke all on public.manufacturing_recipes,public.manufacturing_recipe_items from public,anon;
grant select,insert,update,delete on public.manufacturing_recipes,public.manufacturing_recipe_items to authenticated;

create trigger set_manufacturing_recipes_updated_at before update on public.manufacturing_recipes
 for each row execute function public.set_updated_at();
create trigger set_manufacturing_recipe_items_updated_at before update on public.manufacturing_recipe_items
 for each row execute function public.set_updated_at();

create or replace function public.manufacturing_recipe_costs(p_recipe_id uuid default null)
returns table(
 recipe_id uuid,variant_id uuid,recipe_name text,box_type text,version integer,status text,
 material_cost numeric,labour_cost numeric,overhead_cost numeric,packaging_cost numeric,total_cost numeric,
 target_margin_percent numeric,recommended_selling_price numeric,current_selling_price numeric,current_stock numeric,
 gross_margin_percent numeric,buildable_qty numeric,item_count bigint,shortage_count bigint
) language plpgsql security definer set search_path='' stable as $$
begin
 if not public.has_admin_permission('production','view') then raise exception 'Production view permission required'; end if;
 return query
 with lines as (
  select r.id recipe_id,i.id,
   i.quantity*(1+i.wastage_percent/100) required_qty,
   coalesce(c.cost_price,e.cost_price,v.cost_price,0) unit_cost,
   greatest(coalesce(c.stock_qty,e.stock_qty,v.stock_qty,0)-coalesce((select sum(ir.quantity) from public.inventory_reservations ir where ir.status='reserved' and ((i.component_id is not null and ir.component_id=i.component_id) or (i.enclosure_id is not null and ir.enclosure_id=i.enclosure_id) or (i.variant_id is not null and ir.variant_id=i.variant_id))),0),0) stock_qty
  from public.manufacturing_recipes r join public.manufacturing_recipe_items i on i.recipe_id=r.id
  left join public.components c on c.id=i.component_id
  left join public.enclosures e on e.id=i.enclosure_id
  left join public.product_variants v on v.id=i.variant_id
  where p_recipe_id is null or r.id=p_recipe_id
 ), totals as (
  select l.recipe_id,sum(l.required_qty*l.unit_cost) material_cost,
   min(floor(l.stock_qty/nullif(l.required_qty,0))) buildable_qty,count(*) item_count,
   count(*) filter(where l.stock_qty<l.required_qty) shortage_count
  from lines l group by l.recipe_id
 )
 select r.id,r.variant_id,r.name,r.box_type,r.version,r.status,
  coalesce(t.material_cost,0),r.labour_cost,r.overhead_cost,r.packaging_cost,
  coalesce(t.material_cost,0)+r.labour_cost+r.overhead_cost+r.packaging_cost,
  r.target_margin_percent,
  round((coalesce(t.material_cost,0)+r.labour_cost+r.overhead_cost+r.packaging_cost)/nullif(1-r.target_margin_percent/100,0),2),
  pv.selling_price,pv.stock_qty,
  case when pv.selling_price>0 then round((pv.selling_price-(coalesce(t.material_cost,0)+r.labour_cost+r.overhead_cost+r.packaging_cost))/pv.selling_price*100,2) else 0 end,
  coalesce(t.buildable_qty,0),coalesce(t.item_count,0),coalesce(t.shortage_count,0)
 from public.manufacturing_recipes r join public.product_variants pv on pv.id=r.variant_id
 left join totals t on t.recipe_id=r.id
 where p_recipe_id is null or r.id=p_recipe_id order by r.updated_at desc;
end $$;
revoke all on function public.manufacturing_recipe_costs(uuid) from public,anon;
grant execute on function public.manufacturing_recipe_costs(uuid) to authenticated;

create or replace function public.manufacturing_recipe_cost_lines(p_recipe_id uuid)
returns table(
 item_id uuid,item_type text,item_id_reference uuid,item_name text,sku text,unit text,quantity numeric,
 wastage_percent numeric,required_qty numeric,stock_qty numeric,unit_cost numeric,line_cost numeric,shortage numeric,notes text,sort_order integer
) language plpgsql security definer set search_path='' stable as $$
begin
 if not public.has_admin_permission('production','view') then raise exception 'Production view permission required'; end if;
 return query select i.id,
  case when i.component_id is not null then 'component' when i.enclosure_id is not null then 'enclosure' else 'variant' end,
  coalesce(i.component_id,i.enclosure_id,i.variant_id),coalesce(c.name,e.name,p.name||' · '||v.title),coalesce(c.sku,e.sku,v.sku),i.unit,i.quantity,i.wastage_percent,
  i.quantity*(1+i.wastage_percent/100),greatest(coalesce(c.stock_qty,e.stock_qty,v.stock_qty,0)-coalesce((select sum(ir.quantity) from public.inventory_reservations ir where ir.status='reserved' and ((i.component_id is not null and ir.component_id=i.component_id) or (i.enclosure_id is not null and ir.enclosure_id=i.enclosure_id) or (i.variant_id is not null and ir.variant_id=i.variant_id))),0),0),coalesce(c.cost_price,e.cost_price,v.cost_price,0),
  i.quantity*(1+i.wastage_percent/100)*coalesce(c.cost_price,e.cost_price,v.cost_price,0),
  greatest(i.quantity*(1+i.wastage_percent/100)-greatest(coalesce(c.stock_qty,e.stock_qty,v.stock_qty,0)-coalesce((select sum(ir.quantity) from public.inventory_reservations ir where ir.status='reserved' and ((i.component_id is not null and ir.component_id=i.component_id) or (i.enclosure_id is not null and ir.enclosure_id=i.enclosure_id) or (i.variant_id is not null and ir.variant_id=i.variant_id))),0),0),0),i.notes,i.sort_order
 from public.manufacturing_recipe_items i
 left join public.components c on c.id=i.component_id
 left join public.enclosures e on e.id=i.enclosure_id
 left join public.product_variants v on v.id=i.variant_id
 left join public.products p on p.id=v.product_id
 where i.recipe_id=p_recipe_id order by i.sort_order,i.created_at;
end $$;
revoke all on function public.manufacturing_recipe_cost_lines(uuid) from public,anon;
grant execute on function public.manufacturing_recipe_cost_lines(uuid) to authenticated;

create or replace function public.save_manufacturing_recipe(
 p_recipe_id uuid,p_variant_id uuid,p_name text,p_box_type text,p_status text,p_labour_cost numeric,
 p_overhead_cost numeric,p_packaging_cost numeric,p_target_margin_percent numeric,p_notes text,p_items jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_version integer; v_item jsonb; v_locked boolean:=false;
begin
 if not (public.has_admin_permission('production','create') or public.has_admin_permission('production','edit')) then raise exception 'Production edit permission required'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Recipe name is required'; end if;
 if p_box_type not in('acdb','dcdb','combo') or p_status not in('draft','active','archived') then raise exception 'Invalid recipe type or status'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one BOM item'; end if;
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
   labour_cost=coalesce(p_labour_cost,0),overhead_cost=coalesce(p_overhead_cost,0),packaging_cost=coalesce(p_packaging_cost,0),target_margin_percent=coalesce(p_target_margin_percent,25),notes=nullif(trim(p_notes),''),updated_by=auth.uid()
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
 return v_id;
end $$;
revoke all on function public.save_manufacturing_recipe(uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,text,jsonb) from public,anon;
grant execute on function public.save_manufacturing_recipe(uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,text,jsonb) to authenticated;

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
  insert into public.production_bom_items(production_job_id,recipe_item_id,component_id,enclosure_id,variant_id,component_category,component_name,sku_snapshot,quantity,required_qty,unit,unit_cost_snapshot,wastage_percent)
  values(v_job,i.id,i.component_id,i.enclosure_id,i.variant_id,coalesce(i.category,case when i.enclosure_id is not null then 'Enclosure' else 'Finished product' end),coalesce(i.component_name,i.enclosure_name,i.product_name||' · '||i.variant_title),coalesce(i.component_sku,i.enclosure_sku,i.variant_sku),v_required,v_required,i.unit,coalesce(i.component_cost,i.enclosure_cost,i.variant_cost,0),i.wastage_percent);
  insert into public.inventory_reservations(order_id,production_job_id,component_id,enclosure_id,variant_id,quantity,status)
  values(null,v_job,i.component_id,i.enclosure_id,i.variant_id,v_required,'reserved');
 end loop;
 return v_job;
end $$;
revoke all on function public.create_manufacturing_batch(uuid,numeric,date,text,text) from public,anon;
grant execute on function public.create_manufacturing_batch(uuid,numeric,date,text,text) to authenticated;

create or replace function public.consume_production_inventory(p_job_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r record; v_movement uuid; v_type text; v_id uuid; v_total numeric:=0; v_line_cost numeric;
begin
 for r in select * from public.inventory_reservations where production_job_id=p_job_id and status='reserved' order by id for update loop
  if r.component_id is not null then v_type:='component';v_id:=r.component_id;update public.components set stock_qty=stock_qty-r.quantity,updated_at=now() where id=r.component_id and stock_qty>=r.quantity;
  elsif r.enclosure_id is not null then v_type:='enclosure';v_id:=r.enclosure_id;update public.enclosures set stock_qty=stock_qty-r.quantity,updated_at=now() where id=r.enclosure_id and stock_qty>=r.quantity;
  elsif r.variant_id is not null then v_type:='variant';v_id:=r.variant_id;update public.product_variants set stock_qty=stock_qty-r.quantity,updated_at=now() where id=r.variant_id and stock_qty>=r.quantity;
  else continue; end if;
  if not found then raise exception 'Insufficient % stock while completing production',v_type; end if;
  insert into public.inventory_movements(variant_id,component_id,enclosure_id,movement_type,quantity,reference_type,reference_id,note)
   values(case when v_type='variant' then v_id end,case when v_type='component' then v_id end,case when v_type='enclosure' then v_id end,'production_consumption',-r.quantity,'production_job',p_job_id,'Reserved stock consumed by assembly') returning id into v_movement;
  v_line_cost:=public.allocate_fifo_layers(v_type,v_id,r.quantity,v_movement); v_total:=v_total+v_line_cost;
  update public.inventory_reservations set status='consumed',updated_at=now() where id=r.id;
 end loop;
 update public.production_jobs set actual_material_cost=v_total where id=p_job_id;
end $$;
revoke all on function public.consume_production_inventory(uuid) from public,anon,authenticated;

create or replace function public.inventory_production_status_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_unit_cost numeric; v_movement uuid; v_lot text;
begin
 if new.status is distinct from old.status then
  if new.status='completed' then
   perform public.consume_production_inventory(new.id);
   if new.target_variant_id is not null and new.output_recorded_at is null then
    select (coalesce(actual_material_cost,0)/nullif(quantity,0))+coalesce(non_material_unit_cost,0) into v_unit_cost from public.production_jobs where id=new.id;
    update public.product_variants set stock_qty=stock_qty+new.quantity,cost_price=v_unit_cost,updated_at=now() where id=new.target_variant_id;
    insert into public.inventory_movements(variant_id,movement_type,quantity,reference_type,reference_id,note,fifo_cost,fifo_allocated)
    values(new.target_variant_id,'production_output',new.quantity,'production_job',new.id,'Finished goods received from production',v_unit_cost*new.quantity,true) returning id into v_movement;
    v_lot:='MFG-'||upper(left(replace(new.id::text,'-',''),10));
    insert into public.inventory_lots(variant_id,lot_number,quantity_received,quantity_remaining,unit_cost,source_type,source_id,notes)
    values(new.target_variant_id,v_lot,new.quantity,new.quantity,v_unit_cost,'production_job',new.id,'Finished goods from '||new.job_number);
    update public.production_jobs set actual_unit_cost=v_unit_cost,output_recorded_at=now() where id=new.id;
   end if;
  end if;
  if new.status='cancelled' then update public.inventory_reservations set status='released',updated_at=now() where production_job_id=new.id and status='reserved'; end if;
 end if;
 return new;
end $$;

comment on table public.manufacturing_recipes is 'Versioned manufacturing BOM headers for ACDB, DCDB and finished-product combos.';
comment on function public.create_manufacturing_batch(uuid,numeric,date,text,text) is 'Creates a make-to-stock production job and reserves its versioned recipe materials.';

CREATE OR REPLACE FUNCTION public.consume_standard_inventory_for_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  for r in select * from public.inventory_reservations where order_id=p_order_id and variant_id is not null and status='reserved' for update loop
    update public.product_variants set stock_qty=stock_qty-r.quantity,updated_at=now() where id=r.variant_id and stock_qty>=r.quantity;
    if not found then raise exception 'Insufficient product stock while consuming reservation'; end if;
    insert into public.inventory_movements(variant_id,movement_type,quantity,reference_type,reference_id,note) values(r.variant_id,'sale',-r.quantity,'order',p_order_id,'Reserved stock consumed on shipment');
    update public.inventory_reservations set status='consumed',updated_at=now() where id=r.id;
  end loop;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.release_inventory_for_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.inventory_reservations set status='released',updated_at=now() where order_id=p_order_id and status='reserved';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reserve_inventory_for_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  oi record;
  elem jsonb;
  v_component uuid;
  v_enclosure uuid;
  v_qty numeric;
  v_stock numeric;
  v_reserved numeric;
  v_job uuid;
begin
  for oi in select * from public.order_items where order_id=p_order_id loop
    if oi.variant_id is not null then
      if not exists(select 1 from public.inventory_reservations where order_item_id=oi.id and variant_id=oi.variant_id and status='reserved') then
        select stock_qty into v_stock from public.product_variants where id=oi.variant_id for update;
        select coalesce(sum(quantity),0) into v_reserved from public.inventory_reservations where variant_id=oi.variant_id and status='reserved';
        if coalesce(v_stock,0)-v_reserved < oi.quantity then raise exception 'Insufficient stock for SKU %',oi.sku_snapshot; end if;
        insert into public.inventory_reservations(order_id,order_item_id,variant_id,quantity) values(p_order_id,oi.id,oi.variant_id,oi.quantity);
      end if;
    elsif oi.custom_configuration_id is not null then
      select id into v_job from public.production_jobs where order_item_id=oi.id order by created_at limit 1;
      for elem in select value from jsonb_array_elements(coalesce((select bom_snapshot from public.custom_configurations where id=oi.custom_configuration_id),'[]'::jsonb)) loop
        begin v_component:=nullif(elem->>'component_id','')::uuid; exception when others then v_component:=null; end;
        begin v_enclosure:=nullif(elem->>'enclosure_id','')::uuid; exception when others then v_enclosure:=null; end;
        begin v_qty:=coalesce(nullif(elem->>'quantity','')::numeric,nullif(elem->>'qty','')::numeric,1)*oi.quantity; exception when others then v_qty:=oi.quantity; end;
        if v_component is not null and not exists(select 1 from public.inventory_reservations where order_item_id=oi.id and component_id=v_component and status='reserved') then
          select stock_qty into v_stock from public.components where id=v_component for update;
          select coalesce(sum(quantity),0) into v_reserved from public.inventory_reservations where component_id=v_component and status='reserved';
          if coalesce(v_stock,0)-v_reserved < v_qty then raise exception 'Insufficient component stock for custom build'; end if;
          insert into public.inventory_reservations(order_id,order_item_id,production_job_id,component_id,quantity) values(p_order_id,oi.id,v_job,v_component,v_qty);
        elsif v_enclosure is not null and not exists(select 1 from public.inventory_reservations where order_item_id=oi.id and enclosure_id=v_enclosure and status='reserved') then
          select stock_qty into v_stock from public.enclosures where id=v_enclosure for update;
          select coalesce(sum(quantity),0) into v_reserved from public.inventory_reservations where enclosure_id=v_enclosure and status='reserved';
          if coalesce(v_stock,0)-v_reserved < v_qty then raise exception 'Insufficient enclosure stock for custom build'; end if;
          insert into public.inventory_reservations(order_id,order_item_id,production_job_id,enclosure_id,quantity) values(p_order_id,oi.id,v_job,v_enclosure,v_qty);
        end if;
      end loop;
    end if;
  end loop;
end;
$function$
;
create table inventory_movements(id uuid default gen_random_uuid(),variant_id uuid,movement_type text,quantity numeric,reference_type text,reference_id uuid,note text);
CREATE OR REPLACE FUNCTION public.inventory_order_status_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status is distinct from old.status then
    if new.status::text='confirmed' then perform public.reserve_inventory_for_order(new.id); end if;
    if new.status::text in ('cancelled','refunded') then perform public.release_inventory_for_order(new.id); end if;
    if new.status::text='shipped' then perform public.consume_standard_inventory_for_order(new.id); end if;
  end if;
  return new;
end;
$function$
;

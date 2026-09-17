-- Standard checkout integrity. Pending website orders reserve standard stock until
-- shipment consumes it or cancellation/refund releases it through existing triggers.
create table nis_private.checkout_results (
 cart_id uuid primary key,user_id uuid not null,order_id uuid not null,response jsonb not null,created_at timestamptz not null default now()
);
alter table nis_private.checkout_results enable row level security;
revoke all on nis_private.checkout_results from public,anon,authenticated;

-- Every cart mutation takes the same parent lock as checkout. A completed cart
-- cannot be repopulated; its private receipt is retained for retry recovery.
create function nis_private.guard_checkout_cart_item() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 for cid in select distinct x from unnest(case when TG_OP='INSERT' then array[new.cart_id] when TG_OP='DELETE' then array[old.cart_id] else array[old.cart_id,new.cart_id] end) x order by x loop
  perform 1 from public.carts where id=cid for update;
  if exists(select 1 from nis_private.checkout_results where cart_id=cid) then raise exception 'This cart has already been checked out'; end if;
 end loop;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
revoke all on function nis_private.guard_checkout_cart_item() from public,anon,authenticated;
create trigger checkout_cart_item_guard before insert or update or delete on public.cart_items for each row execute function nis_private.guard_checkout_cart_item();

create function public.prepare_checkout_cart(p_cart_id uuid,p_items jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); receipt jsonb; item jsonb; variant uuid; config uuid; qty numeric; price numeric;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_cart_id is null then raise exception 'Checkout identifier required'; end if;
 insert into public.carts(id,user_id) values(p_cart_id,uid) on conflict(id) do nothing;
 perform 1 from public.carts where id=p_cart_id and user_id=uid for update;
 if not found then raise exception 'Cart not owned by current user' using errcode='42501'; end if;
 select response into receipt from nis_private.checkout_results where cart_id=p_cart_id and user_id=uid;
 if found then return jsonb_build_object('order',receipt); end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid cart'; end if;
 if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception 'Cart must contain 1 to 100 items'; end if;
 delete from public.cart_items where cart_id=p_cart_id;
 for item in select value from jsonb_array_elements(p_items) loop
  variant:=nullif(item->>'variant_id','')::uuid; config:=nullif(item->>'custom_configuration_id','')::uuid; qty:=(item->>'quantity')::numeric;
  if (variant is null)=(config is null) then raise exception 'Choose one product or configuration'; end if;
  if qty is null or qty::text in ('NaN','Infinity','-Infinity') or qty<=0 or qty>1000000000 or qty<>round(qty,3) then raise exception 'Invalid quantity'; end if;
  if variant is not null then select selling_price into price from public.product_variants where id=variant and is_active;
  else select final_price into price from public.custom_configurations where id=config and user_id=uid; end if;
  if not found then raise exception 'Item unavailable'; end if;
  insert into public.cart_items(cart_id,variant_id,custom_configuration_id,quantity,unit_price,metadata) values(p_cart_id,variant,config,qty,coalesce(price,0),'{}');
 end loop;
 return jsonb_build_object('cart_id',p_cart_id);
end $$;
revoke all on function public.prepare_checkout_cart(uuid,jsonb) from public,anon;
grant execute on function public.prepare_checkout_cart(uuid,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.place_order_from_cart(p_cart_id uuid, p_customer_snapshot jsonb, p_shipping_address jsonb, p_billing_address jsonb, p_business_purchase boolean DEFAULT false, p_company_name text DEFAULT NULL::text, p_gstin text DEFAULT NULL::text, p_po_number text DEFAULT NULL::text, p_payment_method text DEFAULT 'online'::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_grand numeric := 0;
  ci record;
  v_product_name text;
  v_sku text;
  v_unit numeric;
  v_gst_rate numeric;
  v_line_tax numeric;
  v_line_total numeric;
  v_cfg public.custom_configurations%rowtype;
  v_snapshot jsonb;
  v_quote jsonb;
  v_item_type text;
  v_stock numeric;
  v_reserved numeric;
  v_min numeric;
  v_step numeric;
  v_attributes jsonb;
  v_unit_name text;
  v_order_item uuid;
  v_previous jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform 1 from public.carts c where c.id = p_cart_id and c.user_id = v_uid for update;
  if not found then
    raise exception 'Cart not found or not owned by current user';
  end if;

  select response into v_previous from nis_private.checkout_results where cart_id=p_cart_id and user_id=v_uid;
  if found then return v_previous; end if;
  if p_payment_method is null or p_payment_method not in ('online','bank_transfer') then raise exception 'Invalid payment method'; end if;
  -- Lock catalogue rows in a consistent order before any inventory check.
  perform pv.id from public.product_variants pv where pv.id in (select variant_id from public.cart_items where cart_id=p_cart_id) order by pv.id for update;
  perform p.id from public.products p where p.id in (select pv.product_id from public.product_variants pv join public.cart_items lock_item on lock_item.variant_id=pv.id where lock_item.cart_id=p_cart_id) order by p.id for share;

  if not exists (select 1 from public.cart_items where cart_id = p_cart_id) then
    raise exception 'Cart is empty';
  end if;

  insert into public.orders(
    user_id, customer_snapshot, shipping_address, billing_address,
    business_purchase, company_name, gstin, po_number,
    payment_method, notes, subtotal, tax_amount, grand_total
  ) values (
    v_uid, coalesce(p_customer_snapshot,'{}'::jsonb), coalesce(p_shipping_address,'{}'::jsonb), coalesce(p_billing_address,'{}'::jsonb),
    coalesce(p_business_purchase,false), p_company_name, p_gstin, p_po_number,
    p_payment_method, p_notes, 0, 0, 0
  ) returning id, order_number into v_order_id, v_order_number;

  for ci in
    select * from public.cart_items where cart_id = p_cart_id order by created_at
  loop
    if ci.quantity is null or ci.quantity::text in ('NaN','Infinity','-Infinity') or ci.quantity<=0 or ci.quantity>1000000000 then raise exception 'Invalid quantity'; end if;
    if ci.variant_id is not null and ci.custom_configuration_id is not null then raise exception 'Ambiguous cart item'; end if;

    if ci.variant_id is not null then
      select p.name, pv.sku, pv.selling_price, p.gst_rate, pv.stock_qty, p.min_order_qty, pv.attributes, pv.unit
      into v_product_name, v_sku, v_unit, v_gst_rate, v_stock, v_min, v_attributes, v_unit_name
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = ci.variant_id and pv.is_active = true and p.status::text = 'active';

      if not found then raise exception 'One or more products are unavailable'; end if;
      if v_unit is null or v_unit::text in ('NaN','Infinity','-Infinity') or v_unit<=0 then raise exception 'Invalid product price'; end if;
      if v_gst_rate is null or v_gst_rate::text in ('NaN','Infinity','-Infinity') or v_gst_rate<0 or v_gst_rate>100 then raise exception 'Invalid GST rate'; end if;
      if v_min is null or v_min::text in ('NaN','Infinity','-Infinity') or v_min<=0 then raise exception 'Invalid minimum quantity'; end if;
      if ci.quantity<v_min then raise exception 'Minimum order quantity is % for SKU %',v_min,v_sku; end if;
      v_step:=case when coalesce(v_unit_name,'') ~* '^(m|met(er|re)s?|kg|kilograms?|lit(er|re)s?|l)$' then 0.01 else 1 end;
      if v_attributes ? 'quantity_step' then
        begin v_step:=(v_attributes->>'quantity_step')::numeric; exception when others then raise exception 'Invalid quantity increment'; end;
      end if;
      if v_step is null or v_step::text in ('NaN','Infinity','-Infinity') or v_step<=0 or v_step>1000000 or mod(ci.quantity,v_step)<>0 then raise exception 'Invalid quantity increment for SKU %',v_sku; end if;
      select coalesce(sum(quantity),0) into v_reserved from public.inventory_reservations where variant_id=ci.variant_id and status='reserved';
      if v_stock is null or v_stock::text in ('NaN','Infinity','-Infinity') or v_stock-v_reserved<ci.quantity then raise exception 'Insufficient available stock for SKU %',v_sku; end if;
      v_item_type := 'product';
      v_snapshot := jsonb_build_object('variant_id',ci.variant_id,'cart_metadata',ci.metadata);
      v_line_tax := round((v_unit * ci.quantity * v_gst_rate / 100.0)::numeric, 2);
      v_line_total := round((v_unit * ci.quantity + v_line_tax)::numeric, 2);

    elsif ci.custom_configuration_id is not null then
      select * into v_cfg from public.custom_configurations
      where id = ci.custom_configuration_id and user_id = v_uid for share;
      if not found then raise exception 'Custom configuration not found'; end if;
      if v_cfg.pricing_version<>1 or v_cfg.status<>'saved' then
        raise exception 'Configuration must be rebuilt with current server pricing';
      end if;
      if ci.quantity::text in ('NaN','Infinity','-Infinity') or ci.quantity<>trunc(ci.quantity) then
        raise exception 'Invalid custom build quantity';
      end if;
      v_quote:=nis_private.price_custom_configuration(v_cfg.template_id,
        nis_private.configuration_selections(v_cfg.selected_options));
      -- A changed quote requires a rebuild/review; never silently charge a new total.
      if (v_quote->>'subtotal')::numeric is distinct from v_cfg.subtotal
        or (v_quote->>'assembly_charge')::numeric is distinct from v_cfg.assembly_charge
        or (v_quote->>'gst_amount')::numeric is distinct from v_cfg.gst_amount
        or (v_quote->>'final_price')::numeric is distinct from v_cfg.final_price
        or (select jsonb_agg(x order by x->>'value_id') from jsonb_array_elements(v_quote->'bom_snapshot') x)
           is distinct from (select jsonb_agg(x order by x->>'value_id') from jsonb_array_elements(v_cfg.bom_snapshot) x) then
        raise exception 'Configuration pricing or components changed; rebuild and review before checkout';
      end if;
      v_product_name:=coalesce(v_cfg.config_name,'Custom ACDB/DCDB Build');
      v_sku:=null;
      v_unit:=(v_quote->>'subtotal')::numeric+(v_quote->>'assembly_charge')::numeric;
      v_gst_rate:=case when v_unit>0 then round((v_quote->>'gst_amount')::numeric/v_unit*100,2) else 0 end;
      v_item_type:='custom';
      v_snapshot:=v_quote-'selections';
      v_line_tax:=round((v_quote->>'gst_amount')::numeric*ci.quantity,2);
      v_line_total:=round((v_quote->>'final_price')::numeric*ci.quantity,2);
    else
      raise exception 'Invalid cart item';
    end if;

    insert into public.order_items(
      order_id, item_type, variant_id, custom_configuration_id,
      sku_snapshot, name_snapshot, quantity, unit_price, gst_rate,
      tax_amount, line_total, configuration_snapshot
    ) values (
      v_order_id, v_item_type, ci.variant_id, ci.custom_configuration_id,
      v_sku, v_product_name, ci.quantity, v_unit, v_gst_rate,
      v_line_tax, v_line_total, v_snapshot
    ) returning id into v_order_item;
    if ci.variant_id is not null then
      insert into public.inventory_reservations(order_id,order_item_id,variant_id,quantity)
      values(v_order_id,v_order_item,ci.variant_id,ci.quantity);
    end if;

    v_subtotal := v_subtotal + (v_unit * ci.quantity);
    v_tax := v_tax + v_line_tax;
  end loop;

  v_grand := round((v_subtotal + v_tax)::numeric, 2);
  update public.orders set subtotal=round(v_subtotal,2), tax_amount=round(v_tax,2), grand_total=v_grand where id=v_order_id;

  insert into public.payments(order_id, provider, status, amount, payment_method)
  values (v_order_id, null, 'pending', v_grand, p_payment_method);

  delete from public.cart_items where cart_id = p_cart_id;

  v_previous:=jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'grand_total',v_grand,'payment_status','pending');
  insert into nis_private.checkout_results(cart_id,user_id,order_id,response) values(p_cart_id,v_uid,v_order_id,v_previous);
  return v_previous;
end;
$function$;
create policy checkout_guard_insert on public.products as restrictive for insert to anon,authenticated with check (public.is_staff_or_admin() and public.has_admin_permission('products','create'));
create policy checkout_guard_update on public.products as restrictive for update to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('products','edit')) with check (public.is_staff_or_admin() and public.has_admin_permission('products','edit'));
create policy checkout_guard_delete on public.products as restrictive for delete to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('products','delete'));
create policy checkout_guard_insert on public.product_variants as restrictive for insert to anon,authenticated with check (public.is_staff_or_admin() and public.has_admin_permission('products','create'));
create policy checkout_guard_update on public.product_variants as restrictive for update to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('products','edit')) with check (public.is_staff_or_admin() and public.has_admin_permission('products','edit'));
create policy checkout_guard_delete on public.product_variants as restrictive for delete to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('products','delete'));
create policy checkout_guard_insert on public.components as restrictive for insert to anon,authenticated with check (public.is_staff_or_admin() and public.has_admin_permission('components','create'));
create policy checkout_guard_update on public.components as restrictive for update to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('components','edit')) with check (public.is_staff_or_admin() and public.has_admin_permission('components','edit'));
create policy checkout_guard_delete on public.components as restrictive for delete to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('components','delete'));
create policy checkout_guard_insert on public.enclosures as restrictive for insert to anon,authenticated with check (public.is_staff_or_admin() and public.has_admin_permission('inventory','create'));
create policy checkout_guard_update on public.enclosures as restrictive for update to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('inventory','edit')) with check (public.is_staff_or_admin() and public.has_admin_permission('inventory','edit'));
create policy checkout_guard_delete on public.enclosures as restrictive for delete to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('inventory','delete'));
create policy checkout_guard_insert on public.orders as restrictive for insert to anon,authenticated with check (public.is_staff_or_admin() and public.has_admin_permission('orders','create'));
create policy checkout_guard_update on public.orders as restrictive for update to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('orders','edit')) with check (public.is_staff_or_admin() and public.has_admin_permission('orders','edit'));
create policy checkout_guard_delete on public.orders as restrictive for delete to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('orders','delete'));
create policy checkout_guard_insert on public.order_items as restrictive for insert to anon,authenticated with check (public.is_staff_or_admin() and public.has_admin_permission('orders','create'));
create policy checkout_guard_update on public.order_items as restrictive for update to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('orders','edit')) with check (public.is_staff_or_admin() and public.has_admin_permission('orders','edit'));
create policy checkout_guard_delete on public.order_items as restrictive for delete to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('orders','delete'));
create policy checkout_guard_insert on public.payments as restrictive for insert to anon,authenticated with check (public.is_staff_or_admin() and public.has_admin_permission('finance','create'));
create policy checkout_guard_update on public.payments as restrictive for update to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('finance','edit')) with check (public.is_staff_or_admin() and public.has_admin_permission('finance','edit'));
create policy checkout_guard_delete on public.payments as restrictive for delete to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('finance','delete'));
create policy checkout_guard_insert on public.inventory_reservations as restrictive for insert to anon,authenticated with check (public.is_staff_or_admin() and public.has_admin_permission('inventory','create'));
create policy checkout_guard_update on public.inventory_reservations as restrictive for update to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('inventory','edit')) with check (public.is_staff_or_admin() and public.has_admin_permission('inventory','edit'));
create policy checkout_guard_delete on public.inventory_reservations as restrictive for delete to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('inventory','delete'));
create policy checkout_guard_select on public.orders as restrictive for select to anon,authenticated using (user_id=auth.uid() or (public.is_staff_or_admin() and public.has_admin_permission('orders','view')));
create policy checkout_guard_select on public.order_items as restrictive for select to anon,authenticated using (exists(select 1 from public.orders o where o.id=order_items.order_id and o.user_id=auth.uid()) or (public.is_staff_or_admin() and public.has_admin_permission('orders','view')));
create policy checkout_guard_select on public.payments as restrictive for select to anon,authenticated using (exists(select 1 from public.orders o where o.id=payments.order_id and o.user_id=auth.uid()) or (public.is_staff_or_admin() and public.has_admin_permission('finance','view')));
create policy checkout_guard_select on public.inventory_reservations as restrictive for select to anon,authenticated using (public.is_staff_or_admin() and public.has_admin_permission('inventory','view'));
notify pgrst, 'reload schema';

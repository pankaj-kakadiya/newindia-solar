-- F01 / SEC01: server-owned custom pricing. No catalogue activation or price edits.
create schema if not exists nis_private;
revoke all on schema nis_private from public, anon, authenticated;

alter table public.custom_configurations
  add column pricing_version smallint not null default 0;
comment on column public.custom_configurations.pricing_version is
  '0 = legacy/untrusted; 1 = saved by the validated server pricing path. Never buyer-writable.';

-- RLS remains in place for reads. Writes go only through the authenticated RPCs.
revoke insert, update, delete, truncate, references, trigger
  on public.custom_configurations, public.custom_configuration_selections
  from public, anon, authenticated;
do $revoke_columns$
declare t text; cols text;
begin
  foreach t in array array['custom_configurations','custom_configuration_selections'] loop
    select string_agg(quote_ident(column_name), ',') into cols
    from information_schema.columns where table_schema='public' and table_name=t;
    execute format('revoke insert (%s), update (%s), references (%s) on public.%I from public, anon, authenticated',cols,cols,cols,t);
  end loop;
end $revoke_columns$;

create or replace function nis_private.configuration_selections(p_selected jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $function$
declare result jsonb;
begin
  if jsonb_typeof(p_selected) is distinct from 'object' then
    raise exception 'Invalid saved configuration selections';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('value_id',v->'value_id','quantity',coalesce(v->'quantity','1'::jsonb)) order by k.key,ordinality),'[]'::jsonb)
  into result
  from jsonb_each(p_selected) k
  cross join lateral jsonb_array_elements(case when jsonb_typeof(k.value)='array' then k.value else jsonb_build_array(k.value) end) with ordinality a(v,ordinality);
  return result;
end $function$;

create or replace function nis_private.price_custom_configuration(p_template_id uuid,p_selections jsonb)
returns jsonb language plpgsql set search_path = '' as $function$
declare
  t public.configurator_templates%rowtype;
  e public.enclosures%rowtype;
  c public.components%rowtype;
  r record; rule_row record; s jsonb;
  qty numeric; rule_qty numeric; unit_price numeric; tax_rate numeric;
  subtotal numeric:=0; gst numeric:=0; assembly numeric; v_fingerprint text;
  selections jsonb:='{}'; bom jsonb:='[]'; canonical jsonb:='[]';
  name text; sku text; category text; spec jsonb; unit text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_selections) is distinct from 'array' then raise exception 'Selections must be an array'; end if;
  if jsonb_array_length(p_selections) not between 1 and 100 then raise exception 'Invalid selection count'; end if;

  -- Keep catalogue, prices and approval fingerprint consistent until transaction end.
  -- SHARE locks coexist between buyers; catalogue writes wait for short checkout transactions.
  lock table public.configurator_templates, public.configurator_options,
    public.configurator_option_values, public.components, public.enclosures,
    public.configurator_component_compatibility, public.configurator_visual_slots,
    public.configurator_layout_approvals in share mode;
  select * into t from public.configurator_templates where id=p_template_id and is_active;
  if not found then raise exception 'Configurator is inactive or unavailable'; end if;
  if t.preview_settings->>'commerce_mode'='quote' then raise exception 'This configuration requires a quotation'; end if;
  if t.type::text not in ('acdb','dcdb') then raise exception 'Unsupported configurator type'; end if;
  assembly:=t.base_assembly_charge;
  if assembly is null or assembly<0 or assembly::text in ('NaN','Infinity','-Infinity')
    or t.default_gst_rate is null or t.default_gst_rate not between 0 and 100 then
    raise exception 'Invalid template pricing';
  end if;

  for s in select value from jsonb_array_elements(p_selections) loop
    if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s->'value_id') is distinct from 'string'
      or jsonb_typeof(s->'quantity') is distinct from 'number' then
      raise exception 'Each selection requires a value ID and numeric quantity';
    end if;
    qty:=(s->>'quantity')::numeric;
    if qty::text in ('NaN','Infinity','-Infinity') or qty<=0 or qty<>trunc(qty) then raise exception 'Invalid component quantity'; end if;
    select o.*,v.id value_id,v.label value_label,v.value option_value,v.component_id,v.enclosure_id,v.price_adjustment
      into r from public.configurator_options o join public.configurator_option_values v on v.option_id=o.id
      where o.template_id=t.id and v.id=(s->>'value_id')::uuid and v.is_active;
    if not found then raise exception 'Invalid or inactive configurator selection'; end if;
    if exists(select 1 from jsonb_array_elements(canonical) x where x->>'value_id'=r.value_id::text) then raise exception 'Duplicate configurator selection'; end if;
    if r.option_type<>'multi' and selections ? r.option_key then raise exception 'Select only one value for option %',r.option_key; end if;
    if (not r.allow_quantity and qty<>1) or qty<r.min_quantity or qty>r.max_quantity then
      raise exception 'Quantity outside allowed range for option %',r.option_key;
    end if;
    if r.component_id is not null and r.enclosure_id is not null then raise exception 'Ambiguous component/enclosure link'; end if;
    unit_price:=0; tax_rate:=t.default_gst_rate; name:=r.value_label; sku:=null; category:=r.label; spec:='{}'; unit:='pcs';
    if r.component_id is not null then
      select * into c from public.components where id=r.component_id and is_active;
      if not found then raise exception 'Selected component is unavailable'; end if;
      if c.selling_price<=0 or c.visual_settings->>'pricing_status'='quote_required' then raise exception 'Selected component requires a quotation'; end if;
      if (t.type::text='acdb' and c.category ~* '(^|[^a-z])dc([^a-z]|$)')
        or (t.type::text='dcdb' and c.category ~* '(^|[^a-z])ac([^a-z]|$)') then raise exception 'Component AC/DC type is incompatible'; end if;
      unit_price:=c.selling_price;tax_rate:=c.gst_rate;name:=c.name;sku:=c.sku;category:=c.category;spec:=c.specifications;unit:=c.unit;
    elsif r.enclosure_id is not null then
      if e.id is not null or qty<>1 then raise exception 'Select exactly one enclosure'; end if;
      select * into e from public.enclosures where id=r.enclosure_id and is_active;
      if not found then raise exception 'Selected enclosure is unavailable'; end if;
      if e.selling_price<=0 or e.visual_settings->>'pricing_status'='quote_required' then raise exception 'Selected enclosure requires a quotation'; end if;
      if not coalesce(t.type::text=any(e.supported_types),false) then raise exception 'Enclosure does not support this configurator'; end if;
      unit_price:=e.selling_price;tax_rate:=e.gst_rate;name:=e.name;sku:=e.sku;category:='enclosure';spec:=e.specifications;
    end if;
    unit_price:=unit_price+coalesce(r.price_adjustment,0);
    if unit_price is null or unit_price<0 or unit_price::text in ('NaN','Infinity','-Infinity')
      or ((r.component_id is not null or r.enclosure_id is not null) and unit_price<=0)
      or tax_rate is null or tax_rate not between 0 and 100 then raise exception 'Invalid component pricing'; end if;
    unit_price:=round(unit_price,2);
    if (r.component_id is not null or r.enclosure_id is not null) and unit_price<=0 then raise exception 'Component price must be positive'; end if;
    canonical:=canonical||jsonb_build_array(jsonb_build_object('value_id',r.value_id,'quantity',qty));
    selections:=jsonb_set(selections,array[r.option_key],coalesce(selections->r.option_key,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('value_id',r.value_id,'label',r.value_label,'value',r.option_value,'quantity',qty)),true);
    subtotal:=subtotal+unit_price*qty;
    gst:=gst+round(unit_price*qty*tax_rate/100,2);
    -- Internal cost_price is deliberately absent from buyer-owned snapshots and responses.
    if r.component_id is not null or r.enclosure_id is not null or unit_price<>0 then
      bom:=bom||jsonb_build_array(jsonb_build_object('value_id',r.value_id,'component_id',r.component_id,'enclosure_id',r.enclosure_id,'category',category,'component_name',name,'sku',sku,'specifications',spec,'quantity',qty,'unit',unit,'selling_price',unit_price,'gst_rate',tax_rate,'option_key',r.option_key,'option_label',r.label,'selected_label',r.value_label));
    end if;
  end loop;
  if exists(select 1 from public.configurator_options o where o.template_id=t.id and o.required and not selections ? o.option_key) then raise exception 'Required configurator selections are missing'; end if;
  if e.id is null then raise exception 'Select exactly one enclosure'; end if;

  -- Deny rules win; all applicable quantity restrictions must hold. Slot-scoped rules
  -- refer to the server-owned approved layout, never to buyer preview JSON.
  for rule_row in select * from public.configurator_component_compatibility
    where template_id=t.id and (enclosure_id is null or enclosure_id=e.id) loop
    select coalesce(sum((b->>'quantity')::numeric),0) into rule_qty from jsonb_array_elements(bom) b
      where b->>'component_id'=rule_row.component_id::text
      and (rule_row.option_key is null or b->>'option_key'=rule_row.option_key)
      and (rule_row.slot_key is null or exists(select 1 from public.configurator_visual_slots vs
        where vs.template_id=t.id and vs.enclosure_id=e.id and vs.is_active
        and vs.slot_key=rule_row.slot_key and vs.option_key=b->>'option_key'));
    if rule_qty>0 and (not rule_row.allowed or rule_qty<rule_row.min_qty or rule_qty>rule_row.max_qty) then
      raise exception 'Selected component violates compatibility rules';
    end if;
  end loop;
  v_fingerprint:=public.nis_configuration_fingerprint(t.id,e.id);
  if not exists(select 1 from public.configurator_layout_approvals a where a.template_id=t.id and a.enclosure_id=e.id and a.fingerprint=v_fingerprint) then
    raise exception 'Configuration layout requires current technical approval';
  end if;
  assembly:=round(assembly,2);subtotal:=round(subtotal,2);
  gst:=round(gst+round(assembly*t.default_gst_rate/100,2),2);
  if subtotal+assembly+gst<=0 then raise exception 'Configuration must be priced before checkout'; end if;
  return jsonb_build_object('selected_options',selections,'selections',canonical,'bom_snapshot',bom,'subtotal',subtotal,'assembly_charge',assembly,'gst_amount',gst,'final_price',subtotal+assembly+gst,'pricing_version',1,'approval_fingerprint',v_fingerprint,'enclosure_id',e.id);
end $function$;

create or replace function public.save_visual_configuration(p_template_id uuid,p_config_name text,p_selections jsonb,p_preview_snapshot jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare q jsonb; config_id uuid; config_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.is_staff_or_admin() and not coalesce(public.has_admin_permission('configurator','create'),false) then raise exception 'Configurator create permission required'; end if;
  if jsonb_typeof(coalesce(p_preview_snapshot,'{}')) is distinct from 'object' then raise exception 'Invalid preview snapshot'; end if;
  q:=nis_private.price_custom_configuration(p_template_id,p_selections);
  insert into public.custom_configurations(user_id,template_id,config_name,selected_options,bom_snapshot,subtotal,assembly_charge,gst_amount,final_price,status,preview_snapshot,pricing_version)
  values(auth.uid(),p_template_id,p_config_name,q->'selected_options',q->'bom_snapshot',(q->>'subtotal')::numeric,(q->>'assembly_charge')::numeric,(q->>'gst_amount')::numeric,(q->>'final_price')::numeric,'saved',coalesce(p_preview_snapshot,'{}'),1)
  returning id,configuration_code into config_id,config_code;
  insert into public.custom_configuration_selections(configuration_id,option_id,option_value_id,component_id,enclosure_id,quantity,selling_price_snapshot,metadata)
  select config_id,o.id,v.id,v.component_id,v.enclosure_id,(s->>'quantity')::numeric,
    round(coalesce(c.selling_price,e.selling_price,0)+v.price_adjustment,2),jsonb_build_object('option_key',o.option_key,'label',v.label)
  from jsonb_array_elements(q->'selections') s join public.configurator_option_values v on v.id=(s->>'value_id')::uuid
  join public.configurator_options o on o.id=v.option_id
  left join public.components c on c.id=v.component_id left join public.enclosures e on e.id=v.enclosure_id;
  return (q-'selections')||jsonb_build_object('id',config_id,'configuration_code',config_code,'preview_snapshot',coalesce(p_preview_snapshot,'{}'));
end $function$;

create or replace function public.save_custom_configuration(p_template_id uuid,p_config_name text,p_selected_value_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare selections jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('value_id',v,'quantity',1) order by ord),'[]') into selections
  from unnest(p_selected_value_ids) with ordinality x(v,ord);
  return public.save_visual_configuration(p_template_id,p_config_name,selections,'{}');
end $function$;

revoke all on function nis_private.configuration_selections(jsonb),nis_private.price_custom_configuration(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.save_visual_configuration(uuid,text,jsonb,jsonb),public.save_custom_configuration(uuid,text,uuid[]) from public,anon;
grant execute on function public.save_visual_configuration(uuid,text,jsonb,jsonb),public.save_custom_configuration(uuid,text,uuid[]) to authenticated;

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
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform 1 from public.carts c where c.id = p_cart_id and c.user_id = v_uid for update;
  if not found then
    raise exception 'Cart not found or not owned by current user';
  end if;

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
    if ci.quantity <= 0 then raise exception 'Invalid quantity'; end if;

    if ci.variant_id is not null then
      select p.name, pv.sku, pv.selling_price, p.gst_rate
      into v_product_name, v_sku, v_unit, v_gst_rate
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = ci.variant_id and pv.is_active = true and p.status::text = 'active';

      if not found then raise exception 'One or more products are unavailable'; end if;
      if v_unit < 0 then raise exception 'Invalid product price'; end if;
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
    );

    v_subtotal := v_subtotal + (v_unit * ci.quantity);
    v_tax := v_tax + v_line_tax;
  end loop;

  v_grand := round((v_subtotal + v_tax)::numeric, 2);
  update public.orders set subtotal=round(v_subtotal,2), tax_amount=round(v_tax,2), grand_total=v_grand where id=v_order_id;

  insert into public.payments(order_id, provider, status, amount, payment_method)
  values (v_order_id, null, 'pending', v_grand, p_payment_method);

  delete from public.cart_items where cart_id = p_cart_id;

  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'grand_total',v_grand,'payment_status','pending');
end;
$function$;

revoke all on function public.place_order_from_cart(uuid,jsonb,jsonb,jsonb,boolean,text,text,text,text,text) from public,anon;
grant execute on function public.place_order_from_cart(uuid,jsonb,jsonb,jsonb,boolean,text,text,text,text,text) to authenticated;

-- Preserve staff-only production costing after removing private costs from buyer snapshots.
CREATE OR REPLACE FUNCTION public.create_production_job_for_custom_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cfg public.custom_configurations%rowtype;
  job_id uuid;
  job_no text;
  elem jsonb;
  cname text;
  cqty numeric;
  cid uuid;
begin
  if new.item_type <> 'custom' or new.custom_configuration_id is null then
    return new;
  end if;

  select * into cfg from public.custom_configurations where id = new.custom_configuration_id;
  if not found then return new; end if;

  job_no := 'JOB-' || replace((select order_number from public.orders where id = new.order_id), 'NIS-', '') || '-' || upper(substr(replace(new.id::text,'-',''),1,6));

  insert into public.production_jobs(
    job_number, order_id, order_item_id, custom_configuration_id,
    product_name, quantity, selected_options_snapshot, bom_snapshot
  ) values (
    job_no, new.order_id, new.id, new.custom_configuration_id,
    new.name_snapshot, new.quantity, cfg.selected_options, cfg.bom_snapshot
  ) returning id into job_id;

  if jsonb_typeof(cfg.bom_snapshot) = 'array' then
    for elem in select value from jsonb_array_elements(cfg.bom_snapshot)
    loop
      cname := coalesce(elem->>'component_name', elem->>'name', elem->>'label', 'Component');
      begin
        cid := nullif(elem->>'component_id','')::uuid;
      exception when others then
        cid := null;
      end;
      begin
        cqty := coalesce(nullif(elem->>'quantity','')::numeric, nullif(elem->>'qty','')::numeric, 1);
      exception when others then
        cqty := 1;
      end;

      insert into public.production_bom_items(
        production_job_id, component_id, component_category, component_name,
        sku_snapshot, specification_snapshot, quantity, unit,
        unit_cost_snapshot, unit_selling_price_snapshot, gst_rate_snapshot
      ) values (
        job_id, cid, coalesce(elem->>'category', elem->>'component_category'), cname,
        coalesce(elem->>'sku', elem->>'sku_snapshot'), coalesce(elem->'specifications', '{}'::jsonb), cqty,
        coalesce(elem->>'unit','pcs'),
        -- Keep internal costing in the staff-only production record, never in buyer BOM JSON.
        case when cid is not null then (select c.cost_price from public.components c where c.id=cid)
          when nullif(elem->>'enclosure_id','') is not null then
            (select e.cost_price from public.enclosures e where e.id=(elem->>'enclosure_id')::uuid)
          else null end,
        case when coalesce(elem->>'selling_price',elem->>'unit_price') ~ '^-?[0-9]+(\.[0-9]+)?$' then coalesce(elem->>'selling_price',elem->>'unit_price')::numeric else null end,
        case when (elem->>'gst_rate') ~ '^-?[0-9]+(\.[0-9]+)?$' then (elem->>'gst_rate')::numeric else null end
      );
    end loop;
  end if;

  return new;
end;
$function$;

-- Test-only schema: column types/defaults captured from the reviewed database.
-- No production data, external triggers, provider calls or production credentials.
-- Cross-module triggers and full application RBAC remain separate integration tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated;
create function public.is_staff_or_admin() returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.staff',true),'')::boolean,false) $$;
create function public.has_admin_permission(text,text) returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.can_create',true),'')::boolean,false) $$;
create type configurator_type as enum ('acdb','dcdb');
create type order_status as enum ('pending','confirmed','processing','ready_to_ship','shipped','delivered','cancelled','refunded');
create type payment_status as enum ('pending','paid','failed','refunded','partial');
create type product_status as enum ('draft','active','archived');
create function next_configuration_code() returns text language sql as $$ select 'TEST-CFG-'||gen_random_uuid()::text $$;
create function next_order_number() returns text language sql as $$ select 'TEST-ORDER-'||gen_random_uuid()::text $$;

create table public.cart_items (
id uuid not null default gen_random_uuid(),
cart_id uuid not null,
variant_id uuid,
custom_configuration_id uuid,
quantity numeric(12,3) not null default 1,
unit_price numeric(12,2) not null,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now()
);

create table public.carts (
id uuid not null default gen_random_uuid(),
user_id uuid,
session_key text,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);

create table public.components (
id uuid not null default gen_random_uuid(),
category text not null,
brand_id uuid,
name text not null,
model text,
sku text,
specifications jsonb not null default '{}'::jsonb,
cost_price numeric(12,2),
selling_price numeric(12,2) not null default 0,
gst_rate numeric(5,2) not null default 18.00,
stock_qty numeric(12,3) not null default 0,
unit text not null default 'pcs'::text,
image_url text,
is_active boolean not null default true,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
visual_role text,
visual_settings jsonb not null default '{}'::jsonb,
low_stock_threshold numeric not null
);

create table public.configurator_component_compatibility (
id uuid not null default gen_random_uuid(),
template_id uuid not null,
enclosure_id uuid,
component_id uuid not null,
option_key text,
slot_key text,
allowed boolean not null default true,
min_qty integer not null default 1,
max_qty integer not null default 1,
rule jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now()
);

create table public.configurator_layout_approvals (
template_id uuid not null,
enclosure_id uuid not null,
fingerprint text not null,
reviewed_by uuid not null,
reviewed_at timestamp with time zone not null default now(),
review_note text not null
);

create table public.configurator_option_values (
id uuid not null default gen_random_uuid(),
option_id uuid not null,
label text not null,
value text not null,
component_id uuid,
enclosure_id uuid,
price_adjustment numeric(12,2) not null default 0,
metadata jsonb not null default '{}'::jsonb,
sort_order integer not null default 0,
is_active boolean not null default true
);

create table public.configurator_options (
id uuid not null default gen_random_uuid(),
template_id uuid not null,
option_key text not null,
label text not null,
option_type text not null,
sort_order integer not null default 0,
required boolean not null default false,
settings jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
allow_quantity boolean not null default false,
min_quantity integer not null default 1,
max_quantity integer not null default 1
);

create table public.configurator_templates (
id uuid not null default gen_random_uuid(),
type configurator_type not null,
name text not null,
slug text not null,
description text,
base_assembly_charge numeric(12,2) not null default 0,
default_gst_rate numeric(5,2) not null default 18.00,
rules jsonb not null default '{}'::jsonb,
is_active boolean not null default true,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
preview_settings jsonb not null default '{}'::jsonb,
version integer not null default 1
);

create table public.configurator_visual_slots (
id uuid not null default gen_random_uuid(),
template_id uuid not null,
enclosure_id uuid not null,
slot_key text not null,
option_key text not null,
slot_index integer not null default 1,
component_category text,
x_pct numeric(7,3) not null default 10,
y_pct numeric(7,3) not null default 10,
width_pct numeric(7,3) not null default 20,
height_pct numeric(7,3) not null default 40,
rotation_deg numeric(7,3) not null default 0,
z_index integer not null default 10,
is_active boolean not null default true,
settings jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);

create table public.custom_configuration_selections (
id uuid not null default gen_random_uuid(),
configuration_id uuid not null,
option_id uuid not null,
option_value_id uuid not null,
component_id uuid,
enclosure_id uuid,
quantity numeric(18,6) not null default 1,
selling_price_snapshot numeric not null default 0,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now()
);

create table public.custom_configurations (
id uuid not null default gen_random_uuid(),
user_id uuid,
template_id uuid not null,
config_name text,
selected_options jsonb not null default '{}'::jsonb,
bom_snapshot jsonb not null default '[]'::jsonb,
subtotal numeric(12,2) not null default 0,
assembly_charge numeric(12,2) not null default 0,
gst_amount numeric(12,2) not null default 0,
final_price numeric(12,2) not null default 0,
status text not null default 'draft'::text,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
configuration_code text default next_configuration_code(),
preview_snapshot jsonb not null default '{}'::jsonb,
preview_image_url text
);

create table public.enclosures (
id uuid not null default gen_random_uuid(),
name text not null,
sku text,
dimensions_mm text,
material text,
ip_rating text,
module_capacity integer,
cost_price numeric(12,2),
selling_price numeric(12,2) not null default 0,
gst_rate numeric(5,2) not null default 18.00,
stock_qty numeric(12,3) not null default 0,
image_url text,
specifications jsonb not null default '{}'::jsonb,
is_active boolean not null default true,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
inside_image_url text,
closed_image_url text,
visual_settings jsonb not null default '{}'::jsonb,
supported_types text[] not null default ARRAY['acdb'::text, 'dcdb'::text],
low_stock_threshold numeric not null
);

create table public.order_items (
id uuid not null default gen_random_uuid(),
order_id uuid not null,
item_type text not null,
variant_id uuid,
custom_configuration_id uuid,
sku_snapshot text,
name_snapshot text not null,
quantity numeric(12,3) not null,
unit_price numeric(12,2) not null,
gst_rate numeric(5,2) not null default 18.00,
tax_amount numeric(12,2) not null default 0,
line_total numeric(12,2) not null,
configuration_snapshot jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now()
);

create table public.orders (
id uuid not null default gen_random_uuid(),
order_number text not null default next_order_number(),
user_id uuid,
customer_snapshot jsonb not null default '{}'::jsonb,
shipping_address jsonb not null default '{}'::jsonb,
billing_address jsonb not null default '{}'::jsonb,
business_purchase boolean not null default false,
company_name text,
gstin text,
po_number text,
status order_status not null default 'pending'::order_status,
payment_status payment_status not null default 'pending'::payment_status,
subtotal numeric(12,2) not null default 0,
discount_amount numeric(12,2) not null default 0,
shipping_amount numeric(12,2) not null default 0,
tax_amount numeric(12,2) not null default 0,
grand_total numeric(12,2) not null default 0,
notes text,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
order_source text not null default 'website'::text,
payment_method text,
admin_notes text,
confirmed_at timestamp with time zone,
shipped_at timestamp with time zone,
delivered_at timestamp with time zone,
customer_account_id uuid
);

create table public.payments (
id uuid not null default gen_random_uuid(),
order_id uuid not null,
provider text,
provider_order_id text,
provider_payment_id text,
status payment_status not null default 'pending'::payment_status,
amount numeric(12,2) not null,
currency text not null default 'INR'::text,
payment_method text,
raw_response jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
reference_no text,
received_at timestamp with time zone,
reconciled_at timestamp with time zone,
reconciled_by uuid,
received_by uuid,
finance_notes text
);

create table public.product_variants (
id uuid not null default gen_random_uuid(),
product_id uuid not null,
sku text not null,
title text not null,
attributes jsonb not null default '{}'::jsonb,
mrp numeric(12,2),
selling_price numeric(12,2) not null,
cost_price numeric(12,2),
stock_qty numeric(12,3) not null default 0,
low_stock_threshold numeric(12,3) not null,
unit text not null default 'pcs'::text,
weight_kg numeric(10,3),
is_active boolean not null default true,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);

create table public.products (
id uuid not null default gen_random_uuid(),
category_id uuid,
brand_id uuid,
name text not null,
slug text not null,
short_description text,
description text,
product_type text not null default 'standard'::text,
status product_status not null default 'draft'::product_status,
hsn_code text,
gst_rate numeric(5,2) not null default 18.00,
warranty_months integer,
datasheet_url text,
installation_guide_url text,
seo_title text,
seo_description text,
featured boolean not null default false,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
specifications jsonb not null default '{}'::jsonb,
inclusions jsonb not null default '[]'::jsonb,
applications jsonb not null default '[]'::jsonb,
product_badges jsonb not null default '[]'::jsonb,
lead_time_days integer not null default 3,
min_order_qty numeric not null default 1,
sort_order integer not null default 0
);

-- Deliberately reproduce the vulnerable table AND column grants to verify revocation.
grant all on all tables in schema public to anon,authenticated;
grant update (subtotal,final_price,bom_snapshot),insert (subtotal,final_price,bom_snapshot) on public.custom_configurations to authenticated;
alter table public.custom_configurations enable row level security;
create policy custom_configs_own_all on public.custom_configurations for all to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.custom_configuration_selections enable row level security;
create policy own_selections on public.custom_configuration_selections for all to authenticated using (exists(select 1 from public.custom_configurations c where c.id=configuration_id and c.user_id=auth.uid())) with check(exists(select 1 from public.custom_configurations c where c.id=configuration_id and c.user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.nis_configuration_fingerprint(t uuid, e uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select md5(jsonb_build_object(
 'template',(select jsonb_build_object('id',id,'type',type,'rules',rules,'canvas',preview_settings->'layouts'->e::text) from public.configurator_templates where id=t),
 'enclosure',(select to_jsonb(x)-'cost_price'-'selling_price'-'stock_qty'-'updated_at'-'created_at'-'low_stock_threshold' from public.enclosures x where id=e),
 'options',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.configurator_options x where template_id=t),
 'values',(select coalesce(jsonb_agg(to_jsonb(x)-'price_adjustment' order by x.id),'[]'::jsonb) from public.configurator_option_values x join public.configurator_options o on o.id=x.option_id where o.template_id=t),
 'components',(select coalesce(jsonb_agg(to_jsonb(c)-'cost_price'-'selling_price'-'stock_qty'-'updated_at'-'created_at'-'low_stock_threshold' order by c.id),'[]'::jsonb) from public.components c where c.id in(select v.component_id from public.configurator_option_values v join public.configurator_options o on o.id=v.option_id where o.template_id=t)),
 'slots',(select coalesce(jsonb_agg(to_jsonb(s)-'id'-'created_at'-'updated_at' order by s.slot_key),'[]'::jsonb) from public.configurator_visual_slots s where template_id=t and enclosure_id=e),
 'rules',(select coalesce(jsonb_agg(to_jsonb(r)-'id'-'created_at' order by r.component_id,r.option_key,r.slot_key,r.enclosure_id),'[]'::jsonb) from public.configurator_component_compatibility r where template_id=t and (enclosure_id=e or enclosure_id is null))
 )::text);
$function$;

create table public.production_bom_items (
id uuid not null default gen_random_uuid(),
production_job_id uuid not null,
component_id uuid,
component_category text,
component_name text not null,
sku_snapshot text,
specification_snapshot jsonb not null default '{}'::jsonb,
quantity numeric not null default 1,
unit text not null default 'pcs'::text,
unit_cost_snapshot numeric,
unit_selling_price_snapshot numeric,
gst_rate_snapshot numeric,
required_qty numeric generated always as (quantity) stored,
picked_qty numeric not null default 0,
issued_qty numeric not null default 0,
is_substitute boolean not null default false,
notes text,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);

create table public.production_jobs (
id uuid not null default gen_random_uuid(),
job_number text not null,
order_id uuid not null,
order_item_id uuid not null,
custom_configuration_id uuid,
product_name text not null,
quantity numeric not null,
status text not null default 'new'::text,
priority text not null default 'normal'::text,
selected_options_snapshot jsonb not null default '{}'::jsonb,
bom_snapshot jsonb not null default '[]'::jsonb,
assigned_to uuid,
due_date date,
internal_notes text,
started_at timestamp with time zone,
completed_at timestamp with time zone,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
qc_checklist jsonb not null default '{"labels_applied": false, "torque_checked": false, "wiring_checked": false, "spd_mcb_verified": false, "continuity_tested": false, "enclosure_cleaned": false, "final_visual_check": false, "components_verified": false}'::jsonb,
qc_notes text,
final_photo_url text,
qc_passed_at timestamp with time zone,
packed_at timestamp with time zone,
ready_to_dispatch_at timestamp with time zone
);

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
        case when (elem->>'cost_price') ~ '^-?[0-9]+(\.[0-9]+)?$' then (elem->>'cost_price')::numeric else null end,
        case when coalesce(elem->>'selling_price',elem->>'unit_price') ~ '^-?[0-9]+(\.[0-9]+)?$' then coalesce(elem->>'selling_price',elem->>'unit_price')::numeric else null end,
        case when (elem->>'gst_rate') ~ '^-?[0-9]+(\.[0-9]+)?$' then (elem->>'gst_rate')::numeric else null end
      );
    end loop;
  end if;

  return new;
end;
$function$;

create trigger create_production_job_for_custom_item after insert on public.order_items for each row execute function public.create_production_job_for_custom_item();

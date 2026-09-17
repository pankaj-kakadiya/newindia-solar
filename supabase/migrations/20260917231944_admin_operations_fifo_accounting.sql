-- Operations-first admin upgrade: FIFO stock layers + double-entry accounting.

insert into public.admin_modules(module_key,label,description,route,sort_order)
values('accounting','Accounting & Ledgers','Double-entry vouchers, ledgers, trial balance and financial statements','/admin/accounting',58)
on conflict(module_key) do update set label=excluded.label,description=excluded.description,route=excluded.route,sort_order=excluded.sort_order;

insert into public.admin_role_permissions(role_key,module_key,can_view,can_create,can_edit,can_delete,can_approve,can_export)
values
 ('admin','accounting',true,true,true,true,true,true),
 ('finance','accounting',true,true,true,false,true,true),
 ('general','accounting',true,false,false,false,false,false)
on conflict(role_key,module_key) do update set
 can_view=excluded.can_view,can_create=excluded.can_create,can_edit=excluded.can_edit,
 can_delete=excluded.can_delete,can_approve=excluded.can_approve,can_export=excluded.can_export,updated_at=now();

create table if not exists public.inventory_lots(
 id uuid primary key default gen_random_uuid(),
 variant_id uuid references public.product_variants(id) on delete restrict,
 component_id uuid references public.components(id) on delete restrict,
 enclosure_id uuid references public.enclosures(id) on delete restrict,
 lot_number text not null,
 received_at timestamptz not null default now(),
 quantity_received numeric not null check(quantity_received>0),
 quantity_remaining numeric not null check(quantity_remaining>=0),
 unit_cost numeric not null default 0 check(unit_cost>=0),
 source_type text,
 source_id uuid,
 supplier_id uuid references public.suppliers(id) on delete set null,
 notes text,
 created_by uuid references public.profiles(id) on delete set null default auth.uid(),
 created_at timestamptz not null default now(),
 constraint inventory_lots_one_item check(num_nonnulls(variant_id,component_id,enclosure_id)=1),
 constraint inventory_lots_remaining_check check(quantity_remaining<=quantity_received)
);
create unique index if not exists inventory_lots_item_lot_unique on public.inventory_lots(
 coalesce(variant_id,'00000000-0000-0000-0000-000000000000'::uuid),
 coalesce(component_id,'00000000-0000-0000-0000-000000000000'::uuid),
 coalesce(enclosure_id,'00000000-0000-0000-0000-000000000000'::uuid),lot_number
);
create index if not exists inventory_lots_variant_fifo on public.inventory_lots(variant_id,received_at,id) where quantity_remaining>0;
create index if not exists inventory_lots_component_fifo on public.inventory_lots(component_id,received_at,id) where quantity_remaining>0;
create index if not exists inventory_lots_enclosure_fifo on public.inventory_lots(enclosure_id,received_at,id) where quantity_remaining>0;

alter table public.inventory_movements add column if not exists fifo_cost numeric not null default 0;
alter table public.inventory_movements add column if not exists fifo_allocated boolean not null default false;

create table if not exists public.inventory_fifo_allocations(
 id uuid primary key default gen_random_uuid(),
 lot_id uuid not null references public.inventory_lots(id) on delete restrict,
 movement_id uuid not null references public.inventory_movements(id) on delete restrict,
 quantity numeric not null check(quantity>0),
 unit_cost numeric not null check(unit_cost>=0),
 total_cost numeric generated always as (quantity*unit_cost) stored,
 created_at timestamptz not null default now(),
 unique(lot_id,movement_id)
);
create index if not exists inventory_fifo_allocations_movement on public.inventory_fifo_allocations(movement_id);

alter table public.inventory_lots enable row level security;
alter table public.inventory_fifo_allocations enable row level security;
drop policy if exists inventory_lots_staff_select on public.inventory_lots;
create policy inventory_lots_staff_select on public.inventory_lots for select to authenticated
 using(public.is_staff_or_admin() and public.has_admin_permission('inventory','view'));
drop policy if exists inventory_fifo_staff_select on public.inventory_fifo_allocations;
create policy inventory_fifo_staff_select on public.inventory_fifo_allocations for select to authenticated
 using(public.is_staff_or_admin() and public.has_admin_permission('inventory','view'));
revoke all on public.inventory_lots,public.inventory_fifo_allocations from public,anon;
grant select on public.inventory_lots,public.inventory_fifo_allocations to authenticated;

-- Convert current stock into opening FIFO layers once. Future positive stock movements create their own layers.
insert into public.inventory_lots(variant_id,lot_number,received_at,quantity_received,quantity_remaining,unit_cost,source_type,notes)
select v.id,'OPEN-'||upper(left(replace(v.id::text,'-',''),10)),coalesce(v.created_at,now()),v.stock_qty,v.stock_qty,coalesce(v.cost_price,0),'opening_balance','Opening stock converted to FIFO'
from public.product_variants v where v.stock_qty>0 and not exists(select 1 from public.inventory_lots l where l.variant_id=v.id);
insert into public.inventory_lots(component_id,lot_number,received_at,quantity_received,quantity_remaining,unit_cost,source_type,notes)
select c.id,'OPEN-'||upper(left(replace(c.id::text,'-',''),10)),coalesce(c.created_at,now()),c.stock_qty,c.stock_qty,coalesce(c.cost_price,0),'opening_balance','Opening stock converted to FIFO'
from public.components c where c.stock_qty>0 and not exists(select 1 from public.inventory_lots l where l.component_id=c.id);
insert into public.inventory_lots(enclosure_id,lot_number,received_at,quantity_received,quantity_remaining,unit_cost,source_type,notes)
select e.id,'OPEN-'||upper(left(replace(e.id::text,'-',''),10)),coalesce(e.created_at,now()),e.stock_qty,e.stock_qty,coalesce(e.cost_price,0),'opening_balance','Opening stock converted to FIFO'
from public.enclosures e where e.stock_qty>0 and not exists(select 1 from public.inventory_lots l where l.enclosure_id=e.id);

create or replace function public.allocate_fifo_layers(p_item_type text,p_item_id uuid,p_quantity numeric,p_movement_id uuid)
returns numeric language plpgsql security definer set search_path='' as $$
declare r record; v_need numeric:=p_quantity; v_take numeric; v_total numeric:=0;
begin
 if coalesce(p_quantity,0)<=0 then raise exception 'FIFO quantity must be positive'; end if;
 for r in
  select * from public.inventory_lots l
  where l.quantity_remaining>0 and (
   (p_item_type='variant' and l.variant_id=p_item_id) or
   (p_item_type='component' and l.component_id=p_item_id) or
   (p_item_type='enclosure' and l.enclosure_id=p_item_id))
  order by l.received_at,l.id for update
 loop
  exit when v_need<=0;
  v_take:=least(v_need,r.quantity_remaining);
  update public.inventory_lots set quantity_remaining=quantity_remaining-v_take where id=r.id;
  insert into public.inventory_fifo_allocations(lot_id,movement_id,quantity,unit_cost)
   values(r.id,p_movement_id,v_take,r.unit_cost);
  v_total:=v_total+(v_take*r.unit_cost); v_need:=v_need-v_take;
 end loop;
 if v_need>0 then raise exception 'FIFO layers are short by % units for % %',v_need,p_item_type,p_item_id; end if;
 update public.inventory_movements set fifo_cost=v_total,fifo_allocated=true where id=p_movement_id;
 return v_total;
end $$;
revoke all on function public.allocate_fifo_layers(text,uuid,numeric,uuid) from public,anon,authenticated;

create or replace function public.adjust_inventory_stock(p_item_type text,p_item_id uuid,p_quantity numeric,p_movement_type text default 'manual_adjustment',p_note text default null,p_reference_type text default null,p_reference_id uuid default null)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_current numeric; v_new numeric; v_cost numeric:=0; v_movement uuid; v_lot text;
begin
 if not public.has_admin_permission('inventory','edit') then raise exception 'Inventory edit permission required'; end if;
 if coalesce(p_quantity,0)=0 then raise exception 'Quantity must be non-zero'; end if;
 if p_item_type='variant' then select stock_qty,coalesce(cost_price,0) into v_current,v_cost from public.product_variants where id=p_item_id for update;
 elsif p_item_type='component' then select stock_qty,coalesce(cost_price,0) into v_current,v_cost from public.components where id=p_item_id for update;
 elsif p_item_type='enclosure' then select stock_qty,coalesce(cost_price,0) into v_current,v_cost from public.enclosures where id=p_item_id for update;
 else raise exception 'Invalid inventory item type'; end if;
 if not found then raise exception 'Inventory item not found'; end if;
 v_new:=coalesce(v_current,0)+p_quantity; if v_new<0 then raise exception 'Insufficient stock'; end if;
 if p_item_type='variant' then update public.product_variants set stock_qty=v_new,updated_at=now() where id=p_item_id;
 elsif p_item_type='component' then update public.components set stock_qty=v_new,updated_at=now() where id=p_item_id;
 else update public.enclosures set stock_qty=v_new,updated_at=now() where id=p_item_id; end if;
 insert into public.inventory_movements(variant_id,component_id,enclosure_id,movement_type,quantity,reference_type,reference_id,note)
 values(case when p_item_type='variant' then p_item_id end,case when p_item_type='component' then p_item_id end,case when p_item_type='enclosure' then p_item_id end,p_movement_type,p_quantity,p_reference_type,p_reference_id,p_note) returning id into v_movement;
 if p_quantity>0 then
  v_lot:=upper(coalesce(nullif(p_reference_type,''),'ADJ'))||'-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||upper(left(replace(v_movement::text,'-',''),5));
  insert into public.inventory_lots(variant_id,component_id,enclosure_id,lot_number,quantity_received,quantity_remaining,unit_cost,source_type,source_id,notes)
  values(case when p_item_type='variant' then p_item_id end,case when p_item_type='component' then p_item_id end,case when p_item_type='enclosure' then p_item_id end,v_lot,p_quantity,p_quantity,v_cost,p_reference_type,p_reference_id,p_note);
 else perform public.allocate_fifo_layers(p_item_type,p_item_id,abs(p_quantity),v_movement); end if;
 return v_new;
end $$;
revoke all on function public.adjust_inventory_stock(text,uuid,numeric,text,text,text,uuid) from public,anon;
grant execute on function public.adjust_inventory_stock(text,uuid,numeric,text,text,text,uuid) to authenticated;

create or replace function public.consume_standard_inventory_for_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r record; v_movement uuid;
begin
 for r in select * from public.inventory_reservations where order_id=p_order_id and variant_id is not null and status='reserved' for update loop
  update public.product_variants set stock_qty=stock_qty-r.quantity,updated_at=now() where id=r.variant_id and stock_qty>=r.quantity;
  if not found then raise exception 'Insufficient product stock while consuming reservation'; end if;
  insert into public.inventory_movements(variant_id,movement_type,quantity,reference_type,reference_id,note)
   values(r.variant_id,'sale',-r.quantity,'order',p_order_id,'Reserved stock consumed on shipment') returning id into v_movement;
  perform public.allocate_fifo_layers('variant',r.variant_id,r.quantity,v_movement);
  update public.inventory_reservations set status='consumed',updated_at=now() where id=r.id;
 end loop;
end $$;
revoke all on function public.consume_standard_inventory_for_order(uuid) from public,anon,authenticated;

create or replace function public.consume_production_inventory(p_job_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r record; v_movement uuid; v_type text; v_id uuid;
begin
 for r in select * from public.inventory_reservations where production_job_id=p_job_id and status='reserved' for update loop
  if r.component_id is not null then v_type:='component';v_id:=r.component_id;update public.components set stock_qty=stock_qty-r.quantity,updated_at=now() where id=r.component_id and stock_qty>=r.quantity;
  elsif r.enclosure_id is not null then v_type:='enclosure';v_id:=r.enclosure_id;update public.enclosures set stock_qty=stock_qty-r.quantity,updated_at=now() where id=r.enclosure_id and stock_qty>=r.quantity;
  else continue; end if;
  if not found then raise exception 'Insufficient stock while consuming production reservation'; end if;
  insert into public.inventory_movements(component_id,enclosure_id,movement_type,quantity,reference_type,reference_id,note)
   values(case when v_type='component' then v_id end,case when v_type='enclosure' then v_id end,'production_consumption',-r.quantity,'production_job',p_job_id,'Reserved stock consumed by assembly') returning id into v_movement;
  perform public.allocate_fifo_layers(v_type,v_id,r.quantity,v_movement);
  update public.inventory_reservations set status='consumed',updated_at=now() where id=r.id;
 end loop;
end $$;
revoke all on function public.consume_production_inventory(uuid) from public,anon,authenticated;

create sequence if not exists public.accounting_entry_sequence start 1;
create table if not exists public.accounting_accounts(
 id uuid primary key default gen_random_uuid(),code text not null unique,name text not null,
 account_group text not null check(account_group in('asset','liability','equity','income','expense')),
 parent_id uuid references public.accounting_accounts(id) on delete restrict,is_system boolean not null default false,
 is_active boolean not null default true,opening_balance numeric not null default 0,opening_side text check(opening_side in('debit','credit')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.accounting_entries(
 id uuid primary key default gen_random_uuid(),entry_number text not null unique,voucher_type text not null,
 voucher_date date not null default current_date,reference_type text,reference_id uuid,reference_number text,narration text,
 status text not null default 'posted' check(status in('draft','posted','cancelled')),
 total_debit numeric not null default 0,total_credit numeric not null default 0,
 created_by uuid references public.profiles(id) on delete set null default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint accounting_entry_balanced check(status='draft' or total_debit=total_credit)
);
create unique index if not exists accounting_source_once on public.accounting_entries(reference_type,reference_id,voucher_type) where reference_id is not null and status='posted';
create index if not exists accounting_entries_date on public.accounting_entries(voucher_date desc,created_at desc);
create table if not exists public.accounting_lines(
 id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.accounting_entries(id) on delete cascade,
 account_id uuid not null references public.accounting_accounts(id) on delete restrict,debit numeric not null default 0,credit numeric not null default 0,
 party_name text,line_note text,created_at timestamptz not null default now(),
 constraint accounting_line_one_side check((debit>0 and credit=0) or (credit>0 and debit=0))
);
create index if not exists accounting_lines_entry on public.accounting_lines(entry_id);
create index if not exists accounting_lines_account on public.accounting_lines(account_id,entry_id);

alter table public.accounting_accounts enable row level security;
alter table public.accounting_entries enable row level security;
alter table public.accounting_lines enable row level security;
create policy accounting_accounts_select on public.accounting_accounts for select to authenticated using(public.is_staff_or_admin() and public.has_admin_permission('accounting','view'));
create policy accounting_entries_select on public.accounting_entries for select to authenticated using(public.is_staff_or_admin() and public.has_admin_permission('accounting','view'));
create policy accounting_lines_select on public.accounting_lines for select to authenticated using(public.is_staff_or_admin() and public.has_admin_permission('accounting','view'));
revoke all on public.accounting_accounts,public.accounting_entries,public.accounting_lines from public,anon;
grant select on public.accounting_accounts,public.accounting_entries,public.accounting_lines to authenticated;

insert into public.accounting_accounts(code,name,account_group,is_system) values
 ('1000','Cash in Hand','asset',true),('1010','Bank Accounts','asset',true),('1100','Accounts Receivable','asset',true),
 ('1200','Inventory Asset','asset',true),('1300','Input GST','asset',true),('2000','Accounts Payable','liability',true),
 ('2100','Output CGST','liability',true),('2110','Output SGST','liability',true),('2120','Output IGST','liability',true),
 ('3000','Owner Equity','equity',true),('4000','Sales Revenue','income',true),('4100','Sales Returns','income',true),
 ('5000','Cost of Goods Sold','expense',true),('5100','Purchases','expense',true),('5200','Inventory Adjustment','expense',true),
 ('6000','Operating Expenses','expense',true)
on conflict(code) do update set name=excluded.name,account_group=excluded.account_group,is_system=true;

create or replace function public.post_accounting_entry(p_voucher_type text,p_voucher_date date,p_reference_type text,p_reference_id uuid,p_reference_number text,p_narration text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_number text; v_debit numeric; v_credit numeric; r jsonb; v_account uuid;
begin
 if not public.has_admin_permission('accounting','create') then raise exception 'Accounting create permission required'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'At least two accounting lines are required'; end if;
 select coalesce(sum(coalesce((x->>'debit')::numeric,0)),0),coalesce(sum(coalesce((x->>'credit')::numeric,0)),0) into v_debit,v_credit from jsonb_array_elements(p_lines) x;
 if v_debit<=0 or round(v_debit,2)<>round(v_credit,2) then raise exception 'Voucher is not balanced: debit %, credit %',v_debit,v_credit; end if;
 v_number:='JV-'||to_char(coalesce(p_voucher_date,current_date),'YYYY')||'-'||lpad(nextval('public.accounting_entry_sequence')::text,6,'0');
 insert into public.accounting_entries(entry_number,voucher_type,voucher_date,reference_type,reference_id,reference_number,narration,total_debit,total_credit,created_by)
 values(v_number,lower(p_voucher_type),coalesce(p_voucher_date,current_date),p_reference_type,p_reference_id,p_reference_number,p_narration,v_debit,v_credit,auth.uid()) returning id into v_id;
 for r in select value from jsonb_array_elements(p_lines) loop
  select id into v_account from public.accounting_accounts where id=nullif(r->>'account_id','')::uuid or code=r->>'account_code' limit 1;
  if v_account is null then raise exception 'Accounting ledger not found for line %',r; end if;
  insert into public.accounting_lines(entry_id,account_id,debit,credit,party_name,line_note)
  values(v_id,v_account,coalesce(nullif(r->>'debit','')::numeric,0),coalesce(nullif(r->>'credit','')::numeric,0),nullif(r->>'party_name',''),nullif(r->>'line_note',''));
 end loop;
 return v_id;
end $$;
revoke all on function public.post_accounting_entry(text,date,text,uuid,text,text,jsonb) from public,anon;
grant execute on function public.post_accounting_entry(text,date,text,uuid,text,text,jsonb) to authenticated;

create or replace function public.accounting_trial_balance(p_from date default null,p_to date default null)
returns table(code text,account_name text,account_group text,debit numeric,credit numeric,balance numeric) language sql security definer set search_path='' as $$
 select a.code,a.name,a.account_group,
  coalesce(sum(l.debit),0)+case when a.opening_side='debit' then a.opening_balance else 0 end,
  coalesce(sum(l.credit),0)+case when a.opening_side='credit' then a.opening_balance else 0 end,
  coalesce(sum(l.debit-l.credit),0)+case when a.opening_side='debit' then a.opening_balance when a.opening_side='credit' then -a.opening_balance else 0 end
 from public.accounting_accounts a left join public.accounting_lines l on l.account_id=a.id
 left join public.accounting_entries e on e.id=l.entry_id and e.status='posted' and (p_from is null or e.voucher_date>=p_from) and (p_to is null or e.voucher_date<=p_to)
 where public.has_admin_permission('accounting','view') group by a.id order by a.code
$$;
revoke all on function public.accounting_trial_balance(date,date) from public,anon;
grant execute on function public.accounting_trial_balance(date,date) to authenticated;

create or replace function public.accounting_overview(p_from date default null,p_to date default null)
returns jsonb language sql security definer set search_path='' as $$
 select case when public.has_admin_permission('accounting','view') then jsonb_build_object(
  'assets',coalesce(sum(case when a.account_group='asset' then l.debit-l.credit else 0 end),0),
  'liabilities',coalesce(sum(case when a.account_group='liability' then l.credit-l.debit else 0 end),0),
  'income',coalesce(sum(case when a.account_group='income' then l.credit-l.debit else 0 end),0),
  'expenses',coalesce(sum(case when a.account_group='expense' then l.debit-l.credit else 0 end),0),
  'debits',coalesce(sum(l.debit),0),'credits',coalesce(sum(l.credit),0),
  'entries',count(distinct e.id)) else '{}'::jsonb end
 from public.accounting_entries e join public.accounting_lines l on l.entry_id=e.id join public.accounting_accounts a on a.id=l.account_id
 where e.status='posted' and (p_from is null or e.voucher_date>=p_from) and (p_to is null or e.voucher_date<=p_to)
$$;
revoke all on function public.accounting_overview(date,date) from public,anon;
grant execute on function public.accounting_overview(date,date) to authenticated;

comment on table public.inventory_lots is 'FIFO stock layers. Oldest received_at layer is consumed first.';
comment on table public.accounting_entries is 'Immutable posted double-entry voucher header; lines must balance debit and credit.';

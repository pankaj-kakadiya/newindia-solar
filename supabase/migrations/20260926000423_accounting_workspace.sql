-- Additive accounting workspace; existing source documents and stock remain intact.
alter table public.accounting_accounts add column if not exists ledger_group text;

create or replace function public.accounting_create_ledger(p_code text,p_name text,p_group text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_class text;
begin
 if auth.uid() is null or not public.has_admin_permission('accounting','create') then raise exception 'Accounting create permission required'; end if;
 if p_code is null or p_code !~ '^[A-Za-z0-9_-]{1,30}$' or nullif(trim(p_name),'') is null or length(p_name)>150 then raise exception 'Enter a ledger code and name (maximum 150 characters)'; end if;
 v_class:=case
 when p_group in ('Cash in Hand','Bank Accounts','Sundry Debtors','Stock in Hand','Fixed Assets','Investments','Deposits','Loans and Advances','Input Taxes','Current Assets') then 'asset'
 when p_group in ('Sundry Creditors','Duties and Taxes','Secured Loans','Unsecured Loans','Bank Overdraft','Provisions','Current Liabilities') then 'liability'
 when p_group in ('Capital Account','Reserves and Surplus') then 'equity'
 when p_group in ('Sales Accounts','Direct Income','Indirect Income') then 'income'
 when p_group in ('Purchase Accounts','Direct Expenses','Indirect Expenses') then 'expense' end;
 if v_class is null then raise exception 'Choose a supported ledger group'; end if;
 insert into public.accounting_accounts(code,name,account_group,ledger_group) values(upper(p_code),trim(p_name),v_class,p_group) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.accounting_create_ledger(text,text,text) from public,anon;
grant execute on function public.accounting_create_ledger(text,text,text) to authenticated;

-- Complete totals computed in the database, independent of register pagination.
create or replace function public.accounting_workspace_balances(p_from date,p_to date)
returns table(code text,account_name text,account_group text,ledger_group text,opening numeric,debit numeric,credit numeric,closing numeric)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('accounting','view') then raise exception 'Accounting view permission required'; end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Choose a valid date range'; end if;
 return query
 select a.code,a.name,a.account_group,a.ledger_group,
  (case when a.opening_side='credit' then -a.opening_balance else a.opening_balance end)+coalesce(sum(l.debit-l.credit) filter(where e.voucher_date<p_from),0),
  coalesce(sum(l.debit) filter(where e.voucher_date>=p_from),0),coalesce(sum(l.credit) filter(where e.voucher_date>=p_from),0),
  (case when a.opening_side='credit' then -a.opening_balance else a.opening_balance end)+coalesce(sum(l.debit-l.credit),0)
 from public.accounting_accounts a
 left join (public.accounting_lines l join public.accounting_entries e on e.id=l.entry_id and e.status='posted' and e.voucher_date<=p_to) on l.account_id=a.id
 group by a.id order by a.code;
end $$;
revoke all on function public.accounting_workspace_balances(date,date) from public,anon;
grant execute on function public.accounting_workspace_balances(date,date) to authenticated;

-- A request UUID survives retries; a duplicate cannot post a second voucher.
create or replace function public.accounting_post_manual(p_request_id uuid,p_type text,p_date date,p_reference text,p_narration text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; r jsonb; d numeric; c numeric; total_d numeric:=0; total_c numeric:=0;
begin
 if auth.uid() is null or not public.has_admin_permission('accounting','create') then raise exception 'Accounting create permission required'; end if;
 if p_request_id is null then raise exception 'Request ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select id into v_id from public.accounting_entries where reference_type='manual_workspace' and reference_id=p_request_id and created_by=auth.uid();
 if v_id is not null then
  if not exists(select 1 from public.accounting_entries where id=v_id and voucher_type=p_type and voucher_date=p_date and narration=trim(p_narration) and reference_number is not distinct from p_reference) then raise exception 'This request was already posted with different details. Refresh the register before creating another voucher'; end if;
  if (select jsonb_agg(jsonb_build_object('account_code',a.code,'debit',l.debit,'credit',l.credit) order by a.code,l.debit,l.credit) from public.accounting_lines l join public.accounting_accounts a on a.id=l.account_id where l.entry_id=v_id)
   is distinct from (select jsonb_agg(jsonb_build_object('account_code',x->>'account_code','debit',coalesce((x->>'debit')::numeric,0),'credit',coalesce((x->>'credit')::numeric,0)) order by x->>'account_code',coalesce((x->>'debit')::numeric,0),coalesce((x->>'credit')::numeric,0)) from jsonb_array_elements(p_lines) x) then raise exception 'This request was already posted with different amounts. Refresh the register'; end if;
  return v_id;
 end if;
 if p_type is null or p_type not in ('journal','receipt','payment','contra','purchase','sales','debit_note','credit_note') then raise exception 'Unsupported voucher type'; end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Kolkata')::date or nullif(trim(p_narration),'') is null then raise exception 'Date cannot be future and narration is required'; end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' then raise exception 'Ledger lines are required'; end if;
 if jsonb_array_length(p_lines)<2 or jsonb_array_length(p_lines)>100 then raise exception 'Enter 2 to 100 ledger lines'; end if;
 for r in select value from jsonb_array_elements(p_lines) loop
  if coalesce(r->>'debit','0') !~ '^[0-9]+(\.[0-9]{1,2})?$' or coalesce(r->>'credit','0') !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Amounts must have at most two decimals'; end if;
  d:=coalesce((r->>'debit')::numeric,0);c:=coalesce((r->>'credit')::numeric,0);
  if d>999999999999 or c>999999999999 or not ((d>0 and c=0) or (c>0 and d=0)) then raise exception 'Each line requires exactly one positive amount'; end if;
  if not exists(select 1 from public.accounting_accounts where code=r->>'account_code' and is_active) then raise exception 'Choose an active ledger'; end if;
  total_d:=total_d+d;total_c:=total_c+c;
 end loop;
 if total_d<>total_c then raise exception 'Debit and credit must match exactly'; end if;
 return public.post_accounting_entry(p_type,p_date,'manual_workspace',p_request_id,p_reference,trim(p_narration),p_lines);
end $$;
revoke all on function public.accounting_post_manual(uuid,text,date,text,text,jsonb) from public,anon;
grant execute on function public.accounting_post_manual(uuid,text,date,text,text,jsonb) to authenticated;

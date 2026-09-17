-- Keep trial-balance totals inside the requested accounting period.
create or replace function public.accounting_trial_balance(p_from date default null,p_to date default null)
returns table(code text,account_name text,account_group text,debit numeric,credit numeric,balance numeric)
language sql
security definer
set search_path=''
as $$
 with period_lines as (
  select l.account_id,l.debit,l.credit
  from public.accounting_lines l
  join public.accounting_entries e on e.id=l.entry_id
  where e.status='posted'
   and (p_from is null or e.voucher_date>=p_from)
   and (p_to is null or e.voucher_date<=p_to)
 )
 select a.code,a.name,a.account_group,
  coalesce(sum(l.debit),0)+case when a.opening_side='debit' then a.opening_balance else 0 end,
  coalesce(sum(l.credit),0)+case when a.opening_side='credit' then a.opening_balance else 0 end,
  coalesce(sum(l.debit-l.credit),0)+case when a.opening_side='debit' then a.opening_balance when a.opening_side='credit' then -a.opening_balance else 0 end
 from public.accounting_accounts a
 left join period_lines l on l.account_id=a.id
 where public.has_admin_permission('accounting','view')
 group by a.id
 order by a.code
$$;

revoke all on function public.accounting_trial_balance(date,date) from public,anon;
grant execute on function public.accounting_trial_balance(date,date) to authenticated;

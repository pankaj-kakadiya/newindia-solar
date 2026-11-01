-- PM Surya Ghar + Gujarat state top-up (GR EPCD/BUD/e-file/20/2025/2435/B1, 22-10-2026)
-- village campaign: camps, household leads, activity timeline and campaign targets.
-- Household data is visible only to admin/staff with the `campaigns` module permission.

insert into public.admin_modules(module_key,label,description,route,sort_order)
values('campaigns','Surya Ghar Campaign','Village camps, household leads, subsidy pipeline and campaign targets','/admin/campaigns',27)
on conflict(module_key) do update set label=excluded.label,description=excluded.description,route=excluded.route,sort_order=excluded.sort_order;

insert into public.admin_role_permissions(role_key,module_key,can_view,can_create,can_edit,can_delete,can_approve,can_export)
values('admin','campaigns',true,true,true,true,true,true),
      ('general','campaigns',false,false,false,false,false,false),
      ('sales','campaigns',true,true,true,false,false,true)
on conflict(role_key,module_key) do update set can_view=excluded.can_view,can_create=excluded.can_create,can_edit=excluded.can_edit,can_delete=excluded.can_delete,can_approve=excluded.can_approve,can_export=excluded.can_export;

create table public.campaign_camps(
  id uuid primary key default gen_random_uuid(),
  camp_code text not null unique check(length(trim(camp_code)) between 1 and 30),
  camp_date date,
  village text not null check(length(trim(village)) between 1 and 120),
  taluka text,
  district text not null default 'Other' check(district in('Gir Somnath','Amreli','Bhavnagar','Other')),
  venue text,
  status text not null default 'planned' check(status in('planned','announced','completed','cancelled')),
  sarpanch_name text,
  sarpanch_phone text,
  partner_vendor text,
  bank_partner text,
  attendance integer check(attendance is null or attendance>=0),
  checklist jsonb not null default '{}'::jsonb check(jsonb_typeof(checklist)='object'),
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_leads(
  id uuid primary key default gen_random_uuid(),
  camp_id uuid references public.campaign_camps(id) on delete set null,
  full_name text not null check(length(trim(full_name)) between 1 and 120),
  mobile text check(mobile is null or mobile ~ '^[0-9]{10}$'),
  village text,
  taluka text,
  district text not null default 'Other' check(district in('Gir Somnath','Amreli','Bhavnagar','Other')),
  consumer_number text,
  category text not null default 'general' check(category in('general','sc','st')),
  avg_monthly_units integer check(avg_monthly_units is null or avg_monthly_units>=0),
  system_kw numeric(5,2) check(system_kw is null or (system_kw>0 and system_kw<=10)),
  portal_registered boolean not null default false,
  portal_application_no text,
  loan_needed boolean not null default false,
  bank_name text,
  quoted_price numeric(12,2) check(quoted_price is null or quoted_price>=0),
  stage text not null default 'lead' check(stage in('lead','registered','feasibility_approved','survey_done','installed','commissioned','subsidy_received','lost')),
  survey_date date,
  install_date date,
  commission_date date,
  central_subsidy_received boolean not null default false,
  state_subsidy_received boolean not null default false,
  next_follow_up_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  lead_source text not null default 'village_camp',
  lost_reason text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One PM Surya Ghar subsidy per electricity connection: block duplicate consumer numbers.
create unique index campaign_leads_consumer_number_unique on public.campaign_leads(lower(trim(consumer_number))) where consumer_number is not null and trim(consumer_number)<>'';
create index campaign_leads_stage on public.campaign_leads(stage,district);
create index campaign_leads_camp on public.campaign_leads(camp_id);
create index campaign_leads_follow_up on public.campaign_leads(next_follow_up_at) where stage not in('subsidy_received','lost');

create table public.campaign_lead_activities(
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.campaign_leads(id) on delete cascade,
  activity_type text not null default 'note' check(activity_type in('note','call','whatsapp','visit','stage_change','system')),
  message text not null check(length(trim(message)) between 1 and 2000),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index campaign_lead_activities_lead on public.campaign_lead_activities(lead_id,created_at desc);

create table public.campaign_targets(
  id uuid primary key default gen_random_uuid(),
  metric_key text not null check(metric_key in('camps_held','leads','registrations','surveys','installed','commissioned','subsidy_received')),
  label text not null check(length(trim(label)) between 1 and 120),
  target_value integer not null check(target_value>0),
  due_date date,
  district text check(district is null or district in('Gir Somnath','Amreli','Bhavnagar','Other')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- First 3-week campaign plan (10 camps, 300 registrations, 150 surveys, 100 commissioned by 31-Dec-2026).
insert into public.campaign_targets(metric_key,label,target_value,due_date,sort_order) values
 ('camps_held','Village camps held',10,'2026-12-31',10),
 ('registrations','Households registered on PM Surya Ghar portal',300,'2026-12-31',20),
 ('surveys','Site surveys done',150,'2026-12-31',30),
 ('commissioned','Systems commissioned',100,'2026-12-31',40);

create or replace function public.campaign_touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end$$;

create trigger campaign_camps_touch before update on public.campaign_camps for each row execute function public.campaign_touch_updated_at();
create trigger campaign_leads_touch before update on public.campaign_leads for each row execute function public.campaign_touch_updated_at();
create trigger campaign_targets_touch before update on public.campaign_targets for each row execute function public.campaign_touch_updated_at();

-- Every stage change lands on the lead's timeline, whoever makes it.
create or replace function public.campaign_log_lead_stage() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into public.campaign_lead_activities(lead_id,activity_type,message) values(new.id,'system','Lead created at stage '||new.stage);
  elsif new.stage is distinct from old.stage then
    insert into public.campaign_lead_activities(lead_id,activity_type,message) values(new.id,'stage_change','Stage: '||old.stage||' → '||new.stage);
  end if;
  return new;
end$$;

create trigger campaign_leads_stage_log after insert or update of stage on public.campaign_leads for each row execute function public.campaign_log_lead_stage();

revoke all on function public.campaign_touch_updated_at() from public,anon;
revoke all on function public.campaign_log_lead_stage() from public,anon;

alter table public.campaign_camps enable row level security;
alter table public.campaign_leads enable row level security;
alter table public.campaign_lead_activities enable row level security;
alter table public.campaign_targets enable row level security;

revoke all on public.campaign_camps,public.campaign_leads,public.campaign_lead_activities,public.campaign_targets from anon,public;
grant select,insert,update,delete on public.campaign_camps,public.campaign_leads,public.campaign_targets to authenticated;
grant select,insert,delete on public.campaign_lead_activities to authenticated;

create policy campaign_camps_view on public.campaign_camps for select to authenticated using(public.has_admin_permission('campaigns','view'));
create policy campaign_camps_create on public.campaign_camps for insert to authenticated with check(public.has_admin_permission('campaigns','create'));
create policy campaign_camps_edit on public.campaign_camps for update to authenticated using(public.has_admin_permission('campaigns','edit')) with check(public.has_admin_permission('campaigns','edit'));
create policy campaign_camps_delete on public.campaign_camps for delete to authenticated using(public.has_admin_permission('campaigns','delete'));

create policy campaign_leads_view on public.campaign_leads for select to authenticated using(public.has_admin_permission('campaigns','view'));
create policy campaign_leads_create on public.campaign_leads for insert to authenticated with check(public.has_admin_permission('campaigns','create'));
create policy campaign_leads_edit on public.campaign_leads for update to authenticated using(public.has_admin_permission('campaigns','edit')) with check(public.has_admin_permission('campaigns','edit'));
create policy campaign_leads_delete on public.campaign_leads for delete to authenticated using(public.has_admin_permission('campaigns','delete'));

create policy campaign_activities_view on public.campaign_lead_activities for select to authenticated using(public.has_admin_permission('campaigns','view'));
create policy campaign_activities_create on public.campaign_lead_activities for insert to authenticated with check((public.has_admin_permission('campaigns','create') or public.has_admin_permission('campaigns','edit')) and created_by=(select auth.uid()));
create policy campaign_activities_delete on public.campaign_lead_activities for delete to authenticated using(public.has_admin_permission('campaigns','delete'));

create policy campaign_targets_view on public.campaign_targets for select to authenticated using(public.has_admin_permission('campaigns','view'));
create policy campaign_targets_create on public.campaign_targets for insert to authenticated with check(public.has_admin_permission('campaigns','edit'));
create policy campaign_targets_edit on public.campaign_targets for update to authenticated using(public.has_admin_permission('campaigns','edit')) with check(public.has_admin_permission('campaigns','edit'));
create policy campaign_targets_delete on public.campaign_targets for delete to authenticated using(public.has_admin_permission('campaigns','delete'));

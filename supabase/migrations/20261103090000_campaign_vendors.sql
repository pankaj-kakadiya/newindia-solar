-- Installation vendors for the Surya Ghar campaign: the PM Surya Ghar registered-vendor list
-- (pmsuryaghar.gov.in → Registered vendors, per district) plus our own shortlisting, and which
-- vendor installs each household. Same campaigns permission as the rest of the module.

create table if not exists public.campaign_vendors(
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 200),
  contact_name text,
  phone text,
  email text,
  address text,
  website text,
  brands text,
  -- Portal figures: installations in each district we looked at, nationally, capacity and consumer ratings.
  district_installs jsonb not null default '{}'::jsonb check(jsonb_typeof(district_installs)='object'),
  registered_districts text[] not null default '{}',
  total_installs integer check(total_installs is null or total_installs>=0),
  capacity_kwp numeric(12,2) check(capacity_kwp is null or capacity_kwp>=0),
  portal_rating numeric(3,2) check(portal_rating is null or portal_rating between 0 and 5),
  portal_reviews integer check(portal_reviews is null or portal_reviews>=0),
  portal_synced_at timestamptz,
  source text not null default 'pmsuryaghar.gov.in',
  -- Our own assessment.
  status text not null default 'prospect' check(status in('prospect','contacted','shortlisted','approved','active','blocked')),
  our_rating smallint check(our_rating is null or our_rating between 1 and 5),
  established_year smallint check(established_year is null or established_year between 1950 and 2100),
  gst_number text,
  pgvcl_registered boolean,
  service_talukas text[] not null default '{}',
  rate_per_kw numeric(10,2) check(rate_per_kw is null or rate_per_kw>=0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists campaign_vendors_name_unique on public.campaign_vendors(lower(trim(name)));
create index if not exists campaign_vendors_status on public.campaign_vendors(status);

drop trigger if exists campaign_vendors_touch on public.campaign_vendors;
create trigger campaign_vendors_touch before update on public.campaign_vendors for each row execute function public.campaign_touch_updated_at();

alter table public.campaign_vendors enable row level security;
revoke all on public.campaign_vendors from anon,public;
grant select,insert,update,delete on public.campaign_vendors to authenticated;
drop policy if exists campaign_vendors_view on public.campaign_vendors;
drop policy if exists campaign_vendors_create on public.campaign_vendors;
drop policy if exists campaign_vendors_edit on public.campaign_vendors;
drop policy if exists campaign_vendors_delete on public.campaign_vendors;
create policy campaign_vendors_view on public.campaign_vendors for select to authenticated using(public.has_admin_permission('campaigns','view'));
create policy campaign_vendors_create on public.campaign_vendors for insert to authenticated with check(public.has_admin_permission('campaigns','create'));
create policy campaign_vendors_edit on public.campaign_vendors for update to authenticated using(public.has_admin_permission('campaigns','edit')) with check(public.has_admin_permission('campaigns','edit'));
create policy campaign_vendors_delete on public.campaign_vendors for delete to authenticated using(public.has_admin_permission('campaigns','delete'));

-- Which vendor installs a household, and which vendor partners a camp.
alter table public.campaign_leads add column if not exists vendor_id uuid references public.campaign_vendors(id) on delete set null;
alter table public.campaign_camps add column if not exists vendor_id uuid references public.campaign_vendors(id) on delete set null;
create index if not exists campaign_leads_vendor on public.campaign_leads(vendor_id);

-- Village directory (English + Gujarati) and reusable camp venues for the Surya Ghar campaign.
-- Talukas are a fixed list in lib/gujarat-places.ts; villages come from an LGD/Census import or are
-- added by staff as they are used. Visible only with the `campaigns` admin permission.

create table public.geo_villages(
  id uuid primary key default gen_random_uuid(),
  district text not null check(district in('Gir Somnath','Amreli','Bhavnagar','Other')),
  taluka text not null check(length(trim(taluka)) between 1 and 80),
  name_en text not null check(length(trim(name_en)) between 1 and 120),
  name_gu text check(name_gu is null or length(trim(name_gu)) between 1 and 120),
  lgd_code text,
  census_code text,
  households integer check(households is null or households>=0),
  population integer check(population is null or population>=0),
  source text not null default 'manual' check(source in('lgd','census','manual')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index geo_villages_place_unique on public.geo_villages(district,lower(taluka),lower(name_en));
create unique index geo_villages_lgd_unique on public.geo_villages(lgd_code) where lgd_code is not null and lgd_code<>'';
create index geo_villages_taluka on public.geo_villages(district,taluka);

create table public.campaign_venues(
  id uuid primary key default gen_random_uuid(),
  district text not null check(district in('Gir Somnath','Amreli','Bhavnagar','Other')),
  taluka text,
  village text not null check(length(trim(village)) between 1 and 120),
  venue_type text not null default 'other' check(venue_type in('panchayat_office','gov_school','temple','ground','community_hall','dairy','other')),
  name text not null check(length(trim(name)) between 1 and 160),
  contact_name text,
  contact_phone text,
  capacity integer check(capacity is null or capacity>=0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index campaign_venues_place_unique on public.campaign_venues(district,lower(village),lower(name));

alter table public.campaign_camps add column venue_id uuid references public.campaign_venues(id) on delete set null;
create index campaign_camps_venue on public.campaign_camps(venue_id);

create trigger geo_villages_touch before update on public.geo_villages for each row execute function public.campaign_touch_updated_at();
create trigger campaign_venues_touch before update on public.campaign_venues for each row execute function public.campaign_touch_updated_at();

alter table public.geo_villages enable row level security;
alter table public.campaign_venues enable row level security;
revoke all on public.geo_villages,public.campaign_venues from anon,public;
grant select,insert,update,delete on public.geo_villages,public.campaign_venues to authenticated;

create policy geo_villages_view on public.geo_villages for select to authenticated using(public.has_admin_permission('campaigns','view'));
create policy geo_villages_create on public.geo_villages for insert to authenticated with check(public.has_admin_permission('campaigns','create'));
create policy geo_villages_edit on public.geo_villages for update to authenticated using(public.has_admin_permission('campaigns','edit')) with check(public.has_admin_permission('campaigns','edit'));
create policy geo_villages_delete on public.geo_villages for delete to authenticated using(public.has_admin_permission('campaigns','delete'));

create policy campaign_venues_view on public.campaign_venues for select to authenticated using(public.has_admin_permission('campaigns','view'));
create policy campaign_venues_create on public.campaign_venues for insert to authenticated with check(public.has_admin_permission('campaigns','create'));
create policy campaign_venues_edit on public.campaign_venues for update to authenticated using(public.has_admin_permission('campaigns','edit')) with check(public.has_admin_permission('campaigns','edit'));
create policy campaign_venues_delete on public.campaign_venues for delete to authenticated using(public.has_admin_permission('campaigns','delete'));

-- Solar market dashboards: PM Surya Ghar portal snapshots and Gujarat live grid readings.
-- Read with the `campaigns` or `reports` admin permission. Seeded with the public portal figures of 02-Nov-2026
-- (pmsuryaghar.gov.in → State/UT-wise Progress, District Info and Discom Info for Gujarat).

create table public.pmsg_stats(
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  level text not null check(level in('india','state','district','discom')),
  state text not null check(length(trim(state)) between 1 and 80),
  name text not null check(length(trim(name)) between 1 and 120),
  applications bigint not null check(applications>=0),
  installations bigint not null check(installations>=0),
  households bigint not null check(households>=0),
  capacity_mw numeric(12,2) not null check(capacity_mw>=0),
  subsidy_lakh numeric(16,2) not null check(subsidy_lakh>=0),
  source text not null default 'pmsuryaghar.gov.in',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index pmsg_stats_snapshot_unique on public.pmsg_stats(snapshot_date,level,lower(state),lower(name));
create index pmsg_stats_lookup on public.pmsg_stats(level,state,snapshot_date desc);

create table public.energy_readings(
  id bigint generated always as identity primary key,
  observed_at timestamptz not null,
  source text not null default 'sldcguj.com' check(source in('sldcguj.com')),
  metric text not null check(metric in('gujarat_demand_mw','grid_frequency_hz','dam_rate_rs')),
  value numeric(12,3) not null,
  created_at timestamptz not null default now()
);
create unique index energy_readings_unique on public.energy_readings(source,metric,observed_at);
create index energy_readings_recent on public.energy_readings(metric,observed_at desc);

alter table public.pmsg_stats enable row level security;
alter table public.energy_readings enable row level security;
revoke all on public.pmsg_stats,public.energy_readings from anon,public;
grant select,insert,update,delete on public.pmsg_stats to authenticated;
grant select,insert on public.energy_readings to authenticated;

create policy pmsg_stats_view on public.pmsg_stats for select to authenticated using(public.has_admin_permission('campaigns','view') or public.has_admin_permission('reports','view'));
create policy pmsg_stats_create on public.pmsg_stats for insert to authenticated with check(public.has_admin_permission('campaigns','edit'));
create policy pmsg_stats_edit on public.pmsg_stats for update to authenticated using(public.has_admin_permission('campaigns','edit')) with check(public.has_admin_permission('campaigns','edit'));
-- Re-pasting a snapshot replaces that date's rows, so anyone who can add snapshots can remove them.
create policy pmsg_stats_delete on public.pmsg_stats for delete to authenticated using(public.has_admin_permission('campaigns','edit'));

create policy energy_readings_view on public.energy_readings for select to authenticated using(public.has_admin_permission('campaigns','view') or public.has_admin_permission('reports','view'));
-- Readings are written by the dashboard's server route on behalf of a viewer (values come from SLDC, not the browser).
create policy energy_readings_create on public.energy_readings for insert to authenticated with check(public.has_admin_permission('campaigns','view') or public.has_admin_permission('reports','view'));

insert into public.pmsg_stats(snapshot_date,level,state,name,applications,installations,households,capacity_mw,subsidy_lakh,created_by) values
('2026-11-02','india','India','India',8800507,5513731,6521014,19172.16,3555415.00,null),
('2026-11-02','state','Andhra Pradesh','Andhra Pradesh',1069885,503653,510502,1381.3,257969.00,null),
('2026-11-02','state','Arunachal Pradesh','Arunachal Pradesh',162,2,2,0.01,1.00,null),
('2026-11-02','state','Assam','Assam',428946,203279,204119,671.1,150414.00,null),
('2026-11-02','state','Bihar','Bihar',377456,48467,49097,145.12,23871.00,null),
('2026-11-02','state','Chhattisgarh','Chhattisgarh',246803,127184,129807,449.62,72941.00,null),
('2026-11-02','state','Goa','Goa',5302,4189,5493,34.68,2773.00,null),
('2026-11-02','state','Gujarat','Gujarat',1262883,924836,1302525,3470.26,657867.00,null),
('2026-11-02','state','Haryana','Haryana',235050,159690,172780,542.99,100720.00,null),
('2026-11-02','state','Himachal Pradesh','Himachal Pradesh',21623,15797,16297,53.95,11192.00,null),
('2026-11-02','state','Jharkhand','Jharkhand',10386,4489,4710,19.23,2750.00,null),
('2026-11-02','state','Karnataka','Karnataka',42692,28036,42218,117.1,19231.00,null),
('2026-11-02','state','Kerala','Kerala',518725,397857,405164,1539.43,250716.00,null),
('2026-11-02','state','Madhya Pradesh','Madhya Pradesh',265154,199461,205289,748.22,136024.00,null),
('2026-11-02','state','Maharashtra','Maharashtra',1269880,890707,1364894,3247.79,613914.00,null),
('2026-11-02','state','Manipur','Manipur',4447,2260,2260,8.56,1540.00,null),
('2026-11-02','state','Meghalaya','Meghalaya',462,71,9316,0.23,39.00,null),
('2026-11-02','state','Mizoram','Mizoram',1798,1672,1674,6.86,1272.00,null),
('2026-11-02','state','Nagaland','Nagaland',1103,674,674,2.25,467.00,null),
('2026-11-02','state','Odisha','Odisha',423217,272840,274234,599.04,115638.00,null),
('2026-11-02','state','Punjab','Punjab',28953,21440,23389,98.23,13773.00,null),
('2026-11-02','state','Rajasthan','Rajasthan',519205,363561,378754,1420.68,239175.00,null),
('2026-11-02','state','Sikkim','Sikkim',128,67,67,0.22,45.00,null),
('2026-11-02','state','Tamil Nadu','Tamil Nadu',137992,112784,130677,414.33,70328.00,null),
('2026-11-02','state','Telangana','Telangana',106436,72279,92259,266.2,44929.00,null),
('2026-11-02','state','Tripura','Tripura',8381,5787,5799,19.85,4184.00,null),
('2026-11-02','state','Uttar Pradesh','Uttar Pradesh',1378554,942786,952349,3156.03,614329.00,null),
('2026-11-02','state','Uttarakhand','Uttarakhand',159717,118244,118923,424.15,89806.00,null),
('2026-11-02','state','West Bengal','West Bengal',88910,11702,29398,40.67,4508.00,null),
('2026-11-02','state','Andaman & Nicobar Islands','Andaman & Nicobar Islands',1107,664,683,2.17,425.00,null),
('2026-11-02','state','Chandigarh','Chandigarh',2161,1928,4308,9.1,906.00,null),
('2026-11-02','state','Delhi','Delhi',70407,14811,20710,64.05,9843.00,null),
('2026-11-02','state','Lakshadweep','Lakshadweep',1612,1400,1400,4.69,1091.00,null),
('2026-11-02','state','Puducherry','Puducherry',8418,6696,6767,24.23,4276.00,null),
('2026-11-02','state','Jammu and Kashmir','Jammu and Kashmir',93338,49243,49301,176.35,35697.00,null),
('2026-11-02','state','Ladakh','Ladakh',4037,2728,2728,8.88,1952.00,null),
('2026-11-02','state','Dadra and Nagar Haveli and Daman and Diu','Dadra and Nagar Haveli and Daman and Diu',5177,2447,2447,4.6,810.00,null),
('2026-11-02','district','Gujarat','Ahmedabad',131428,104934,248682,441.17,76266.99,null),
('2026-11-02','district','Gujarat','Amreli',33757,26531,27223,90.05,18860.13,null),
('2026-11-02','district','Gujarat','Anand',46680,31705,36391,125.63,22093.12,null),
('2026-11-02','district','Gujarat','Arvalli',16529,6949,7181,25.19,4915.65,null),
('2026-11-02','district','Gujarat','Banas Kantha',61566,36788,36908,126.37,25512.58,null),
('2026-11-02','district','Gujarat','Bharuch',35515,26582,32091,106.96,18728.39,null),
('2026-11-02','district','Gujarat','Bhavnagar',55593,43455,51138,153.04,30076.90,null),
('2026-11-02','district','Gujarat','Botad',11220,8474,8559,29.79,5909.40,null),
('2026-11-02','district','Gujarat','Chhotaudepur',5339,1359,1475,5.49,887.01,null),
('2026-11-02','district','Gujarat','Dahod',8153,3587,3968,14.50,2456.73,null),
('2026-11-02','district','Gujarat','Dangs',2615,196,196,0.79,125.76,null),
('2026-11-02','district','Gujarat','Devbhoomi Dwarka',4358,2728,3817,10.12,1832.68,null),
('2026-11-02','district','Gujarat','Gandhinagar',28782,20167,41381,79.73,14154.37,null),
('2026-11-02','district','Gujarat','Gir Somnath',15391,11577,11615,40.93,7875.09,null),
('2026-11-02','district','Gujarat','Jamnagar',35907,29712,32803,107.68,21075.64,null),
('2026-11-02','district','Gujarat','Junagadh',57315,48332,55479,166.62,34149.47,null),
('2026-11-02','district','Gujarat','Kachchh',32593,25603,25798,99.54,17979.86,null),
('2026-11-02','district','Gujarat','Kheda',35979,20254,21440,78.50,13991.04,null),
('2026-11-02','district','Gujarat','Mahesana',66498,45221,48450,151.55,31130.86,null),
('2026-11-02','district','Gujarat','Mahisagar',9343,4584,4584,16.50,3145.62,null),
('2026-11-02','district','Gujarat','Morbi',22175,17398,20268,62.55,12383.43,null),
('2026-11-02','district','Gujarat','Narmada',4181,1837,1837,7.07,1211.23,null),
('2026-11-02','district','Gujarat','Navsari',24146,14439,18767,59.09,10362.10,null),
('2026-11-02','district','Gujarat','Panch Mahals',16695,8782,8845,34.41,6170.53,null),
('2026-11-02','district','Gujarat','Patan',33658,19320,19726,68.17,13418.41,null),
('2026-11-02','district','Gujarat','Porbandar',13412,10658,10769,37.92,7521.23,null),
('2026-11-02','district','Gujarat','Rajkot',115614,99427,132208,361.10,73368.29,null),
('2026-11-02','district','Gujarat','Sabar Kantha',38696,28670,29734,100.88,20703.37,null),
('2026-11-02','district','Gujarat','Surat',140284,111823,179144,424.14,80556.84,null),
('2026-11-02','district','Gujarat','Surendranagar',27238,21066,22626,75.66,15355.63,null),
('2026-11-02','district','Gujarat','Tapi',7639,3517,3898,14.11,2479.30,null),
('2026-11-02','district','Gujarat','Vadodara',102209,75612,138428,298.51,53534.93,null),
('2026-11-02','district','Gujarat','Valsad',22375,13549,17096,56.49,9634.82,null),
('2026-11-02','discom','Gujarat','Dakshin Gujarat Vij Co.Ltd (DGVCL)',221957,158894,232897,617.77,113747.34,null),
('2026-11-02','discom','Gujarat','Madhya Gujarat VIJ Company Ltd.',222919,145154,214383,570.77,101747.19,null),
('2026-11-02','discom','Gujarat','Paschim Gujarat Vij Co. Limited',424490,344906,402209,1234.81,246229.37,null),
('2026-11-02','discom','Gujarat','Torrent Power Limited - Ahmedabad',89852,73033,172066,311.79,53543.43,null),
('2026-11-02','discom','Gujarat','Torrent Power Limited - Surat',14948,13187,20328,51.42,9402.84,null),
('2026-11-02','discom','Gujarat','Uttar Gujarat Vij Company Limited',288987,189842,260822,684.37,133067.85,null)
on conflict do nothing;

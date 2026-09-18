-- Align the database workflow with the production board and timestamp trigger.
alter table public.production_jobs drop constraint if exists production_jobs_status_check;
alter table public.production_jobs add constraint production_jobs_status_check check(status in(
 'new','bom_ready','materials_reserved','assembly','testing','qc_passed','packing','ready_to_dispatch','completed','cancelled','on_hold'
));

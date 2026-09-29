-- Descriptive buyer requirements only: never a trusted price or manufacturing BOM.
-- Existing RFQ RLS and grants continue to govern access; no new public read policy.
alter table public.bulk_rfqs add column builder_snapshot jsonb;
alter table public.bulk_rfqs add constraint bulk_rfqs_builder_snapshot_check check (
 builder_snapshot is null or (
  jsonb_typeof(builder_snapshot) = 'object'
  and octet_length(builder_snapshot::text) <= 100000
  and coalesce(builder_snapshot->>'version' = '1',false)
  and coalesce(builder_snapshot->>'product' in ('ACDB','DCDB'),false)
  and coalesce(jsonb_typeof(builder_snapshot->'selections') = 'object',false)
 )
);
comment on column public.bulk_rfqs.builder_snapshot is 'Unverified customer builder request, retained for admin quotation review. Never use as order pricing or approved production instructions.';

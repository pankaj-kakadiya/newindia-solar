-- Emergency containment only. Run through the normal migration/deployment process.
-- Preserve protected writes and standard checkout; pause custom save/checkout.
-- Restore the validated price_custom_configuration function from the reviewed
-- migration only after the incident is resolved. Never restore buyer price grants.
create or replace function nis_private.price_custom_configuration(p_template_id uuid,p_selections jsonb)
returns jsonb language plpgsql set search_path = '' as $function$
begin
  raise exception 'Custom checkout is temporarily unavailable. Please request a quotation.';
end $function$;
revoke all on function nis_private.price_custom_configuration(uuid,jsonb) from public,anon,authenticated;

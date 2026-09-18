-- Trigger functions are invoked by PostgreSQL triggers and must not be exposed
-- as callable REST RPC endpoints.
revoke execute on function public.apply_default_low_stock_threshold() from public,anon,authenticated;
revoke execute on function public.audit_admin_change() from public,anon,authenticated;
revoke execute on function public.capture_production_status_change() from public,anon,authenticated;
revoke execute on function public.capture_rfq_changes() from public,anon,authenticated;
revoke execute on function public.company_record_touch() from public,anon,authenticated;
revoke execute on function public.enforce_min_margin_trigger() from public,anon,authenticated;
revoke execute on function public.finance_payment_sync_trigger() from public,anon,authenticated;
revoke execute on function public.inventory_order_status_trigger() from public,anon,authenticated;
revoke execute on function public.inventory_production_status_trigger() from public,anon,authenticated;
revoke execute on function public.link_order_customer_account() from public,anon,authenticated;
revoke execute on function public.log_price_tier_change_trigger() from public,anon,authenticated;
revoke execute on function public.log_pricing_change_trigger() from public,anon,authenticated;
revoke execute on function public.protect_profile_access_fields() from public,anon,authenticated;
revoke execute on function public.sync_customer_account_from_profile() from public,anon,authenticated;
revoke execute on function public.sync_default_company_bank() from public,anon,authenticated;
revoke execute on function public.system_settings_touch() from public,anon,authenticated;
revoke execute on function public.transaction_invoice_trigger() from public,anon,authenticated;
revoke execute on function public.transaction_order_trigger() from public,anon,authenticated;
revoke execute on function public.validate_price_tier_trigger() from public,anon,authenticated;

alter function public.bulk_slugify(text) set search_path='';

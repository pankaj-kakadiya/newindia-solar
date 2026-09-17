-- Step 2 phase B: apply ONLY after the compatible website release is live.
-- Older product/admin pages using SELECT * will fail after this migration.
-- Phase A adds the admin endpoint; phase B removes every direct cost read.
-- Existing row-level policies and server-side calculations are preserved.

revoke select on table public.components from public,anon,authenticated;
revoke select(cost_price) on table public.components from public,anon,authenticated;
grant select(id,category,brand_id,name,model,sku,specifications,selling_price,gst_rate,stock_qty,unit,image_url,is_active,created_at,updated_at,visual_role,visual_settings,low_stock_threshold) on table public.components to anon,authenticated;

revoke select on table public.enclosures from public,anon,authenticated;
revoke select(cost_price) on table public.enclosures from public,anon,authenticated;
grant select(id,name,sku,dimensions_mm,material,ip_rating,module_capacity,selling_price,gst_rate,stock_qty,image_url,specifications,is_active,created_at,updated_at,inside_image_url,closed_image_url,visual_settings,supported_types,low_stock_threshold) on table public.enclosures to anon,authenticated;

revoke select on table public.product_variants from public,anon,authenticated;
revoke select(cost_price) on table public.product_variants from public,anon,authenticated;
grant select(id,product_id,sku,title,attributes,mrp,selling_price,stock_qty,low_stock_threshold,unit,weight_kg,is_active,created_at,updated_at) on table public.product_variants to anon,authenticated;

notify pgrst, 'reload schema';

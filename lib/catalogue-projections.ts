// Explicit projections remain valid after database cost-column restrictions.
// New database columns are deliberately not exposed by these allowlists.
export const VARIANT_FIELDS = 'id,product_id,sku,title,attributes,mrp,selling_price,stock_qty,low_stock_threshold,unit,weight_kg,is_active,created_at,updated_at'
export const COMPONENT_FIELDS = 'id,category,brand_id,name,model,sku,specifications,selling_price,gst_rate,stock_qty,unit,image_url,is_active,created_at,updated_at,visual_role,visual_settings,low_stock_threshold'
export const ENCLOSURE_FIELDS = 'id,name,sku,dimensions_mm,material,ip_rating,module_capacity,selling_price,gst_rate,stock_qty,image_url,specifications,is_active,created_at,updated_at,inside_image_url,closed_image_url,visual_settings,supported_types,low_stock_threshold'
export const BUYER_VARIANT_FIELDS = 'id,sku,title,attributes,mrp,selling_price,stock_qty,unit,weight_kg,is_active'

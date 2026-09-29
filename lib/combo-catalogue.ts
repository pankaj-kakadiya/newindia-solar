import {activeVariants,inStock,priceFor} from './catalogue'
import type {Product,Variant} from './catalogue'
export const COMBO_PRODUCT_SELECT='id,name,slug,status,category_id,product_type,short_description,featured,gst_rate,min_order_qty,sort_order,specifications,datasheet_url,categories(name,slug,is_active),brands(name,slug,is_active),product_images(image_url,alt_text,sort_order),product_variants(id,sku,title,selling_price,stock_qty,unit,is_active,attributes)'
export type Side='acdb'|'dcdb'
type Pick={product:Product;variant:Variant}
const sideLabel=(side:Side)=>side.toUpperCase()
export function belongs(product:Product,side:Side){
 const settings=product.specifications as Record<string,unknown>|null
 if(settings?.combo_enabled===false)return false
 if(settings?.combo_side==='acdb'||settings?.combo_side==='dcdb')return settings.combo_side===side
 const category=`${product.categories?.name||''} ${product.categories?.slug||''}`.toLowerCase()
 const categoryAc=category.includes('acdb'),categoryDc=category.includes('dcdb')
 if(categoryAc!==categoryDc)return side==='acdb'?categoryAc:categoryDc
 const identity=`${product.name} ${product.slug}`.toLowerCase(),hasAc=identity.includes('acdb'),hasDc=identity.includes('dcdb')
 return hasAc!==hasDc&&(side==='acdb'?hasAc:hasDc)
}
export function choices(products:Product[],side:Side){return products.filter(p=>p.product_type==='standard'&&belongs(p,side)).flatMap(product=>activeVariants(product).filter(variant=>!!priceFor(product,variant)&&inStock(product,variant)).map(variant=>({product,variant})))}

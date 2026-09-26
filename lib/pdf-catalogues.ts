import type {Category, Product} from './catalogue'
import {activeVariants, categoryScope, publishedProducts} from './catalogue'
export type PdfCatalogue = {id?:string; title:string; description:string; scope:'all'|'categories'|'products'; category_ids:string[]; product_ids:string[]; show_prices:boolean; is_published:boolean; sort_order:number}
export const emptyCatalogue = ():PdfCatalogue => ({title:'',description:'',scope:'all',category_ids:[],product_ids:[],show_prices:false,is_published:false,sort_order:0})
export const PDF_PRODUCT_SELECT='id,name,slug,status,category_id,product_type,short_description,warranty_months,inclusions,gst_rate,min_order_qty,sort_order,specifications,categories(name,slug,is_active),product_images(image_url,alt_text,sort_order),product_variants(id,sku,title,selling_price,unit,is_active,attributes)'
export function validateCatalogue(c:PdfCatalogue){
 if(!c.title.trim()||c.title.length>120)return 'Enter a title of 1–120 characters.'
 if(c.description.length>1000)return 'Description must be 1,000 characters or fewer.'
 if(!['all','categories','products'].includes(c.scope))return 'Choose a catalogue type.'
 if(c.scope==='categories'&&!c.category_ids.length)return 'Select at least one category.'
 if(c.scope==='products'&&!c.product_ids.length)return 'Select at least one product.'
 if(c.product_ids.length>10000||c.category_ids.length>1000)return 'Too many selections.'
 return ''
}
export function catalogueProducts(c:PdfCatalogue,products:Product[],categories:Category[]){
 const ids=new Set<string>()
 for(const cat of categories.filter(x=>c.category_ids.includes(x.id)))for(const id of categoryScope(categories,cat.slug))ids.add(id)
 return publishedProducts(products).filter(p=>activeVariants(p).length>0&&(c.scope==='all'||(c.scope==='products'?c.product_ids.includes(p.id):ids.has(p.category_id||'')))).sort((a,b)=>(a.categories?.name||'Other').localeCompare(b.categories?.name||'Other')||(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name,'en',{numeric:true})||a.id.localeCompare(b.id))
}
// Pagination must not silently stop at the Supabase row limit or produce duplicate products.
export async function readCatalogueRows(client:any,table:'products'|'categories'|'product_catalogues',signal:AbortSignal,publishedOnly=false){
 const rows:any[]=[];let expected:number|null=null
 do{
  let query=client.from(table).select(table==='products'?PDF_PRODUCT_SELECT:table==='categories'?'id,parent_id,name,slug,is_active':'id,title,description,scope,category_ids,product_ids,show_prices,is_published,sort_order',{count:'exact'})
  if(table==='products')query=query.eq('status','active').eq('product_variants.is_active',true)
  if(table==='categories')query=query.eq('is_active',true)
  if(table==='product_catalogues'&&publishedOnly)query=query.eq('is_published',true)
  const {data,error,count}=await query.order('id').range(rows.length,rows.length+199).abortSignal(signal)
  if(error)throw new Error(error.message||'Catalogue could not be loaded.')
  if(signal.aborted)throw new Error('Loading cancelled.')
  if(count===null||(expected!==null&&expected!==count))throw new Error('Products changed while loading. Please retry.')
  expected=count
  if(!data?.length&&rows.length<Number(expected))throw new Error('Incomplete catalogue response. Please retry.')
  rows.push(...(data||[]))
 }while(rows.length<Number(expected))
 if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error('Products changed while loading. Please retry.')
 return rows
}
export async function loadPdfProducts(client:any,c:PdfCatalogue,signal:AbortSignal){
 const [products,categories]=await Promise.all([readCatalogueRows(client,'products',signal),readCatalogueRows(client,'categories',signal)])
 return catalogueProducts(c,products,categories)
}

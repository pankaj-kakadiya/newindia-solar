import {NextRequest} from 'next/server'
import {buyerContext,buyerJson,buyerFailure,BuyerError} from '../../../../../lib/buyer-server'
import {ORDER_FIELDS,ORDER_ITEM_FIELDS,INVOICE_FIELDS,INVOICE_ITEM_FIELDS,UUID,safeTrackingUrl,buyerAddress,buyerCustomer} from '../../../../../lib/buyer-account'
async function ownedOrder(request:NextRequest,params:Promise<{id:string}>){
 const context=await buyerContext(request),{id}=await params
 if(!UUID.test(id))throw new BuyerError('Order not found.',404)
 const db=context.db
 if(!db)throw new BuyerError('Order details are temporarily unavailable.',503)
 const {data:order}=await db.from('orders').select(ORDER_FIELDS).eq('id',id).eq('user_id',context.user.id).maybeSingle().throwOnError()
 if(!order)throw new BuyerError('Order not found.',404)
 return {...context,db,order}
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const {db,order}=await ownedOrder(request,params)
 const [items,shipments,invoices,seller]=await Promise.all([
  db.from('order_items').select(ORDER_ITEM_FIELDS).eq('order_id',order.id).order('created_at').throwOnError(),
  db.from('shipment_records').select('id,courier_name,awb_code,status,tracking_url,updated_at').eq('order_id',order.id).order('created_at',{ascending:false}).throwOnError(),
  db.from('invoices').select(INVOICE_FIELDS).eq('order_id',order.id).not('status','in','(draft,void)').order('invoice_date',{ascending:false}).throwOnError(),
  db.from('finance_settings').select('legal_name,trade_name,gstin,address_line1,address_line2,city,state,pincode,country,cin,email,phone,website,invoice_terms').limit(1).maybeSingle().throwOnError()
 ])
 const ids=(invoices.data||[]).map(i=>i.id)
 const lines=ids.length?await db.from('invoice_items').select(`${INVOICE_ITEM_FIELDS},invoice_id`).in('invoice_id',ids).order('created_at').throwOnError():{data:[]}
 return buyerJson({order:{...order,shipping_address:buyerAddress(order.shipping_address),billing_address:buyerAddress(order.billing_address)},items:items.data,shipments:(shipments.data||[]).map(s=>({...s,tracking_url:safeTrackingUrl(s.tracking_url)})),invoices:(invoices.data||[]).map(i=>({...i,customer_snapshot:buyerCustomer(i.customer_snapshot),shipping_address:buyerAddress(i.shipping_address),billing_address:buyerAddress(i.billing_address),items:(lines.data||[]).filter(l=>l.invoice_id===i.id)})),seller:seller.data})
}catch(e){return buyerFailure(e)}}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const {db,client,user,order}=await ownedOrder(request,params)
 const {data:lines}=await db.from('order_items').select(ORDER_ITEM_FIELDS).eq('order_id',order.id).throwOnError()
 const items:any[]=[],notAdded:string[]=[]
 for(const line of lines||[]){
  if(line.variant_id){
   const {data:v}=await db.from('product_variants').select('id,sku,title,selling_price,stock_qty,is_active,unit,attributes,products(name,status,min_order_qty)').eq('id',line.variant_id).maybeSingle().throwOnError()
   const product:any=Array.isArray(v?.products)?v.products[0]:v?.products
   if(!v?.is_active||product?.status!=='active'||!(Number(v.selling_price)>0)){notAdded.push(`${line.name_snapshot}: no longer available.`);continue}
   const {data:reserved}=await db.from('inventory_reservations').select('quantity').eq('variant_id',v.id).eq('status','reserved').throwOnError()
   const available=Number(v.stock_qty)-(reserved||[]).reduce((n,r)=>n+Number(r.quantity),0)
   const attrs=v.attributes as any,step=Number(attrs?.quantity_step||( ['m','meter','metre','meters','metres','kg','l','litre','liter'].includes(String(v.unit).toLowerCase())?0.01:1))
   const qty=Math.round(Math.ceil(Math.max(Number(line.quantity),Number(product.min_order_qty)||1)/step)*step*1000)/1000
   if(!Number.isFinite(qty)||qty<=0||qty>available){notAdded.push(`${line.name_snapshot}: requested quantity is not in stock.`);continue}
   items.push({id:v.id,kind:'standard',productVariantId:v.id,name:product.name,variant:v.title||v.sku,price:Number(v.selling_price),qty,minQty:Number(product.min_order_qty)||1})
  }else if(line.custom_configuration_id){
   const {data:c}=await db.from('custom_configurations').select('template_id,selected_options,config_name').eq('id',line.custom_configuration_id).eq('user_id',user.id).maybeSingle().throwOnError()
   if(!c){notAdded.push(`${line.name_snapshot}: configuration is unavailable.`);continue}
   const selections=Object.values(c.selected_options||{}).flatMap((v:any)=>Array.isArray(v)?v:[v]).map((v:any)=>({value_id:v.value_id,quantity:Number(v.quantity||1)}))
   const quote=await client.rpc('save_visual_configuration',{p_template_id:c.template_id,p_config_name:c.config_name,p_selections:selections,p_preview_snapshot:{}})
   const config=Array.isArray(quote.data)?quote.data[0]:quote.data
   if(quote.error||!config?.id){notAdded.push(`${line.name_snapshot}: build needs review in the builder before reordering.`);continue}
   items.push({id:`repeat-${config.id}`,kind:'custom',name:line.name_snapshot,variant:'Custom build • current price',price:Number(config.final_price),qty:Number(line.quantity),templateId:c.template_id,visualSelections:selections})
  }else notAdded.push(`${line.name_snapshot}: product is unavailable.`)
 }
 return buyerJson({items,notAdded})
}catch(e){return buyerFailure(e)}}

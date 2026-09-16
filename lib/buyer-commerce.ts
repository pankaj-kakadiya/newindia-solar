/** Shared buyer calculations. Values are provisional until the server confirms an order. */
export type PurchaseVariant = {id:string; sku:string; title:string; selling_price:unknown; stock_qty:unknown; unit?:string|null; is_active:boolean; attributes?:unknown}
export type PurchaseProduct = {id:string; name:string; slug:string; status:string; product_type:string; gst_rate:unknown; min_order_qty:unknown; product_variants:PurchaseVariant[]}
export const PUBLIC_PRODUCT_SELECT = 'id,name,slug,status,category_id,product_type,short_description,description,featured,gst_rate,min_order_qty,sort_order,specifications,inclusions,applications,product_badges,warranty_months,lead_time_days,hsn_code,datasheet_url,installation_guide_url,categories(name,slug,is_active),brands(name,slug,is_active),product_images(image_url,alt_text,sort_order),product_variants(id,sku,title,selling_price,stock_qty,unit,is_active,attributes)'
export function finite(value:unknown):number|null {
  if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null
  const n=Number(value); return Number.isFinite(n) ? n : null
}
export function rounded(n:number, places=2):number {const factor=10**places;return Math.round((n+Number.EPSILON)*factor)/factor}
export function taxRate(value:unknown):number|null {const n=finite(value);return n!==null&&n>=0&&n<=100 ? n : null}
export function linePrice(unitPrice:unknown, rate:unknown, quantity:unknown) {
  const unit=finite(unitPrice), gst=taxRate(rate), qty=finite(quantity)
  if(unit===null||unit<=0||gst===null||qty===null||qty<=0||qty>1e9)return null
  const base=rounded(rounded(unit)*qty), tax=rounded(base*gst/100)
  return {unit:rounded(unit),quantity:qty,rate:gst,base,tax,total:rounded(base+tax)}
}
export function minimum(p:Pick<PurchaseProduct,'min_order_qty'>):number {const n=finite(p.min_order_qty);return n!==null&&n>0 ? n : 1}
export function quantityStep(v:Pick<PurchaseVariant,'attributes'|'unit'>):number {
  const attrs=record(v.attributes), explicit=finite(attrs.quantity_step)
  if(explicit!==null&&explicit>0&&explicit<=1e6)return explicit
  return /^(m|met(er|re)s?|kg|kilograms?|lit(er|re)s?|l)$/i.test((v.unit||'').trim()) ? 0.01 : 1
}
export function quantityError(q:unknown,p:Pick<PurchaseProduct,'min_order_qty'>,v:PurchaseVariant,already=0):string|null {
  const qty=finite(q), min=minimum(p), step=quantityStep(v), stock=finite(v.stock_qty)
  if(qty===null||qty<=0||qty>1e9)return 'Enter a valid quantity.'
  if(qty<min)return `Minimum order is ${min} ${v.unit||'units'}.`
  // MOQ is a lower bound, not a pack multiple. The step is anchored at zero.
  if(Math.abs(qty/step-Math.round(qty/step))>1e-6)return `Use quantity increments of ${step} ${v.unit||'units'}.`
  if(stock===null||stock<0||rounded(qty+already,6)>stock)return 'Not enough stock for this quantity, including items already in your cart.'
  return null
}
export function record(value:unknown):Record<string,unknown> {return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}}
export function strings(value:unknown):string[] {return Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'&&!!x.trim()).map(x=>x.trim()):[]}
export function specEntries(base:unknown,override:unknown):[string,string][] {
  const result=new Map<string,[string,string]>()
  for(const source of [record(base),record(override)])for(const [key,value] of Object.entries(source)) {
    if(value==null||key==='quantity_step')continue
    const rendered=typeof value==='object'?JSON.stringify(value):String(value)
    if(rendered.trim())result.set(key.toLowerCase().replace(/[^a-z0-9]/g,''),[key.replaceAll('_',' '),rendered])
  }
  return [...result.values()]
}
export type PurchaseCheck = {ok:true;variant:PurchaseVariant;price:NonNullable<ReturnType<typeof linePrice>>;quantity:number}|{ok:false;error:string}
export function checkPurchase(p:PurchaseProduct|null,variantId:string,quantity:unknown,already=0):PurchaseCheck {
  if(!p||p.status!=='active'||p.product_type!=='standard')return{ok:false,error:'This product is not currently available for direct purchase.'}
  const v=p.product_variants.find(v=>v.id===variantId&&v.is_active===true)
  if(!v)return{ok:false,error:'This variant is no longer available. Choose another option.'}
  const err=quantityError(quantity,p,v,already);if(err)return{ok:false,error:err}
  const price=linePrice(v.selling_price,p.gst_rate,quantity)
  if(!price)return{ok:false,error:'Price or GST needs confirmation. Please send an enquiry.'}
  return {ok:true,variant:v,price,quantity:price.quantity}
}
export function productEnquiry(p:PurchaseProduct,v:PurchaseVariant|null,quantity:unknown):string {
  const query=new URLSearchParams({product:p.slug})
  if(v)query.set('variant',v.id)
  const q=finite(quantity);if(q!==null&&q>0&&q<=1e9)query.set('quantity',String(q))
  return `/bulk-order?${query}`
}

export type BuyerCartItem={id:string;kind:'standard'|'custom';name:string;variant:string;price:number;qty:number;gstRate?:number|null;minQty?:number;quantityStep?:number;productVariantId?:string;customType?:'acdb'|'dcdb';templateId?:string;selectedValueIds?:string[];selectedOptions?:Record<string,any>;visualSelections?:{value_id:string;quantity:number;option_key?:string}[];visualPreview?:Record<string,any>}
export function mergeCart(items:BuyerCartItem[],item:BuyerCartItem,maxQty?:number):{ok:true;items:BuyerCartItem[]}|{ok:false;error:string} {
  if(!item.id||!Number.isFinite(item.price)||item.price<=0||!Number.isFinite(item.qty)||item.qty<=0)return{ok:false,error:'Invalid cart item.'}
  const existing=items.find(x=>x.id===item.id), qty=rounded((existing?.qty||0)+item.qty,6)
  if(maxQty!==undefined&&(!Number.isFinite(maxQty)||qty>maxQty))return{ok:false,error:'Available stock is already covered by your cart.'}
  // Refresh the whole line, not just its quantity; do not retain an old price or preview.
  const merged={...existing,...item,qty}
  return{ok:true,items:existing?items.map(x=>x.id===item.id?merged:x):[...items,merged]}
}
export function cartAmounts(items:BuyerCartItem[]) {
  let subtotal=0,tax=0,known=true
  for(const i of items){subtotal+=rounded(i.price*i.qty);const line=linePrice(i.price,i.gstRate,i.qty);if(line)tax+=line.tax;else known=false}
  return{subtotal:rounded(subtotal),tax:known?rounded(tax):null,total:known?rounded(subtotal+tax):null}
}
export function readCart(raw:string|null):BuyerCartItem[] {
  try{const data=JSON.parse(raw||'[]');if(!Array.isArray(data))return[]
    return data.filter((i:any)=>i&&typeof i.id==='string'&&['standard','custom'].includes(i.kind)&&typeof i.name==='string'&&typeof i.variant==='string'&&Number.isFinite(i.price)&&i.price>0&&Number.isFinite(i.qty)&&i.qty>0).slice(0,500)
  }catch{return[]}
}

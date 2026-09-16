/** Buyer estimates only. The order service must independently validate every purchase. */
export type PurchaseVariant = {id:string; sku:string; title:string; selling_price:unknown; stock_qty:unknown; unit?:string|null; is_active:boolean; attributes?:unknown}
export type PurchaseProduct = {id:string; name:string; slug:string; status:string; product_type:string; gst_rate:unknown; min_order_qty:unknown; product_variants:PurchaseVariant[]}
export const PUBLIC_PRODUCT_SELECT = 'id,name,slug,status,category_id,product_type,short_description,description,featured,gst_rate,min_order_qty,sort_order,specifications,inclusions,applications,product_badges,warranty_months,lead_time_days,hsn_code,datasheet_url,installation_guide_url,categories(name,slug,is_active),brands(name,slug,is_active),product_images(image_url,alt_text,sort_order),product_variants(id,sku,title,selling_price,stock_qty,unit,is_active,attributes)'
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d{1,3})?$/i
export function finite(value:unknown):number|null {
  if(typeof value!=='number'&&typeof value!=='string')return null
  if(typeof value==='string'&&(!value.trim()||value.length>80||!DECIMAL.test(value.trim())))return null
  const n=Number(value);return Number.isFinite(n)?n:null
}
export function rounded(n:number, places=2):number {const factor=10**places;return Math.round((n+Number.EPSILON)*factor)/factor}
// Parse decimal values without binary-float rounding or silently dropping precision.
function scaled(value:unknown, places:number):bigint|null {
  const n=finite(value);if(n===null||n<0||n>1e12)return null
  const [mantissa,exponent='0']=String(value).trim().toLowerCase().replace(/^\+/,'').split('e')
  if(mantissa.startsWith('-'))return n===0?BigInt(0):null
  const [whole='',fraction='']=mantissa.split('.');const power=places+Number(exponent)-fraction.length
  if(Math.abs(power)>100)return null
  const digits=BigInt((whole||'0')+fraction)
  if(power>=0)return digits*BigInt(10)**BigInt(power)
  const divisor=BigInt(10)**BigInt(-power);return digits%divisor===BigInt(0)?digits/divisor:null
}
const LIMIT=BigInt('999999999999') // numeric(12,2) prices / numeric(12,3) stock and order quantities.
const MILLI=BigInt(1000), CENTI_PERCENT=BigInt(10000)
export const MAX_BUYER_QUANTITY=999999999.999
function milli(value:unknown):bigint|null {const n=scaled(value,3);return n!==null&&n<=LIMIT?n:null}
function halfUp(n:bigint,d:bigint):bigint {return (n+d/BigInt(2))/d}
export function taxRate(value:unknown):number|null {const n=scaled(value,2);return n!==null&&n<=CENTI_PERCENT?Number(n)/100:null}
export function linePrice(unitPrice:unknown, rate:unknown, quantity:unknown) {
  const unit=scaled(unitPrice,2),gst=scaled(rate,2),qty=milli(quantity)
  if(unit===null||unit<=BigInt(0)||unit>LIMIT||gst===null||gst>CENTI_PERCENT||qty===null||qty<=BigInt(0))return null
  const base=halfUp(unit*qty,MILLI),tax=halfUp(base*gst,CENTI_PERCENT),total=base+tax
  if(base<=BigInt(0)||total>LIMIT)return null
  return {unit:Number(unit)/100,quantity:Number(qty)/1000,rate:Number(gst)/100,base:Number(base)/100,tax:Number(tax)/100,total:Number(total)/100}
}
export function minimum(p:Pick<PurchaseProduct,'min_order_qty'>):number {
  if(p.min_order_qty===null||p.min_order_qty===undefined||p.min_order_qty==='')return 1
  const n=milli(p.min_order_qty);return n!==null&&n>BigInt(0)?Number(n)/1000:NaN
}
export function record(value:unknown):Record<string,unknown> {return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}}
export function quantityStep(v:Pick<PurchaseVariant,'attributes'|'unit'>):number {
  const attrs=record(v.attributes)
  if(Object.prototype.hasOwnProperty.call(attrs,'quantity_step')){
    const step=milli(attrs.quantity_step);return step!==null&&step>BigInt(0)&&step<=BigInt(1000000000)?Number(step)/1000:NaN
  }
  return /^(m|met(er|re)s?|kg|kilograms?|lit(er|re)s?|l)$/i.test((v.unit||'').trim())?0.01:1
}
export function firstQuantity(p:Pick<PurchaseProduct,'min_order_qty'>,v:PurchaseVariant):number|null {
  const min=milli(minimum(p)),step=milli(quantityStep(v))
  if(min===null||step===null||step<=BigInt(0))return null
  const first=((min+step-BigInt(1))/step)*step
  return first<=LIMIT?Number(first)/1000:null
}
export function remainingQuantity(stock:unknown,already:unknown=0):number|null {
  const s=milli(stock),a=milli(already);return s===null||a===null?null:Number(s>a?s-a:BigInt(0))/1000
}
export function maximumQuantity(v:PurchaseVariant,already=0):number|null {
  const remaining=remainingQuantity(v.stock_qty,already),r=milli(remaining),s=milli(quantityStep(v))
  return r===null||s===null||s<=BigInt(0)?null:Number(r/s*s)/1000
}
export function quantityError(q:unknown,p:Pick<PurchaseProduct,'min_order_qty'>,v:PurchaseVariant,already=0):string|null {
  const qty=milli(q),min=minimum(p),step=quantityStep(v)
  if(!Number.isFinite(min)||!Number.isFinite(step))return 'The published minimum quantity or increment needs confirmation. Please enquire.'
  if(qty===null||qty<=BigInt(0))return 'Enter a valid quantity with no more than 3 decimal places.'
  if(qty<milli(min)!)return `Minimum order is ${min} ${v.unit||'units'}.`
  if((qty % milli(step)!) !== BigInt(0))return `Use quantity increments of ${step} ${v.unit||'units'}.`
  const stock=milli(v.stock_qty),inCart=milli(already)
  if(stock===null)return 'Stock needs confirmation. Please enquire for availability.'
  if(inCart===null)return 'Your saved cart quantity needs review before adding more.'
  if(qty+inCart>stock)return 'Not enough stock for this quantity, including items already in your cart.'
  return null
}
export function nextQuantity(q:unknown,direction:1|-1,p:Pick<PurchaseProduct,'min_order_qty'>,v:PurchaseVariant,already=0):number|null {
  const first=firstQuantity(p,v),last=maximumQuantity(v,already),step=quantityStep(v)
  if(first===null||last===null||last<first||!Number.isFinite(step))return null
  const current=finite(q),s=milli(step)!,lo=milli(first)!,hi=milli(last)!
  if(current===null)return first
  if(current<first)return first
  if(current>last)return last
  // Button clicks deliberately choose the adjacent valid lattice point; typing is never clamped.
  const index=current/step,nearest=Math.round(index),aligned=Math.abs(index-nearest)<1e-9
  const indexNext=direction===1?(aligned?nearest+1:Math.ceil(index)):(aligned?nearest-1:Math.floor(index))
  const proposed=BigInt(indexNext)*s,bounded=proposed<lo?lo:proposed>hi?hi:proposed
  return Number(bounded)/1000
}
export function resolveVariant<T extends PurchaseVariant>(variants:T[],wanted:string):T|null {
  const active=variants.filter(v=>v.is_active===true)
  return active.find(v=>v.id===wanted)||(!wanted&&active.length===1?active[0]:null)
}
export function strings(value:unknown):string[] {return Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'&&!!x.trim()).map(x=>x.trim()):[]}
export function specEntries(base:unknown,override:unknown):[string,string][] {
  const result=new Map<string,[string,string]>()
  for(const source of [record(base),record(override)])for(const [key,value] of Object.entries(source)) {
    const normalized=key.toLowerCase().replace(/[^a-z0-9]/g,'')
    if(value==null||normalized==='quantitystep')continue
    const rendered=typeof value==='object'?JSON.stringify(value):String(value)
    if(rendered.trim())result.set(normalized,[key.replaceAll('_',' '),rendered])
  }
  return [...result.values()]
}
export type PurchaseCheck = {ok:true;variant:PurchaseVariant;price:NonNullable<ReturnType<typeof linePrice>>;quantity:number}|{ok:false;error:string}
export function checkPurchase(p:PurchaseProduct|null,variantId:string,quantity:unknown,already=0):PurchaseCheck {
  if(!p||p.status!=='active'||p.product_type!=='standard')return{ok:false,error:'This product is not currently available for direct purchase.'}
  const v=(p.product_variants||[]).find(v=>v.id===variantId&&v.is_active===true)
  if(!v)return{ok:false,error:'This variant is no longer available. Choose another option.'}
  const err=quantityError(quantity,p,v,already);if(err)return{ok:false,error:err}
  const price=linePrice(v.selling_price,p.gst_rate,quantity)
  if(!price)return{ok:false,error:'Price or GST needs confirmation. Please send an enquiry.'}
  return {ok:true,variant:v,price,quantity:price.quantity}
}
export function productEnquiry(p:PurchaseProduct,v:PurchaseVariant|null,quantity:unknown):string {
  const query=new URLSearchParams({product:p.slug})
  if(v)query.set('variant',v.id)
  const q=milli(quantity);if(q!==null&&q>BigInt(0))query.set('quantity',String(Number(q)/1000))
  return `/bulk-order?${query}`
}

export type BuyerCartItem={id:string;kind:'standard'|'custom';name:string;variant:string;price:number;qty:number;gstRate?:number|null;minQty?:number;quantityStep?:number;productVariantId?:string;customType?:'acdb'|'dcdb';templateId?:string;selectedValueIds?:string[];selectedOptions?:Record<string,any>;visualSelections?:{value_id:string;quantity:number;option_key?:string}[];visualPreview?:Record<string,any>}
export function mergeCart(items:BuyerCartItem[],item:BuyerCartItem,maxQty?:number):{ok:true;items:BuyerCartItem[]}|{ok:false;error:string} {
  if(!item.id||!Number.isFinite(item.price)||item.price<=0||!Number.isFinite(item.qty)||item.qty<=0)return{ok:false,error:'Invalid cart item.'}
  const existing=items.find(x=>x.id===item.id), qty=rounded((existing?.qty||0)+item.qty,6)
  if(maxQty!==undefined&&(!Number.isFinite(maxQty)||qty>maxQty))return{ok:false,error:'Available stock is already covered by your cart.'}
  const merged={...existing,...item,qty}
  return{ok:true,items:existing?items.map(x=>x.id===item.id?merged:x):[...items,merged]}
}
export function cartAmounts(items:BuyerCartItem[]) {
  let subtotal=0,tax=0,known=true
  for(const i of items){const line=linePrice(i.price,i.gstRate,i.qty);subtotal+=line?.base??rounded(i.price*i.qty);if(line)tax+=line.tax;else known=false}
  return{subtotal:rounded(subtotal),tax:known?rounded(tax):null,total:known?rounded(subtotal+tax):null}
}
export function readCart(raw:string|null):BuyerCartItem[] {
  try{const data=JSON.parse(raw||'[]');if(!Array.isArray(data))return[]
    return data.filter((i:any)=>i&&typeof i.id==='string'&&['standard','custom'].includes(i.kind)&&typeof i.name==='string'&&typeof i.variant==='string'&&Number.isFinite(i.price)&&i.price>0&&Number.isFinite(i.qty)&&i.qty>0).slice(0,500)
  }catch{return[]}
}

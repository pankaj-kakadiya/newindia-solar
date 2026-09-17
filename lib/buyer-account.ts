export const PROFILE_FIELDS='id,full_name,phone,company_name,gstin'
export const ADDRESS_FIELDS='id,label,contact_name,phone,address_line1,address_line2,city,state,postal_code,country,is_default_shipping'
export const ORDER_FIELDS='id,order_number,status,payment_status,grand_total,created_at,confirmed_at,shipped_at,delivered_at,subtotal,discount_amount,shipping_amount,tax_amount,company_name,gstin,po_number,shipping_address,billing_address'
export const ORDER_ITEM_FIELDS='id,item_type,variant_id,custom_configuration_id,sku_snapshot,name_snapshot,quantity,unit_price,gst_rate,tax_amount,line_total'
export const INVOICE_FIELDS='id,invoice_number,document_type,status,invoice_date,due_date,place_of_supply,supply_type,customer_snapshot,billing_address,shipping_address,subtotal,discount_amount,shipping_amount,taxable_amount,cgst_amount,sgst_amount,igst_amount,tax_total,grand_total,amount_paid,balance_due'
export const INVOICE_ITEM_FIELDS='id,description,sku,hsn_code,quantity,unit,unit_price,taxable_amount,gst_rate,cgst_amount,sgst_amount,igst_amount,tax_total,line_total'
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function indianPhone(value:string){const digits=value.replace(/[\s()+-]/g,'').replace(/^91(?=\d{10}$)/,'');return /^[6-9]\d{9}$/.test(digits)?`+91${digits}`:null}
export function safeNext(value:string|null){return value&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\r\n]/.test(value)?value:'/account'}
export function safeTrackingUrl(value:unknown){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
export function text(value:unknown,max=200){return String(value??'').trim().slice(0,max)}
export function profileInput(body:any){
 const full_name=text(body.full_name,120),phone=text(body.phone,20),company_name=text(body.company_name,180),gstin=text(body.gstin,15).toUpperCase()
 if(!full_name)throw Error('Enter your full name.')
 if(phone&&!indianPhone(phone))throw Error('Enter a valid 10-digit Indian mobile number.')
 if(gstin&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin))throw Error('Enter a valid 15-character GSTIN.')
 if(gstin&&!company_name)throw Error('Enter your registered business name with GSTIN.')
 return {full_name,phone:phone?indianPhone(phone):null,company_name:company_name||null,gstin:gstin||null}
}
export function addressInput(body:any){
 const row={label:text(body.label,60)||'Address',contact_name:text(body.contact_name,120),phone:indianPhone(text(body.phone,20)),address_line1:text(body.address_line1,300),address_line2:text(body.address_line2,300),city:text(body.city,100),state:text(body.state,100),postal_code:text(body.postal_code,6),country:'India'}
 if(!row.contact_name||!row.phone||!row.address_line1||!row.city||!row.state||!/^\d{6}$/.test(row.postal_code))throw Error('Enter contact name, valid mobile, address, city, state and six-digit PIN.')
 return row
}

export function buyerAddress(value:any){return Object.fromEntries(['full_name','contact_name','phone','address_line1','address_line2','city','state','postal_code','pincode','country'].map(k=>[k,text(value?.[k],300)]))}
export function buyerCustomer(value:any){return Object.fromEntries(['name','full_name','company_name','gstin','email','phone'].map(k=>[k,text(value?.[k],200)]))}

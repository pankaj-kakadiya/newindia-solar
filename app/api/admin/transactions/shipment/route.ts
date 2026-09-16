import {NextRequest,NextResponse} from 'next/server'
import {requireServerAdminPermission} from '../../../../../../lib/serverAdminAuth'
import {serviceClient} from '../../../../../../lib/transactionRuntime'

async function shiprocketToken(){
 const email=process.env.SHIPROCKET_EMAIL,password=process.env.SHIPROCKET_PASSWORD
 if(!email||!password)throw new Error('Shiprocket credentials are not configured.')
 const r=await fetch('https://apiv2.shiprocket.in/v1/external/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
 const j=await r.json().catch(()=>({}));if(!r.ok||!j?.token)throw new Error(j?.message||'Shiprocket authentication failed.')
 return String(j.token)
}

export async function POST(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'transactions','create')
 if(auth instanceof NextResponse)return auth
 const db=serviceClient();if(!db)return NextResponse.json({error:'Secure shipment backend is not configured.'},{status:503})
 let body:any={};try{body=await request.json()}catch{}
 const action=String(body?.action||'create'),orderId=String(body?.order_id||'')
 if(!orderId)return NextResponse.json({error:'Order ID is required.'},{status:400})
 const {data:integration}=await db.from('integration_settings').select('is_enabled,public_config').eq('integration_key','shipping').single()
 if(!integration?.is_enabled)return NextResponse.json({error:'Shipping integration is disabled.'},{status:409})
 try{
  const token=await shiprocketToken()
  const existing=(await db.from('shipment_records').select('*').eq('order_id',orderId).eq('provider','shiprocket').maybeSingle()).data
  if(action==='track'){
   const awb=String(body?.awb_code||existing?.awb_code||'').trim();if(!awb)return NextResponse.json({error:'AWB code is required for tracking.'},{status:400})
   const r=await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(awb)}`,{headers:{Authorization:`Bearer ${token}`}})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.message||'Shiprocket tracking request failed.')
   const track=j?.tracking_data||j?.[0]?.tracking_data||j,shipmentStatus=track?.shipment_status||track?.track_status||existing?.status||'in_transit',url=track?.track_url||existing?.tracking_url||null
   if(existing)await db.from('shipment_records').update({awb_code:awb,status:String(shipmentStatus),tracking_url:url,response_snapshot:j,updated_at:new Date().toISOString()}).eq('id',existing.id)
   return NextResponse.json({tracked:true,awb_code:awb,status:shipmentStatus,tracking_url:url,data:j})
  }
  const weight=Number(body?.weight_kg||0),length=Number(body?.length_cm||0),breadth=Number(body?.breadth_cm||0),height=Number(body?.height_cm||0)
  if(weight<=0||length<=0||breadth<=0||height<=0)return NextResponse.json({error:'Weight, length, breadth and height are required.'},{status:400})
  const pickup=String(body?.pickup_location||integration.public_config?.pickup_location||'').trim();if(!pickup)return NextResponse.json({error:'Configure the Shiprocket pickup location first.'},{status:400})
  const {data:order}=await db.from('orders').select('*').eq('id',orderId).single();if(!order)return NextResponse.json({error:'Order not found.'},{status:404})
  const {data:items}=await db.from('order_items').select('*').eq('order_id',orderId).order('created_at')
  const s=order.shipping_address||{},c=order.customer_snapshot||{},name=String(c.name||c.full_name||s.full_name||'Customer').trim(),parts=name.split(/\s+/),first=parts.shift()||'Customer',last=parts.join(' ')||'.'
  const phone=String(c.phone||s.phone||''),email=String(c.email||'')
  if(!phone||!s.address_line1||!s.city||!s.state||!s.postal_code)return NextResponse.json({error:'Order shipping address/phone is incomplete for Shiprocket.'},{status:400})
  const payload={order_id:order.order_number,order_date:new Date(order.created_at).toISOString().slice(0,16).replace('T',' '),pickup_location:pickup,billing_customer_name:first,billing_last_name:last,billing_address:String(s.address_line1),billing_address_2:String(s.address_line2||''),billing_city:String(s.city),billing_pincode:String(s.postal_code),billing_state:String(s.state),billing_country:String(s.country||'India'),billing_email:email||'support@newindiasolar.com',billing_phone:phone,shipping_is_billing:true,order_items:(items||[]).map((i:any)=>({name:i.name_snapshot||'Solar component',sku:i.sku_snapshot||`ITEM-${i.id.slice(0,8)}`,units:Number(i.quantity||1),selling_price:Number(i.unit_price||0),discount:0,tax:Number(i.gst_rate||0),hsn:''})),payment_method:String(body?.payment_mode||'Prepaid'),sub_total:Number(order.subtotal||order.grand_total||0),length,breadth,height,weight}
  const r=await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)})
  const j=await r.json().catch(()=>({}));if(!r.ok||!j?.shipment_id)throw new Error(j?.message||'Shiprocket shipment creation failed.')
  let awb='',courier='',assign:any=null
  if(body?.auto_assign_awb!==false){
   const ar=await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({shipment_id:j.shipment_id})})
   assign=await ar.json().catch(()=>({}));awb=String(assign?.response?.data?.awb_code||assign?.awb_code||'');courier=String(assign?.response?.data?.courier_name||assign?.courier_name||'')
  }
  const record={order_id:orderId,provider:'shiprocket',provider_order_id:String(j.order_id||''),shipment_id:String(j.shipment_id||''),awb_code:awb||null,courier_name:courier||null,status:awb?'awb_assigned':'created',tracking_url:awb?`https://shiprocket.co/tracking/${awb}`:null,weight_kg:weight,length_cm:length,breadth_cm:breadth,height_cm:height,pickup_location:pickup,request_snapshot:{payment_mode:payload.payment_method,item_count:(items||[]).length},response_snapshot:{create:j,assign},last_error:null,created_by:auth.access?.user_id||null,updated_at:new Date().toISOString()}
  const {data:saved,error}=await db.from('shipment_records').upsert(record,{onConflict:'order_id,provider'}).select().single();if(error)throw error
  await db.from('integration_event_logs').insert({integration_key:'shipping',direction:'outbound',event_type:'shipment_created',status:'sent',external_id:String(j.shipment_id),reference_type:'order',reference_id:orderId,response_metadata:{awb_code:awb||null,courier_name:courier||null}})
  return NextResponse.json({created:true,shipment:saved})
 }catch(error:any){return NextResponse.json({error:String(error?.message||error)},{status:502})}
}

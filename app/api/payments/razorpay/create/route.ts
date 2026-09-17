import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {paymentPaise,paymentReady} from '../../../../../lib/payment-security'
import {serviceClient} from '../../../../../lib/transactionRuntime'

async function currentUser(request:NextRequest){
 const auth=request.headers.get('authorization')||'',token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():''
 if(!token)return null
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 if(!url||!key)return null
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data}=await client.auth.getUser(token);return data.user||null
}
function authHeader(keyId:string,keySecret:string){return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`}

async function handleRequest(request:NextRequest){
 const user=await currentUser(request);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401})
 const db=serviceClient();if(!db)return NextResponse.json({error:'Secure payment backend is not configured.'},{status:503})
 const keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET
 if(!keyId||!keySecret)return NextResponse.json({error:'Razorpay credentials are not configured.'},{status:503})
 const {data:integration}=await db.from('integration_settings').select('is_enabled,environment').eq('integration_key','payment').single()
 if(!paymentReady(integration,process.env))return NextResponse.json({error:'Online payment is not ready. Please use bank transfer or contact support.'},{status:409})
 let body:any={};try{body=await request.json()}catch{}
 const orderNumber=String(body?.order_number||'').trim();if(!orderNumber)return NextResponse.json({error:'Order number is required.'},{status:400})
 const {data:order}=await db.from('orders').select('id,order_number,user_id,grand_total,customer_snapshot,shipping_address,payment_status,status').eq('order_number',orderNumber).eq('user_id',user.id).single()
 if(!order)return NextResponse.json({error:'Order not found.'},{status:404})
 if(['paid','partially_paid','refunded'].includes(order.payment_status)||['cancelled','refunded','shipped','delivered'].includes(order.status))return NextResponse.json({error:'This order is not eligible for a new online payment. Please contact support.'},{status:409})
 const amount=paymentPaise(order.grand_total);if(amount===null)return NextResponse.json({error:'Order amount is invalid.'},{status:400})
 const authorization=authHeader(keyId,keySecret)

 let razorpayOrderId=''
 const {data:existing,error:existingError}=await db.from('payments').select('id,provider_order_id,amount').eq('order_id',order.id).eq('provider','razorpay').eq('status','pending').not('provider_order_id','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(existingError)return NextResponse.json({error:'Could not check existing payment.'},{status:503})
 if(existing?.provider_order_id&&Math.round(Number(existing.amount||0)*100)===amount){
  const check=await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(existing.provider_order_id)}`,{headers:{Authorization:authorization},cache:'no-store',signal:AbortSignal.timeout(15000)})
  const old=await check.json().catch(()=>({}))
  if(!check.ok)return NextResponse.json({error:'Could not check the previous payment. Please try again later.'},{status:502})
  if(old?.status==='paid')return NextResponse.json({error:'A payment has already completed. Please contact support; do not pay again.'},{status:409})
  if(check.ok&&old?.id===existing.provider_order_id&&old?.currency==='INR'&&old?.receipt===order.order_number&&old?.amount===amount&&['created','attempted'].includes(String(old?.status||'')))razorpayOrderId=String(existing.provider_order_id)
 }
 if(!razorpayOrderId){
  const response=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({amount,currency:'INR',receipt:order.order_number,notes:{order_id:order.id,order_number:order.order_number}})})
  const json=await response.json().catch(()=>({}));if(!response.ok)return NextResponse.json({error:json?.error?.description||'Razorpay order creation failed.'},{status:502})
  razorpayOrderId=String(json.id||'');if(!razorpayOrderId||json.amount!==amount||json.currency!=='INR'||json.receipt!==order.order_number)return NextResponse.json({error:'Razorpay returned an unexpected order response.'},{status:502})
  const {error:saveError}=await db.from('payments').insert({order_id:order.id,provider:'razorpay',provider_order_id:razorpayOrderId,status:'pending',amount:Number(order.grand_total),currency:'INR',payment_method:'online',raw_response:{razorpay_order_id:razorpayOrderId}})
  if(saveError)return NextResponse.json({error:'Could not save payment. No checkout has been opened.'},{status:503})
  await db.from('integration_event_logs').insert({integration_key:'payment',direction:'outbound',event_type:'razorpay_order_created',status:'sent',external_id:razorpayOrderId,reference_type:'order',reference_id:order.id,response_metadata:{amount,currency:'INR'}})
 }
 const customer=order.customer_snapshot||{},shipping=order.shipping_address||{}
 return NextResponse.json({key_id:keyId,razorpay_order_id:razorpayOrderId,amount,currency:'INR',order_number:order.order_number,customer:{name:customer.name||customer.full_name||'',email:customer.email||user.email||'',phone:customer.phone||shipping.phone||''}})
}

export async function POST(request:NextRequest){
 try{return await handleRequest(request)}
 catch{return NextResponse.json({error:'Payment service is temporarily unavailable. Check your order status before retrying.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}

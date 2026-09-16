import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {serviceClient} from '../../../../../lib/transactionRuntime'

async function currentUser(request:NextRequest){
 const auth=request.headers.get('authorization')||'',token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():''
 if(!token)return null
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 if(!url||!key)return null
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data}=await client.auth.getUser(token);return data.user||null
}

export async function POST(request:NextRequest){
 const user=await currentUser(request);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401})
 const db=serviceClient();if(!db)return NextResponse.json({error:'Secure payment backend is not configured.'},{status:503})
 const keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET
 if(!keyId||!keySecret)return NextResponse.json({error:'Razorpay credentials are not configured.'},{status:503})
 const {data:integration}=await db.from('integration_settings').select('is_enabled,environment').eq('integration_key','payment').single()
 if(!integration?.is_enabled)return NextResponse.json({error:'Online payment is currently disabled.'},{status:409})
 let body:any={};try{body=await request.json()}catch{}
 const orderNumber=String(body?.order_number||'').trim();if(!orderNumber)return NextResponse.json({error:'Order number is required.'},{status:400})
 const {data:order}=await db.from('orders').select('id,order_number,user_id,grand_total,currency:payment_method,customer_snapshot,shipping_address,payment_status').eq('order_number',orderNumber).eq('user_id',user.id).single()
 if(!order)return NextResponse.json({error:'Order not found.'},{status:404})
 if(order.payment_status==='paid')return NextResponse.json({error:'Order is already paid.'},{status:409})
 const amount=Math.round(Number(order.grand_total||0)*100);if(amount<=0)return NextResponse.json({error:'Order amount is invalid.'},{status:400})
 const response=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,'Content-Type':'application/json'},body:JSON.stringify({amount,currency:'INR',receipt:order.order_number,notes:{order_id:order.id,order_number:order.order_number}})})
 const json=await response.json().catch(()=>({}));if(!response.ok)return NextResponse.json({error:json?.error?.description||'Razorpay order creation failed.'},{status:502})
 await db.from('payments').insert({order_id:order.id,provider:'razorpay',provider_order_id:json.id,status:'pending',amount:Number(order.grand_total),currency:'INR',payment_method:'online',raw_response:{razorpay_order_id:json.id}})
 await db.from('integration_event_logs').insert({integration_key:'payment',direction:'outbound',event_type:'razorpay_order_created',status:'sent',external_id:json.id,reference_type:'order',reference_id:order.id,response_metadata:{amount,currency:'INR'}})
 const customer=order.customer_snapshot||{},shipping=order.shipping_address||{}
 return NextResponse.json({key_id:keyId,razorpay_order_id:json.id,amount,currency:'INR',order_number:order.order_number,customer:{name:customer.name||customer.full_name||'',email:customer.email||user.email||'',phone:customer.phone||shipping.phone||''}})
}

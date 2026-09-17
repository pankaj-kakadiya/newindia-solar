import {createHmac} from 'crypto'
import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {secureEqualHex,paymentPaise,matchesPayment} from '../../../../../lib/payment-security'
import {serviceClient} from '../../../../../lib/transactionRuntime'

function basicAuth(keyId:string,keySecret:string){return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`}
async function currentUser(request:NextRequest){
 const auth=request.headers.get('authorization')||'',token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():''
 if(!token)return null
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 if(!url||!key)return null
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data}=await client.auth.getUser(token);return data.user||null
}

async function handleRequest(request:NextRequest){
 const user=await currentUser(request);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401})
 const db=serviceClient(),keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET
 if(!db||!keyId||!keySecret)return NextResponse.json({error:'Secure payment verification is not configured.'},{status:503})
 let body:any={};try{body=await request.json()}catch{}
 const orderId=String(body?.razorpay_order_id||''),paymentId=String(body?.razorpay_payment_id||''),signature=String(body?.razorpay_signature||'')
 if(!orderId||!paymentId||!signature)return NextResponse.json({error:'Incomplete Razorpay response.'},{status:400})
 const expected=createHmac('sha256',keySecret).update(`${orderId}|${paymentId}`).digest('hex')
 if(!secureEqualHex(signature,expected))return NextResponse.json({error:'Payment signature verification failed.'},{status:401})
 const {data:payment}=await db.from('payments').select('id,order_id,amount,status').eq('provider','razorpay').eq('provider_order_id',orderId).single()
 if(!payment)return NextResponse.json({error:'Payment record not found.'},{status:404})
 const {data:order}=await db.from('orders').select('id,user_id,order_number,grand_total,status').eq('id',payment.order_id).single()
 if(!order||order.user_id!==user.id)return NextResponse.json({error:'Order ownership verification failed.'},{status:403})

 const authHeader=basicAuth(keyId,keySecret)
 const providerResponse=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:authHeader},cache:'no-store',signal:AbortSignal.timeout(15000)})
 const providerPayment=await providerResponse.json().catch(()=>({}))
 if(!providerResponse.ok)return NextResponse.json({error:providerPayment?.error?.description||'Could not verify payment with Razorpay.'},{status:502})
 if(String(providerPayment?.order_id||'')!==orderId)return NextResponse.json({error:'Razorpay order mismatch.'},{status:409})
 const expectedAmount=paymentPaise(order.grand_total)
 if(paymentPaise(payment.amount)!==expectedAmount||!matchesPayment(providerPayment,orderId,paymentId,expectedAmount))return NextResponse.json({error:'Razorpay payment amount does not match the order total.'},{status:409})

 const {data:integration}=await db.from('integration_settings').select('public_config').eq('integration_key','payment').single()
 const captureMode=String(integration?.public_config?.capture_mode||'automatic')
 let providerStatus=String(providerPayment?.status||'')
 if(!['authorized','captured'].includes(providerStatus))return NextResponse.json({error:'Payment has not been authorized or captured.'},{status:409})
 let captureResponse:any=null
 if(providerStatus==='authorized'&&captureMode==='automatic'){
  if(['cancelled','refunded'].includes(order.status))return NextResponse.json({error:'This order is closed. Please contact support.'},{status:409})
  const capture=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:authHeader,'Content-Type':'application/json'},body:JSON.stringify({amount:expectedAmount,currency:'INR'})})
  captureResponse=await capture.json().catch(()=>({}))
  if(!capture.ok)return NextResponse.json({error:captureResponse?.error?.description||'Payment was authorized but automatic capture failed.'},{status:502})
  if(!matchesPayment(captureResponse,orderId,paymentId,expectedAmount))return NextResponse.json({error:'Capture response did not match the payment.'},{status:502})
  providerStatus=String(captureResponse?.status||providerStatus)
 }

 const now=new Date().toISOString(),captured=providerStatus==='captured'
 const {error:saveError}=await db.from('payments').update({provider_payment_id:paymentId,status:captured?'paid':'pending',received_at:captured?now:null,payment_method:'online',reference_no:paymentId,raw_response:{razorpay_order_id:orderId,razorpay_payment_id:paymentId,signature_verified:true,provider_status:providerStatus,capture_mode:captureMode,captured},updated_at:now}).eq('id',payment.id).in('status',['pending','failed',...(captured?['paid']:[])])
 if(saveError)return NextResponse.json({error:'Payment received but could not be saved. Please contact support; do not pay again.'},{status:503})
 const {data:paidRows,error:paidError}=await db.from('payments').select('amount').eq('order_id',order.id).eq('status','paid')
 if(paidError)return NextResponse.json({error:'Payment reconciliation pending.'},{status:503})
 const paid=(paidRows||[]).reduce((s:number,x:any)=>s+Number(x.amount||0),0),orderStatus=paid>=Number(order.grand_total||0)?'paid':paid>0?'partially_paid':'pending'
 const {error:orderError}=await db.from('orders').update({payment_status:orderStatus,updated_at:now}).eq('id',order.id)
 const {error:invoiceError}=await db.from('invoices').update({amount_paid:paid,balance_due:Math.max(0,Number(order.grand_total||0)-paid),updated_at:now}).eq('order_id',order.id).neq('status','void')
 if(orderError||invoiceError)return NextResponse.json({error:'Payment reconciliation pending. Please contact support; do not pay again.'},{status:503})
 await db.from('integration_event_logs').insert({integration_key:'payment',direction:'inbound',event_type:captured?'payment_verified_captured':'payment_verified_pending_capture',status:captured?'processed':'received',external_id:paymentId,reference_type:'order',reference_id:order.id,response_metadata:{provider_order_id:orderId,amount:payment.amount,provider_status:providerStatus,capture_mode:captureMode}})
 return NextResponse.json({verified:true,captured,provider_status:providerStatus,order_number:order.order_number,payment_status:orderStatus})
}

export async function POST(request:NextRequest){
 try{return await handleRequest(request)}
 catch{return NextResponse.json({error:'Payment service is temporarily unavailable. Check your order status before retrying.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}

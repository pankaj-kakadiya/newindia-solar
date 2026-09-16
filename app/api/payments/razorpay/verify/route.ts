import {createHmac,timingSafeEqual} from 'crypto'
import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {serviceClient} from '../../../../../lib/transactionRuntime'

function safeEqual(a:string,b:string){try{const aa=Buffer.from(a,'hex'),bb=Buffer.from(b,'hex');return aa.length===bb.length&&timingSafeEqual(aa,bb)}catch{return false}}
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
 const db=serviceClient(),secret=process.env.RAZORPAY_KEY_SECRET
 if(!db||!secret)return NextResponse.json({error:'Secure payment verification is not configured.'},{status:503})
 let body:any={};try{body=await request.json()}catch{}
 const orderId=String(body?.razorpay_order_id||''),paymentId=String(body?.razorpay_payment_id||''),signature=String(body?.razorpay_signature||'')
 if(!orderId||!paymentId||!signature)return NextResponse.json({error:'Incomplete Razorpay response.'},{status:400})
 const expected=createHmac('sha256',secret).update(`${orderId}|${paymentId}`).digest('hex')
 if(!safeEqual(signature,expected))return NextResponse.json({error:'Payment signature verification failed.'},{status:401})
 const {data:payment}=await db.from('payments').select('id,order_id,amount').eq('provider','razorpay').eq('provider_order_id',orderId).single()
 if(!payment)return NextResponse.json({error:'Payment record not found.'},{status:404})
 const {data:order}=await db.from('orders').select('id,user_id,order_number,grand_total').eq('id',payment.order_id).single()
 if(!order||order.user_id!==user.id)return NextResponse.json({error:'Order ownership verification failed.'},{status:403})
 const now=new Date().toISOString()
 await db.from('payments').update({provider_payment_id:paymentId,status:'paid',received_at:now,payment_method:'online',reference_no:paymentId,raw_response:{razorpay_order_id:orderId,razorpay_payment_id:paymentId,signature_verified:true},updated_at:now}).eq('id',payment.id)
 const {data:paidRows}=await db.from('payments').select('amount').eq('order_id',order.id).eq('status','paid')
 const paid=(paidRows||[]).reduce((s:number,x:any)=>s+Number(x.amount||0),0),status=paid>=Number(order.grand_total||0)?'paid':paid>0?'partially_paid':'pending'
 await db.from('orders').update({payment_status:status,updated_at:now}).eq('id',order.id)
 await db.from('invoices').update({amount_paid:paid,balance_due:Math.max(0,Number(order.grand_total||0)-paid),updated_at:now}).eq('order_id',order.id).neq('status','void')
 await db.from('integration_event_logs').insert({integration_key:'payment',direction:'inbound',event_type:'payment_verified',status:'processed',external_id:paymentId,reference_type:'order',reference_id:order.id,response_metadata:{provider_order_id:orderId,amount:payment.amount}})
 return NextResponse.json({verified:true,order_number:order.order_number,payment_status:status})
}

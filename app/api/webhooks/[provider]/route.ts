import {createHmac,createHash,timingSafeEqual} from 'crypto'
import {createClient} from '@supabase/supabase-js'
import {NextRequest,NextResponse} from 'next/server'

function secureEqualHex(a:string,b:string){try{const aa=Buffer.from(a,'hex'),bb=Buffer.from(b,'hex');return aa.length===bb.length&&timingSafeEqual(aa,bb)}catch{return false}}
function hmac(secret:string,body:string){return createHmac('sha256',secret).update(body).digest('hex')}
function serviceClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!service)return null;return createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}

export async function GET(request:NextRequest,{params}:{params:Promise<{provider:string}>}){
 const {provider}=await params
 if(provider!=='whatsapp')return NextResponse.json({error:'Verification is not supported for this provider.'},{status:404})
 const mode=request.nextUrl.searchParams.get('hub.mode'),token=request.nextUrl.searchParams.get('hub.verify_token'),challenge=request.nextUrl.searchParams.get('hub.challenge')
 if(mode==='subscribe'&&token&&challenge&&token===process.env.META_WHATSAPP_VERIFY_TOKEN)return new NextResponse(challenge,{status:200,headers:{'Content-Type':'text/plain'}})
 return NextResponse.json({error:'Webhook verification failed.'},{status:403})
}

export async function POST(request:NextRequest,{params}:{params:Promise<{provider:string}>}){
 const {provider}=await params
 const map:Record<string,{key:string;secret?:string;header:string;prefix?:string}>={razorpay:{key:'payment',secret:process.env.RAZORPAY_WEBHOOK_SECRET,header:'x-razorpay-signature'},whatsapp:{key:'whatsapp',secret:process.env.META_APP_SECRET,header:'x-hub-signature-256',prefix:'sha256='},custom:{key:'webhook',secret:process.env.NIS_WEBHOOK_SIGNING_SECRET,header:'x-nis-signature',prefix:'sha256='}}
 const cfg=map[provider];if(!cfg)return NextResponse.json({error:'Unsupported webhook provider.'},{status:404})
 const db=serviceClient();if(!db)return NextResponse.json({error:'Secure webhook logging is not configured.'},{status:503})
 if(!cfg.secret)return NextResponse.json({error:'Webhook signing secret is not configured.'},{status:503})
 const body=await request.text(),hash=createHash('sha256').update(body).digest('hex'),supplied=(request.headers.get(cfg.header)||'').replace(cfg.prefix||'','').trim(),expected=hmac(cfg.secret,body),valid=Boolean(supplied)&&secureEqualHex(supplied,expected)
 let json:any={};try{json=JSON.parse(body)}catch{}
 const eventType=provider==='razorpay'?String(json?.event||request.headers.get('x-razorpay-event')||'unknown'):provider==='whatsapp'?String(json?.entry?.[0]?.changes?.[0]?.field||'whatsapp_event'):String(request.headers.get('x-event-type')||json?.type||'custom_event')
 const externalId=provider==='razorpay'?String(json?.payload?.payment?.entity?.id||json?.payload?.order?.entity?.id||''):provider==='whatsapp'?String(json?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id||json?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.id||''):String(request.headers.get('x-event-id')||json?.id||'')
 const safeHeaders={content_type:request.headers.get('content-type'),user_agent:request.headers.get('user-agent'),request_id:request.headers.get('x-request-id')||request.headers.get('x-razorpay-event-id')}
 const {data:webhook}=await db.from('integration_webhook_events').insert({integration_key:cfg.key,provider_event_id:externalId||null,event_type:eventType,signature_valid:valid,processing_status:valid?'received':'failed',payload_hash:hash,safe_headers:safeHeaders,error_message:valid?null:'Invalid webhook signature'}).select('id').single()
 await db.from('integration_event_logs').insert({integration_key:cfg.key,direction:'inbound',event_type:eventType,status:valid?'received':'failed',external_id:externalId||null,request_metadata:{payload_hash:hash,provider},error_message:valid?null:'Invalid webhook signature'})
 if(!valid)return NextResponse.json({error:'Invalid signature.'},{status:401})
 try{
  if(provider==='razorpay'){
   const entity=json?.payload?.payment?.entity||{},providerOrderId=String(entity?.order_id||''),providerPaymentId=String(entity?.id||'')
   if(providerOrderId&&providerPaymentId&&['payment.captured','payment.authorized'].includes(eventType)){
    const {data:p}=await db.from('payments').select('id,order_id,amount').eq('provider','razorpay').eq('provider_order_id',providerOrderId).maybeSingle()
    if(p){
     const paidStatus=eventType==='payment.captured'?'paid':'pending',now=new Date().toISOString()
     await db.from('payments').update({provider_payment_id:providerPaymentId,status:paidStatus,received_at:eventType==='payment.captured'?now:null,payment_method:'online',reference_no:providerPaymentId,raw_response:{provider_order_id:providerOrderId,provider_payment_id:providerPaymentId,event:eventType},updated_at:now}).eq('id',p.id)
     if(eventType==='payment.captured'){
      const {data:o}=await db.from('orders').select('grand_total').eq('id',p.order_id).single(),{data:rows}=await db.from('payments').select('amount').eq('order_id',p.order_id).eq('status','paid')
      const paid=(rows||[]).reduce((s:number,x:any)=>s+Number(x.amount||0),0),orderTotal=Number(o?.grand_total||0),status=paid>=orderTotal?'paid':paid>0?'partially_paid':'pending'
      await db.from('orders').update({payment_status:status,updated_at:now}).eq('id',p.order_id)
      await db.from('invoices').update({amount_paid:paid,balance_due:Math.max(0,orderTotal-paid),updated_at:now}).eq('order_id',p.order_id).neq('status','void')
     }
    }
   }
  }
  if(provider==='whatsapp'){
   const statusRow=json?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0],messageId=String(statusRow?.id||''),status=String(statusRow?.status||'')
   if(messageId&&status){
    const next=status==='delivered'||status==='read'?'delivered':status==='failed'?'failed':'sent'
    await db.from('communication_outbox').update({status:next,delivered_at:next==='delivered'?new Date().toISOString():null,last_error:status==='failed'?String(statusRow?.errors?.[0]?.title||'WhatsApp delivery failed'):null,updated_at:new Date().toISOString()}).eq('provider_message_id',messageId)
   }
  }
  if(webhook?.id)await db.from('integration_webhook_events').update({processing_status:'processed',processed_at:new Date().toISOString()}).eq('id',webhook.id)
  return NextResponse.json({received:true,processed:true})
 }catch(error:any){
  if(webhook?.id)await db.from('integration_webhook_events').update({processing_status:'failed',error_message:String(error?.message||error),processed_at:new Date().toISOString()}).eq('id',webhook.id)
  return NextResponse.json({received:true,processed:false},{status:202})
 }
}

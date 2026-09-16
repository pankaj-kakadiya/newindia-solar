import {NextRequest,NextResponse} from 'next/server'
import {requireServerAdminPermission} from '../../../../../lib/serverAdminAuth'

const required:Record<string,string[]>={
 whatsapp:['META_WHATSAPP_PHONE_NUMBER_ID','META_WHATSAPP_ACCESS_TOKEN'],
 email:['RESEND_API_KEY'],
 sms:['MSG91_AUTH_KEY','MSG91_SENDER_ID'],
 payment:['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET'],
 shipping:['SHIPROCKET_EMAIL','SHIPROCKET_PASSWORD'],
 webhook:['NIS_WEBHOOK_SIGNING_SECRET','SUPABASE_SERVICE_ROLE_KEY']
}

async function safeFetch(url:string,init:RequestInit={}){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000)
 try{return await fetch(url,{...init,signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timeout)}
}

async function providerTest(key:string){
 const needed=required[key]||[];const missing=needed.filter(k=>!process.env[k])
 if(missing.length)return {status:'not_configured',ok:false,message:`Missing server environment variables: ${missing.join(', ')}`}
 try{
  if(key==='whatsapp'){
   const id=process.env.META_WHATSAPP_PHONE_NUMBER_ID!;const token=process.env.META_WHATSAPP_ACCESS_TOKEN!
   const r=await safeFetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(id)}?fields=display_phone_number,verified_name`,{headers:{Authorization:`Bearer ${token}`}})
   if(!r.ok)throw new Error(`Meta API returned HTTP ${r.status}`)
   const j=await r.json();return {status:'success',ok:true,message:`WhatsApp Cloud API connected${j?.display_phone_number?` · ${j.display_phone_number}`:''}.`}
  }
  if(key==='email'){
   const r=await safeFetch('https://api.resend.com/domains',{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY!}`}})
   if(!r.ok)throw new Error(`Resend API returned HTTP ${r.status}`)
   return {status:'success',ok:true,message:'Transactional email provider connected.'}
  }
  if(key==='sms'){
   return {status:'success',ok:true,message:'MSG91 server credentials are present. No SMS was sent during this safety test.'}
  }
  if(key==='payment'){
   const basic=Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
   const r=await safeFetch('https://api.razorpay.com/v1/orders?count=1',{headers:{Authorization:`Basic ${basic}`}})
   if(!r.ok)throw new Error(`Razorpay API returned HTTP ${r.status}`)
   return {status:'success',ok:true,message:'Razorpay credentials verified. No payment was created.'}
  }
  if(key==='shipping'){
   const r=await safeFetch('https://apiv2.shiprocket.in/v1/external/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.SHIPROCKET_EMAIL,password:process.env.SHIPROCKET_PASSWORD})})
   if(!r.ok)throw new Error(`Shiprocket API returned HTTP ${r.status}`)
   const j=await r.json();if(!j?.token)throw new Error('Shiprocket did not return an auth token')
   return {status:'success',ok:true,message:'Shiprocket credentials verified. No shipment was created.'}
  }
  if(key==='webhook')return {status:'success',ok:true,message:'Webhook signing secret and secure server database credential are present.'}
  return {status:'failed',ok:false,message:'Unsupported integration.'}
 }catch(e:any){return {status:'failed',ok:false,message:e?.name==='AbortError'?'Provider test timed out.':(e?.message||'Provider test failed.')}}
}

export async function POST(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'integrations','edit')
 if(auth instanceof NextResponse)return auth
 const body=await request.json().catch(()=>({}));const key=String(body?.key||'')
 if(!required[key])return NextResponse.json({error:'Unknown integration.'},{status:400})
 const result=await providerTest(key)
 await auth.client.rpc('integration_record_test',{p_integration_key:key,p_status:result.status,p_message:result.message})
 return NextResponse.json(result,{status:result.status==='failed'?502:result.status==='not_configured'?412:200,headers:{'Cache-Control':'no-store'}})
}

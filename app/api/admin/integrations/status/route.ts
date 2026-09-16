import {NextRequest,NextResponse} from 'next/server'
import {requireServerAdminPermission} from '../../../../../lib/serverAdminAuth'

const requirements:Record<string,string[]>={
 whatsapp:['META_WHATSAPP_PHONE_NUMBER_ID','META_WHATSAPP_ACCESS_TOKEN','META_APP_SECRET','META_WHATSAPP_VERIFY_TOKEN'],
 email:['RESEND_API_KEY'],
 sms:['MSG91_AUTH_KEY','MSG91_SENDER_ID'],
 payment:['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET'],
 shipping:['SHIPROCKET_EMAIL','SHIPROCKET_PASSWORD'],
 webhook:['NIS_WEBHOOK_SIGNING_SECRET','SUPABASE_SERVICE_ROLE_KEY']
}

export async function GET(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'integrations','view')
 if(auth instanceof NextResponse)return auth
 const status=Object.entries(requirements).map(([key,required])=>{
  const missing=required.filter(name=>!process.env[name])
  return {key,configured:missing.length===0,required,missing,configured_count:required.length-missing.length,total_required:required.length}
 })
 return NextResponse.json({status,server_only:true,note:'Secret values never leave the server.'},{headers:{'Cache-Control':'no-store'}})
}

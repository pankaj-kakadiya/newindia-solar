import 'server-only'
import {createClient} from '@supabase/supabase-js'

export function serviceClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!service)return null
 return createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
}

function getValue(payload:Record<string,any>,key:string){
 const out=String(key).split('.').reduce((v:any,k:string)=>typeof v==='object'&&v!==null?v[k]:undefined,payload)
 return out==null?'':String(out)
}

export function renderTemplate(value:string|null|undefined,payload:Record<string,any>){
 return String(value||'').replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_,key)=>getValue(payload,String(key)))
}

function variablesFromTemplate(value:string|null|undefined,payload:Record<string,any>){
 const keys=[...String(value||'').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(m=>m[1])
 const ordered=[...new Set(keys)]
 return ordered.map(key=>({key,value:getValue(payload,key)}))
}

async function integration(db:any,key:string){
 const {data}=await db.from('integration_settings').select('*').eq('integration_key',key).single()
 return data||null
}

async function log(db:any,row:any){await db.from('integration_event_logs').insert(row)}

async function sendEmail(db:any,item:any,template:any){
 const cfg=await integration(db,'email')
 if(!cfg?.is_enabled)throw new Error('Email integration is disabled.')
 const apiKey=process.env.RESEND_API_KEY;if(!apiKey)throw new Error('RESEND_API_KEY is missing.')
 const fromEmail=cfg.public_config?.from_email,fromName=cfg.public_config?.from_name||'New India Solar'
 if(!fromEmail)throw new Error('Configure the sender email in Integrations first.')
 const subject=renderTemplate(template.subject_template,item.payload),body=renderTemplate(template.body_template,item.payload)
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:`${fromName} <${fromEmail}>`,to:[item.recipient],subject,text:body,reply_to:cfg.public_config?.reply_to||undefined})})
 const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error(json?.message||`Resend returned ${response.status}`)
 return String(json?.id||'')
}

async function sendWhatsApp(db:any,item:any,template:any){
 const cfg=await integration(db,'whatsapp')
 if(!cfg?.is_enabled)throw new Error('WhatsApp integration is disabled.')
 const token=process.env.META_WHATSAPP_ACCESS_TOKEN,phoneId=process.env.META_WHATSAPP_PHONE_NUMBER_ID
 if(!token||!phoneId)throw new Error('WhatsApp server credentials are missing.')
 const to=String(item.recipient||'').replace(/\D/g,'')
 if(!to)throw new Error('Customer WhatsApp number is missing.')
 const bodyText=renderTemplate(template.body_template,item.payload),templateName=template.provider_template_name
 let payload:any
 if(templateName){
  const vars=variablesFromTemplate(template.body_template,item.payload)
  payload={messaging_product:'whatsapp',to,type:'template',template:{name:templateName,language:{code:template.provider_template_language||'en'},...(vars.length?{components:[{type:'body',parameters:vars.map(v=>({type:'text',text:v.value||'-'}))}]}:{})}}
 }else if(cfg.public_config?.allow_session_text===true){
  payload={messaging_product:'whatsapp',to,type:'text',text:{body:bodyText}}
 }else throw new Error('Approved Meta template name is required (or explicitly enable session text mode).')
 const response=await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)})
 const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error(json?.error?.message||`Meta returned ${response.status}`)
 return String(json?.messages?.[0]?.id||'')
}

async function sendSms(db:any,item:any,template:any){
 const cfg=await integration(db,'sms')
 if(!cfg?.is_enabled)throw new Error('SMS integration is disabled.')
 const key=process.env.MSG91_AUTH_KEY,flowId=template.provider_template_name||cfg.public_config?.flow_id
 if(!key)throw new Error('MSG91_AUTH_KEY is missing.')
 if(!flowId)throw new Error('MSG91 Flow/Template ID is not configured for this template.')
 const mobile=String(item.recipient||'').replace(/\D/g,'')
 const vars=variablesFromTemplate(template.body_template,item.payload).reduce((acc:any,v)=>{acc[v.key]=v.value;return acc},{mobiles:mobile})
 const response=await fetch('https://control.msg91.com/api/v5/flow/',{method:'POST',headers:{authkey:key,'Content-Type':'application/json'},body:JSON.stringify({template_id:flowId,short_url:'0',recipients:[vars]})})
 const json=await response.json().catch(()=>({}));if(!response.ok||json?.type==='error')throw new Error(json?.message||`MSG91 returned ${response.status}`)
 return String(json?.request_id||json?.requestId||'')
}

export async function processCommunicationQueue(limit=20){
 const db=serviceClient();if(!db)throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.')
 const {data:rows,error}=await db.from('communication_outbox').select('*,communication_templates(*)').eq('status','queued').lte('available_at',new Date().toISOString()).order('created_at').limit(Math.max(1,Math.min(limit,50)))
 if(error)throw error
 const results:any[]=[]
 for(const item of rows||[]){
  const template=item.communication_templates
  await db.from('communication_outbox').update({status:'processing',attempts:Number(item.attempts||0)+1,updated_at:new Date().toISOString()}).eq('id',item.id)
  try{
   if(!template?.is_active)throw new Error('Communication template is inactive.')
   let external=''
   if(item.channel==='email')external=await sendEmail(db,item,template)
   else if(item.channel==='whatsapp')external=await sendWhatsApp(db,item,template)
   else if(item.channel==='sms')external=await sendSms(db,item,template)
   else throw new Error(`Unsupported channel ${item.channel}`)
   await db.from('communication_outbox').update({status:'sent',provider_message_id:external||null,sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',item.id)
   await log(db,{integration_key:item.channel==='email'?'email':item.channel==='whatsapp'?'whatsapp':'sms',direction:'outbound',event_type:item.event_key,status:'sent',external_id:external||null,reference_type:item.reference_type,reference_id:item.reference_id,response_metadata:{template_key:item.template_key},created_at:new Date().toISOString()})
   results.push({id:item.id,status:'sent'})
  }catch(error:any){
   const attempts=Number(item.attempts||0)+1,final=attempts>=Number(item.max_attempts||3)
   await db.from('communication_outbox').update({status:final?'failed':'queued',available_at:new Date(Date.now()+Math.min(attempts*5,30)*60000).toISOString(),last_error:String(error?.message||error),updated_at:new Date().toISOString()}).eq('id',item.id)
   await log(db,{integration_key:item.channel==='email'?'email':item.channel==='whatsapp'?'whatsapp':'sms',direction:'outbound',event_type:item.event_key,status:'failed',reference_type:item.reference_type,reference_id:item.reference_id,error_message:String(error?.message||error),created_at:new Date().toISOString()})
   results.push({id:item.id,status:final?'failed':'retrying',error:String(error?.message||error)})
  }
 }
 return results
}

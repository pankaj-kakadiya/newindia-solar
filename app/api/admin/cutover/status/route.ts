import {NextRequest,NextResponse} from 'next/server'
import {resolve4,resolve6,resolveCname} from 'dns/promises'
import {requireServerAdminPermission} from '../../../../../lib/serverAdminAuth'
import {serviceClient} from '../../../../../lib/transactionRuntime'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function normalizeUrl(value:string){
 const v=String(value||'').trim()
 if(!v)return 'https://newindiasolar.com'
 return /^https?:\/\//i.test(v)?v.replace(/\/$/,''):`https://${v.replace(/\/$/,'')}`
}
async function safeDns(host:string){
 const [a,aaaa,cname]=await Promise.allSettled([resolve4(host),resolve6(host),resolveCname(host)])
 return {
  a:a.status==='fulfilled'?a.value:[],
  aaaa:aaaa.status==='fulfilled'?aaaa.value:[],
  cname:cname.status==='fulfilled'?cname.value:[],
 }
}
async function probe(url:string){
 const started=Date.now()
 try{
  const response=await fetch(url,{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(7000),headers:{'user-agent':'NewIndiaSolar-CutoverMonitor/1.0'}})
  let json:any=null
  if((response.headers.get('content-type')||'').includes('application/json'))json=await response.json().catch(()=>null)
  else await response.arrayBuffer().catch(()=>null)
  return {ok:response.ok,status:response.status,latency_ms:Date.now()-started,url:response.url||url,json}
 }catch(error:any){return {ok:false,status:0,latency_ms:Date.now()-started,url,error:String(error?.message||error)}}
}

export async function GET(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'readiness','view')
 if(auth instanceof NextResponse)return auth
 const db=serviceClient();if(!db)return NextResponse.json({error:'Secure monitoring backend is not configured.'},{status:503})
 const [{data:control},{data:settings},{data:latest},{count:requiredPending},{data:integrations},{count:failedWebhooks},{count:failedMessages}]=await Promise.all([
  db.from('production_cutover_control').select('*').eq('id','primary').single(),
  db.from('system_settings').select('website').eq('settings_key','default').maybeSingle(),
  db.from('production_readiness_runs').select('*').order('started_at',{ascending:false}).limit(1).maybeSingle(),
  db.from('launch_checklist_items').select('*',{count:'exact',head:true}).eq('is_required',true).eq('status','pending'),
  db.from('integration_settings').select('integration_key,provider,is_enabled,environment,last_test_status,last_tested_at').order('integration_key'),
  db.from('integration_webhook_events').select('*',{count:'exact',head:true}).eq('processing_status','failed').gte('received_at',new Date(Date.now()-86400000).toISOString()),
  db.from('communication_outbox').select('*',{count:'exact',head:true}).eq('status','failed').gte('updated_at',new Date(Date.now()-86400000).toISOString()),
 ])
 const target=normalizeUrl(control?.production_url||settings?.website||'https://newindiasolar.com')
 const host=new URL(target).hostname
 const dns=await safeDns(host)
 const [home,health]=await Promise.all([probe(target),probe(`${target}/api/health`)])
 const vercelUrl=process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:null
 const stagingHealth=vercelUrl?await probe(`${vercelUrl}/api/health`):null
 return NextResponse.json({
  target_url:target,
  target_host:host,
  dns,
  production:{home,health},
  staging:{url:vercelUrl,health:stagingHealth,commit:process.env.VERCEL_GIT_COMMIT_SHA||null,environment:process.env.VERCEL_ENV||null},
  control:control||null,
  readiness:{latest:latest||null,required_pending:requiredPending||0},
  integrations:integrations||[],
  health:{failed_webhooks_24h:failedWebhooks||0,failed_messages_24h:failedMessages||0},
  checked_at:new Date().toISOString(),
 },{headers:{'Cache-Control':'no-store'}})
}

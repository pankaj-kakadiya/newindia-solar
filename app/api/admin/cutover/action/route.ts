import {NextRequest,NextResponse} from 'next/server'
import {resolve4,resolve6,resolveCname} from 'dns/promises'
import {requireServerAdminPermission} from '../../../../../lib/serverAdminAuth'
import {serviceClient} from '../../../../../lib/transactionRuntime'

export const runtime='nodejs'
export const dynamic='force-dynamic'

type Probe={ok:boolean;status:number;latency_ms:number;url:string;error?:string}
function normalizeUrl(value:string){const v=String(value||'').trim();return /^https?:\/\//i.test(v)?v.replace(/\/$/,''):`https://${v.replace(/\/$/,'')}`}
async function probe(url:string):Promise<Probe>{const started=Date.now();try{const r=await fetch(url,{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(8000),headers:{'user-agent':'NewIndiaSolar-CutoverMonitor/1.0'}});await r.arrayBuffer().catch(()=>null);return{ok:r.ok,status:r.status,latency_ms:Date.now()-started,url:r.url||url}}catch(e:any){return{ok:false,status:0,latency_ms:Date.now()-started,url,error:String(e?.message||e)}}}
async function dnsOk(host:string){const rows=await Promise.allSettled([resolve4(host),resolve6(host),resolveCname(host)]);return rows.some(x=>x.status==='fulfilled'&&x.value.length>0)}

export async function POST(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'readiness','approve')
 if(auth instanceof NextResponse)return auth
 const db=serviceClient();if(!db)return NextResponse.json({error:'Secure cutover backend is not configured.'},{status:503})
 let body:any={};try{body=await request.json()}catch{}
 const action=String(body?.action||'').trim(),evidence=String(body?.evidence||'').trim()
 const {data:{user}}=await auth.client.auth.getUser();const actor=user?.id||null
 const {data:control}=await db.from('production_cutover_control').select('*').eq('id','primary').single()
 const target=normalizeUrl(control?.production_url||'https://newindiasolar.com')
 async function log(event_type:string,status:string,message:string,extra:any={}){await db!.from('production_cutover_events').insert({event_type,phase:extra.phase||control?.phase||null,status,message,evidence:extra,actor})}
 async function gate(){const [{data:latest},{count:pending}]=await Promise.all([db!.from('production_readiness_runs').select('*').order('started_at',{ascending:false}).limit(1).maybeSingle(),db!.from('launch_checklist_items').select('*',{count:'exact',head:true}).eq('is_required',true).eq('status','pending')]);return{latest,pending:pending||0,clear:Boolean(latest)&&Number(latest?.blocker_count||0)===0&&(pending||0)===0}}
 if(action==='start'){
  const g=await gate();if(!g.clear)return NextResponse.json({error:`Step 22 gate is not clear. ${g.pending} required checklist item(s) pending and ${Number(g.latest?.blocker_count||0)} blocker(s).`},{status:409})
  const releaseCommit=process.env.VERCEL_GIT_COMMIT_SHA||String(body?.release_commit||'')||null,releaseUrl=process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:String(body?.release_deployment_url||'')||null
  await db.from('production_cutover_control').update({phase:'dns_pending',status:'in_progress',release_commit:releaseCommit,release_deployment_url:releaseUrl,rollback_reference:String(body?.rollback_reference||control?.rollback_reference||'')||null,started_at:new Date().toISOString(),completed_at:null,updated_by:actor,updated_at:new Date().toISOString()}).eq('id','primary')
  await log('cutover_started','in_progress','Controlled production cutover started.',{phase:'dns_pending',release_commit:releaseCommit,release_deployment_url:releaseUrl})
  return NextResponse.json({ok:true,phase:'dns_pending'})
 }
 if(action==='confirm_auth'||action==='confirm_webhooks'){
  if(evidence.length<3)return NextResponse.json({error:'Add a short evidence note before confirming this external configuration.'},{status:400})
  const patch=action==='confirm_auth'?{auth_config_confirmed:true}:{webhooks_confirmed:true}
  await db.from('production_cutover_control').update({...patch,updated_by:actor,updated_at:new Date().toISOString()}).eq('id','primary')
  await log(action,'confirmed',evidence,{phase:control?.phase})
  return NextResponse.json({ok:true})
 }
 if(action==='verify_domain'){
  const host=new URL(target).hostname,dns=await dnsOk(host),home=await probe(target),health=await probe(`${target}/api/health`),ssl=home.status>0
  const now=new Date().toISOString();const checks=[{check_type:'dns',status:dns?'pass':'fail',target_url:target,http_status:null,latency_ms:null,detail:dns?'DNS resolves.':'DNS does not resolve to a reachable record.'},{check_type:'https',status:home.ok?'pass':'fail',target_url:target,http_status:home.status,latency_ms:home.latency_ms,detail:home.ok?'HTTPS homepage reachable.':home.error||`HTTP ${home.status}`},{check_type:'health',status:health.ok?'pass':'fail',target_url:`${target}/api/health`,http_status:health.status,latency_ms:health.latency_ms,detail:health.ok?'Production health endpoint is healthy.':health.error||`HTTP ${health.status}`}]
  await db.from('production_monitoring_checks').insert(checks.map(x=>({...x,environment:'production',checked_by:actor,checked_at:now})))
  if(dns&&home.ok&&health.ok)await db.from('production_cutover_control').update({dns_confirmed:true,ssl_confirmed:ssl,phase:'post_cutover',status:'in_progress',updated_by:actor,updated_at:now}).eq('id','primary')
  await log('domain_verification',dns&&home.ok&&health.ok?'pass':'fail','Production domain verification completed.',{dns,home,health,phase:dns&&home.ok&&health.ok?'post_cutover':control?.phase})
  return NextResponse.json({ok:dns&&home.ok&&health.ok,dns,home,health})
 }
 if(action==='smoke'){
  const environment=body?.environment==='staging'?'staging':'production'
  const base=environment==='staging'&&process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:target
  const paths=['/','/login','/shop','/checkout','/api/health'];const results=[] as any[]
  for(const path of paths){const p=await probe(`${base}${path}`);results.push({path,...p})}
  const passed=results.every(x=>x.ok),now=new Date().toISOString()
  await db.from('production_monitoring_checks').insert(results.map(x=>({environment,target_url:x.url,check_type:`smoke:${x.path}`,status:x.ok?'pass':'fail',http_status:x.status,latency_ms:x.latency_ms,detail:x.ok?'Reachable.':x.error||`HTTP ${x.status}`,checked_by:actor,checked_at:now})))
  if(environment==='production'&&passed)await db.from('production_cutover_control').update({smoke_confirmed:true,phase:'monitoring',status:'monitoring',updated_by:actor,updated_at:now}).eq('id','primary')
  await log(`${environment}_smoke`,passed?'pass':'fail',`${environment} smoke test ${passed?'passed':'failed'}.`,{results,phase:environment==='production'&&passed?'monitoring':control?.phase})
  return NextResponse.json({ok:passed,environment,base,results})
 }
 if(action==='complete'){
  const g=await gate();const {data:fresh}=await db.from('production_cutover_control').select('*').eq('id','primary').single()
  const flags=fresh&&fresh.dns_confirmed&&fresh.ssl_confirmed&&fresh.auth_config_confirmed&&fresh.webhooks_confirmed&&fresh.smoke_confirmed
  if(!g.clear||!flags)return NextResponse.json({error:'Cutover cannot be completed until Step 22 is clear and DNS, SSL, Supabase Auth, webhooks and production smoke are all confirmed.'},{status:409})
  await db.from('production_cutover_control').update({phase:'completed',status:'completed',completed_at:new Date().toISOString(),updated_by:actor,updated_at:new Date().toISOString()}).eq('id','primary')
  await log('cutover_completed','completed','Production cutover marked complete.',{phase:'completed'})
  return NextResponse.json({ok:true,phase:'completed'})
 }
 if(action==='rollback'){
  if(evidence.length<3)return NextResponse.json({error:'Add a rollback reason/evidence note.'},{status:400})
  await db.from('production_cutover_control').update({phase:'rolled_back',status:'rolled_back',completed_at:new Date().toISOString(),updated_by:actor,updated_at:new Date().toISOString()}).eq('id','primary')
  await log('rollback','rolled_back',evidence,{phase:'rolled_back',rollback_reference:control?.rollback_reference})
  return NextResponse.json({ok:true,phase:'rolled_back',rollback_reference:control?.rollback_reference||null})
 }
 return NextResponse.json({error:'Unsupported cutover action.'},{status:400})
}

'use client'

import {useEffect,useMemo,useState} from 'react'
import {Activity,AlertTriangle,CheckCircle2,Globe2,RefreshCw,RotateCcw,Rocket,ShieldCheck} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import './cutover-v2.css'

type AnyRow=Record<string,any>
const fmt=(v:any)=>v?new Date(v).toLocaleString('en-IN'):'—'
const short=(v:any)=>String(v||'—').slice(0,12)

export default function CutoverPage(){
 const [status,setStatus]=useState<AnyRow|null>(null),[events,setEvents]=useState<AnyRow[]>([]),[checks,setChecks]=useState<AnyRow[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[evidence,setEvidence]=useState('')
 useEffect(()=>{load()},[])
 async function token(){const {data}=await supabase.auth.getSession();return data.session?.access_token||''}
 async function load(){
  setLoading(true);setMessage('')
  const t=await token();if(!t){setLoading(false);setMessage('Admin session is unavailable.');return}
  const [response,eventRows,checkRows]=await Promise.all([
   fetch('/api/admin/cutover/status',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'}),
   supabase.from('production_cutover_events').select('*').order('created_at',{ascending:false}).limit(30),
   supabase.from('production_monitoring_checks').select('*').order('checked_at',{ascending:false}).limit(40),
  ])
  const json=await response.json().catch(()=>({}));if(response.ok)setStatus(json);else setMessage(json.error||'Could not load cutover status.')
  setEvents(eventRows.data||[]);setChecks(checkRows.data||[]);setLoading(false)
 }
 async function act(action:string,extra:any={}){
  setBusy(action);setMessage('');const t=await token();
  const response=await fetch('/api/admin/cutover/action',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({action,evidence,...extra})}),json=await response.json().catch(()=>({}))
  setBusy('');setMessage(response.ok?(json.ok===false?'Checks completed with failures.':'Action completed.'):json.error||'Action failed.');if(response.ok)setEvidence('');await load()
 }
 const control=status?.control||{},ready=status?.readiness||{},prod=status?.production||{},dns=status?.dns||{},health=status?.health||{}
 const step22Clear=Boolean(ready.latest)&&Number(ready.latest?.blocker_count||0)===0&&Number(ready.required_pending||0)===0
 const productionHealthy=Boolean(prod.home?.ok&&prod.health?.ok)
 const dnsFound=(dns.a?.length||0)+(dns.aaaa?.length||0)+(dns.cname?.length||0)>0
 const gates=useMemo(()=>[
  ['Step 22 release gate',step22Clear,step22Clear?'No blockers or required pending sign-offs.':`${ready.required_pending||0} required sign-off(s) pending; ${ready.latest?.blocker_count||0} blocker(s).`],
  ['DNS resolved',Boolean(control.dns_confirmed),dnsFound?'DNS record detected but must be verified in the cutover flow.':'Production domain is not resolving from the monitor.'],
  ['HTTPS / SSL',Boolean(control.ssl_confirmed),prod.home?.status?`HTTPS returned ${prod.home.status}.`:'HTTPS is not reachable yet.'],
  ['Supabase Auth URLs',Boolean(control.auth_config_confirmed),'Record confirmation only after Site URL + redirect URLs use the final HTTPS domain.'],
  ['Production webhooks',Boolean(control.webhooks_confirmed),'Confirm Razorpay / WhatsApp / other provider callbacks use the final production domain.'],
  ['Production smoke test',Boolean(control.smoke_confirmed),productionHealthy?'Homepage and health endpoint are reachable. Full smoke still requires the controlled action.':'Production target is not fully healthy.'],
 ],[step22Clear,ready.required_pending,ready.latest?.blocker_count,control,dnsFound,prod.home?.status,productionHealthy])
 if(loading)return <div className="coLoading">Loading production cutover control…</div>
 return <div className="coPage">
  <header className="coHead"><div><span><Rocket size={15}/> CONTROL CENTER · STEP 23</span><h1>Production Cutover & Monitoring</h1><p>Final release gate, DNS/SSL verification, production smoke tests, rollout evidence and rollback control.</p></div><button className="coBtn ghost" onClick={load}><RefreshCw size={16}/> Refresh live status</button></header>
  {message&&<div className="coMessage">{message}</div>}
  <section className={`coHero ${control.status||'blocked'}`}><div className="coHeroIcon">{control.status==='completed'?<CheckCircle2/>:<ShieldCheck/>}</div><div><small>Cutover status</small><h2>{String(control.status||'blocked').replaceAll('_',' ')}</h2><p>Phase: <b>{String(control.phase||'pre_cutover').replaceAll('_',' ')}</b> · Target: <b>{status?.target_host||'newindiasolar.com'}</b></p></div><div className="coHeroMeta"><span>Release commit</span><b>{short(control.release_commit||status?.staging?.commit)}</b><small>{control.release_deployment_url||status?.staging?.url||'No release deployment recorded'}</small></div></section>

  <div className="coKpis"><article><small>Step 22 gate</small><b className={step22Clear?'ok':'bad'}>{step22Clear?'CLEAR':'BLOCKED'}</b><span>{ready.required_pending||0} required pending</span></article><article><small>Production DNS</small><b className={dnsFound?'ok':'bad'}>{dnsFound?'RESOLVES':'PENDING'}</b><span>{[...(dns.a||[]),...(dns.cname||[])].slice(0,2).join(', ')||'No address detected'}</span></article><article><small>HTTPS</small><b className={prod.home?.ok?'ok':'bad'}>{prod.home?.ok?'ONLINE':'NOT READY'}</b><span>{prod.home?.status||0} · {prod.home?.latency_ms||0} ms</span></article><article><small>24h automation health</small><b className={!health.failed_webhooks_24h&&!health.failed_messages_24h?'ok':'warn'}>{(health.failed_webhooks_24h||0)+(health.failed_messages_24h||0)} FAILURES</b><span>webhooks + outbound messages</span></article></div>

  <div className="coGrid"><section className="coPanel"><div className="coPanelHead"><div><h2>Cutover gates</h2><p>Every gate must be green before completion.</p></div></div><div className="coGates">{gates.map(([title,ok,detail]:any)=><article key={title} className={ok?'pass':'pending'}>{ok?<CheckCircle2/>:<AlertTriangle/>}<div><b>{title}</b><p>{detail}</p></div></article>)}</div></section>

  <section className="coPanel"><div className="coPanelHead"><div><h2>Controlled actions</h2><p>These actions verify or record external production changes; they never guess provider state.</p></div></div><label className="coEvidence">Evidence / change reference<input value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="DNS ticket, Supabase setting confirmation, webhook reference, rollback reason…"/></label><div className="coActions"><button className="coBtn primary" disabled={busy!==''||!step22Clear||control.status==='completed'} onClick={()=>act('start')}><Rocket size={16}/> Start controlled cutover</button><button className="coBtn" disabled={busy!==''} onClick={()=>act('smoke',{environment:'staging'})}>Run staging smoke</button><button className="coBtn" disabled={busy!==''} onClick={()=>act('verify_domain')}><Globe2 size={16}/> Verify DNS + SSL + health</button><button className="coBtn" disabled={busy!==''} onClick={()=>act('confirm_auth')}>Confirm Supabase Auth URLs</button><button className="coBtn" disabled={busy!==''} onClick={()=>act('confirm_webhooks')}>Confirm production webhooks</button><button className="coBtn" disabled={busy!==''||!control.dns_confirmed||!control.ssl_confirmed} onClick={()=>act('smoke',{environment:'production'})}><Activity size={16}/> Run production smoke</button><button className="coBtn success" disabled={busy!==''||control.status==='completed'} onClick={()=>act('complete')}><CheckCircle2 size={16}/> Complete cutover</button><button className="coBtn danger" disabled={busy!==''||!control.started_at||control.status==='rolled_back'} onClick={()=>act('rollback')}><RotateCcw size={16}/> Record rollback</button></div><p className="coNote">DNS changes at Hostinger and Supabase Auth Site URL/redirect changes remain external account actions. This control center verifies them and prevents the rollout from being marked complete until they are confirmed.</p></section></div>

  <div className="coGrid lower"><section className="coPanel"><div className="coPanelHead"><div><h2>Live deployment view</h2><p>Current environment and production reachability.</p></div></div><div className="coFacts"><div><span>Production target</span><b>{status?.target_url||'—'}</b></div><div><span>Production health</span><b>{prod.health?.ok?'Healthy':prod.health?.status?`HTTP ${prod.health.status}`:'Unavailable'}</b></div><div><span>Current Vercel URL</span><b>{status?.staging?.url||'—'}</b></div><div><span>Current deployed commit</span><b>{status?.staging?.commit||'—'}</b></div><div><span>Vercel environment</span><b>{status?.staging?.environment||'—'}</b></div><div><span>Last readiness audit</span><b>{fmt(ready.latest?.completed_at||ready.latest?.started_at)}</b></div></div></section>
  <section className="coPanel"><div className="coPanelHead"><div><h2>Integration state</h2><p>Provider enablement is shown separately from successful production verification.</p></div></div><div className="coIntegrations">{(status?.integrations||[]).map((x:any)=><article key={x.integration_key}><span className={x.is_enabled?'on':'off'}/><div><b>{x.integration_key}</b><small>{x.provider} · {x.environment}</small></div><em>{x.last_test_status||'never tested'}</em></article>)}</div></section></div>

  <section className="coPanel"><div className="coPanelHead"><div><h2>Monitoring checks</h2><p>Latest staging/production smoke and domain checks.</p></div><span>{checks.length} recent</span></div><div className="coTable"><div className="coTR head"><span>Time</span><span>Environment</span><span>Check</span><span>Status</span><span>HTTP</span><span>Latency</span></div>{checks.map(row=><div className="coTR" key={row.id}><span>{fmt(row.checked_at)}</span><span>{row.environment}</span><span title={row.target_url}>{row.check_type}</span><span className={row.status}>{row.status}</span><span>{row.http_status??'—'}</span><span>{row.latency_ms!=null?`${row.latency_ms} ms`:'—'}</span></div>)}{!checks.length&&<div className="coEmpty">No monitoring checks recorded yet.</div>}</div></section>

  <section className="coPanel"><div className="coPanelHead"><div><h2>Cutover event log</h2><p>Permanent rollout and rollback evidence.</p></div></div><div className="coTimeline">{events.map(row=><article key={row.id}><i/><div><b>{row.event_type.replaceAll('_',' ')}</b><p>{row.message||row.status}</p><small>{fmt(row.created_at)} · {row.status||'event'}</small></div></article>)}{!events.length&&<div className="coEmpty">No cutover event has been recorded. The system is still in pre-cutover state.</div>}</div></section>
 </div>
}

'use client'

import {useEffect,useMemo,useState} from 'react'
import {AlertTriangle,CheckCircle2,Clock3,History,RefreshCw,Save,ShieldCheck,XCircle} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import './readiness-v2.css'

type Run={id:string;environment:string;overall_status:string;passed_count:number;warning_count:number;blocker_count:number;started_at:string;completed_at:string|null;summary:any}
type Result={id:string;run_id:string;check_key:string;category:string;title:string;status:'pass'|'warning'|'blocker'|'pending';detail:string|null;evidence:any;created_at:string}
type Checklist={id:string;item_key:string;category:string;title:string;description:string|null;is_required:boolean;status:'pending'|'passed'|'not_applicable';evidence:string|null;verified_at:string|null;sort_order:number}
type Tab='audit'|'checklist'|'history'
const fmt=(value:string|null)=>value?new Date(value).toLocaleString('en-IN'):'—'

export default function ReadinessPage(){
 const [tab,setTab]=useState<Tab>('audit'),[run,setRun]=useState<Run|null>(null),[results,setResults]=useState<Result[]>([]),[checklist,setChecklist]=useState<Checklist[]>([]),[history,setHistory]=useState<Run[]>([]),[loading,setLoading]=useState(true),[running,setRunning]=useState(false),[saving,setSaving]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{load()},[])
 async function load(){
  setLoading(true);setMessage('')
  const [latest,items,runs]=await Promise.all([
   supabase.from('production_readiness_runs').select('*').order('started_at',{ascending:false}).limit(1).maybeSingle(),
   supabase.from('launch_checklist_items').select('*').order('sort_order'),
   supabase.from('production_readiness_runs').select('*').order('started_at',{ascending:false}).limit(12)
  ])
  const latestRun=(latest.data||null) as Run|null;setRun(latestRun);setChecklist((items.data||[]) as Checklist[]);setHistory((runs.data||[]) as Run[])
  if(latestRun){const {data}=await supabase.from('production_readiness_results').select('*').eq('run_id',latestRun.id).order('category').order('created_at');setResults((data||[]) as Result[])}else setResults([])
  const error=latest.error||items.error||runs.error;if(error)setMessage(error.message);setLoading(false)
 }
 async function runAudit(){
  setRunning(true);setMessage('')
  const {data}=await supabase.auth.getSession(),token=data.session?.access_token||''
  if(!token){setRunning(false);setMessage('Admin session is unavailable.');return}
  const response=await fetch('/api/admin/readiness/run',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}}),json=await response.json().catch(()=>({}))
  setRunning(false);if(!response.ok){setMessage(json.error||'Readiness audit failed.');return}setMessage(`Audit completed: ${json.blocker_count} blocker(s), ${json.warning_count} warning(s), ${json.passed_count} passed.`);await load()
 }
 function patchItem(id:string,patch:Partial<Checklist>){setChecklist(rows=>rows.map(row=>row.id===id?{...row,...patch}:row))}
 async function saveItem(item:Checklist){
  setSaving(item.id);setMessage('')
  const {data:{user}}=await supabase.auth.getUser(),verified=item.status==='passed'
  const {error}=await supabase.from('launch_checklist_items').update({status:item.status,evidence:item.evidence||null,verified_by:verified?user?.id||null:null,verified_at:verified?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',item.id)
  setSaving('');setMessage(error?error.message:`${item.title} saved.`);if(!error)await load()
 }
 const grouped=useMemo(()=>results.reduce<Record<string,Result[]>>((acc,row)=>{(acc[row.category]??=[]).push(row);return acc},{}),[results])
 const requiredPending=checklist.filter(x=>x.is_required&&x.status==='pending').length,passedChecklist=checklist.filter(x=>x.status==='passed').length
 const status=run?.overall_status||'not_run'
 if(loading)return <div className="rdLoading">Loading production readiness…</div>
 return <div className="rdPage">
  <div className="rdHead"><div><span className="rdEyebrow"><ShieldCheck size={15}/> CONTROL CENTER · STEP 22</span><h1>Production Readiness & QA</h1><p>Launch blockers, security hardening, integration readiness and manual cutover sign-off in one place.</p></div><button className="rdBtn primary" onClick={runAudit} disabled={running}><RefreshCw size={16} className={running?'spin':''}/>{running?'Running audit…':'Run Readiness Audit'}</button></div>
  {message&&<div className="rdMessage">{message}</div>}
  <section className={`rdHero ${status}`}><div className="rdHeroIcon">{status==='ready'?<CheckCircle2/>:status==='blocked'?<XCircle/>:status==='warning'?<AlertTriangle/>:<Clock3/>}</div><div><small>Current launch status</small><h2>{status==='ready'?'Ready for controlled cutover':status==='blocked'?'Cutover blocked':status==='warning'?'Ready with warnings':'Audit not run yet'}</h2><p>{run?`Last audit ${fmt(run.completed_at||run.started_at)} · ${run.environment.toUpperCase()}`:'Run the automated audit before production cutover.'}</p></div><div className="rdHeroScore"><b>{run?run.passed_count:0}</b><span>automated checks passed</span></div></section>
  <div className="rdKpis"><article><span className="pass"><CheckCircle2/></span><small>Passed</small><b>{run?.passed_count||0}</b><em>Automated controls</em></article><article><span className="warn"><AlertTriangle/></span><small>Warnings</small><b>{run?.warning_count||0}</b><em>Review before launch</em></article><article><span className="block"><XCircle/></span><small>Blockers</small><b>{run?.blocker_count||0}</b><em>Must be resolved</em></article><article><span className="manual"><Clock3/></span><small>Manual Sign-offs</small><b>{passedChecklist}/{checklist.length}</b><em>{requiredPending} required pending</em></article></div>
  <div className="rdTabs"><button className={tab==='audit'?'active':''} onClick={()=>setTab('audit')}><ShieldCheck size={16}/> Audit Results</button><button className={tab==='checklist'?'active':''} onClick={()=>setTab('checklist')}><CheckCircle2 size={16}/> Launch Checklist</button><button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><History size={16}/> Audit History</button></div>

  {tab==='audit'&&<div className="rdAudit">{!results.length?<div className="rdEmpty"><ShieldCheck/><b>No audit results yet</b><p>Run the readiness audit to inspect the current staging environment.</p></div>:Object.entries(grouped).map(([category,rows])=><section className="rdPanel" key={category}><div className="rdPanelHead"><h2>{category}</h2><span>{rows.length} check{rows.length===1?'':'s'}</span></div><div className="rdChecks">{rows.map(row=><article className={`rdCheck ${row.status}`} key={row.id}><span className="rdCheckIcon">{row.status==='pass'?<CheckCircle2/>:row.status==='blocker'?<XCircle/>:row.status==='warning'?<AlertTriangle/>:<Clock3/>}</span><div><div className="rdCheckTitle"><b>{row.title}</b><span>{row.status}</span></div><p>{row.detail}</p>{row.evidence&&Object.keys(row.evidence).length>0&&<small>{Object.entries(row.evidence).map(([k,v])=>`${k.replaceAll('_',' ')}: ${Array.isArray(v)?v.join(', '):String(v)}`).join(' · ')}</small>}</div></article>)}</div></section>)}</div>}

  {tab==='checklist'&&<section className="rdPanel"><div className="rdPanelHead"><div><h2>Human launch sign-off</h2><p>Automated checks cannot replace real payment, device, recovery and cutover testing.</p></div><span>{requiredPending} required pending</span></div><div className="rdChecklist">{checklist.map(item=><article key={item.id} className={`rdChecklistItem ${item.status}`}><div className="rdChecklistMain"><div className="rdChecklistTitle"><b>{item.title}</b><span>{item.category}</span>{item.is_required&&<i>Required</i>}</div><p>{item.description}</p><input value={item.evidence||''} onChange={e=>patchItem(item.id,{evidence:e.target.value})} placeholder="Evidence / test reference / owner note"/></div><div className="rdChecklistActions"><select value={item.status} onChange={e=>patchItem(item.id,{status:e.target.value as Checklist['status']})}><option value="pending">Pending</option><option value="passed">Passed</option>{!item.is_required&&<option value="not_applicable">Not applicable</option>}</select><button className="rdBtn ghost" onClick={()=>saveItem(item)} disabled={saving===item.id}><Save size={15}/>{saving===item.id?'Saving…':'Save'}</button>{item.verified_at&&<small>Verified {fmt(item.verified_at)}</small>}</div></article>)}</div></section>}

  {tab==='history'&&<section className="rdPanel"><div className="rdPanelHead"><div><h2>Readiness audit history</h2><p>Each run is retained so launch decisions have an audit trail.</p></div></div><div className="rdHistory">{history.map(item=><article key={item.id}><span className={`rdDot ${item.overall_status}`}/><div><b>{fmt(item.completed_at||item.started_at)}</b><small>{item.environment.toUpperCase()}</small></div><span>{item.passed_count} passed</span><span>{item.warning_count} warnings</span><span>{item.blocker_count} blockers</span><strong className={item.overall_status}>{item.overall_status}</strong></article>)}{!history.length&&<div className="rdEmpty"><History/><b>No previous audits</b></div>}</div></section>}
 </div>
}

'use client'

import {useEffect,useMemo,useState} from 'react'
import {Activity,Download,LogOut,MonitorSmartphone,RefreshCw,Save,Search,ShieldCheck,Timer} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {activitySummary,deviceLabel,EVENT_LABELS,sessionState} from '../../lib/adminActivity'

type Member={user_id:string;email:string|null;full_name:string|null;role:string;admin_role:string;staff_status:string}
const fmt=(v?:string|null)=>v?new Date(v).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'
const dayStart=(d:string)=>new Date(`${d}T00:00:00+05:30`).toISOString()
const dayEnd=(d:string)=>new Date(`${d}T23:59:59.999+05:30`).toISOString()
const today=()=>new Date(Date.now()+5.5*3600_000).toISOString().slice(0,10)
const daysAgo=(n:number)=>new Date(Date.now()+5.5*3600_000-n*864e5).toISOString().slice(0,10)

export default function ActivityPanel({team,modules,onMessage}:{team:Member[];modules:{module_key:string;label:string}[];onMessage:(m:string)=>void}){
 const [isOwner,setIsOwner]=useState(false)
 useEffect(()=>{supabase.rpc('get_my_admin_access').then(({data})=>setIsOwner((data as any)?.role==='admin'))},[])
 const [settings,setSettings]=useState<any>(null),[draft,setDraft]=useState<any>(null),[sessions,setSessions]=useState<any[]>([]),[events,setEvents]=useState<any[]>([])
 const [from,setFrom]=useState(daysAgo(6)),[to,setTo]=useState(today()),[person,setPerson]=useState('all'),[event,setEvent]=useState('all'),[module,setModule]=useState('all'),[q,setQ]=useState('')
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[me,setMe]=useState('')
 const name=(id:string|null,fallback?:string|null)=>{const m=team.find(t=>t.user_id===id);return m?.full_name||m?.email||fallback||'Unknown'}

 async function load(){
  setLoading(true)
  let query=supabase.from('admin_activity').select('*').gte('created_at',dayStart(from)).lte('created_at',dayEnd(to)).order('created_at',{ascending:false}).limit(2000)
  if(person!=='all')query=query.eq('user_id',person)
  if(event!=='all')query=query.eq('event',event)
  if(module!=='all')query=query.eq('module_key',module)
  const [s,ss,ev,u]=await Promise.all([supabase.from('admin_security_settings').select('*').eq('id',1).maybeSingle(),supabase.rpc('admin_list_sessions',{p_days:30}),query,supabase.auth.getUser()])
  setLoading(false)
  const err=s.error||ss.error||ev.error
  if(err){onMessage(/does not exist|schema cache|function/i.test(err.message)?'Activity tracking needs the admin_sessions_activity database update. Run it in Supabase, then refresh.':err.message);return}
  setSettings(s.data);setDraft(s.data);setSessions(ss.data||[]);setEvents(ev.data||[]);setMe(u.data.user?.id||'')
 }
 useEffect(()=>{load()},[from,to,person,event,module])

 const shown=useMemo(()=>{const s=q.trim().toLowerCase();return s?events.filter(e=>`${e.user_email||''} ${e.user_name||''} ${e.description||''} ${e.path||''} ${e.entity_table||''}`.toLowerCase().includes(s)):events},[events,q])
 const summary=useMemo(()=>activitySummary(events),[events])
 const now=Date.now()
 const latest=useMemo(()=>{const m=new Map<string,any>();for(const s of sessions)if(!m.has(s.user_id))m.set(s.user_id,s);return m},[sessions])
 const online=sessions.filter(s=>sessionState(s,now)==='online')

 async function saveSettings(){
  setBusy(true)
  const {error}=await supabase.rpc('save_admin_security_settings',{p_idle_minutes:Number(draft.idle_timeout_minutes),p_max_hours:Number(draft.max_session_hours),p_single_session:Boolean(draft.single_session),p_track_pages:Boolean(draft.track_page_views),p_automation_user:draft.automation_user_id||null})
  setBusy(false)
  if(error){onMessage(error.message);return}
  onMessage('Session security saved. It applies to every admin from their next minute of activity.');load()
 }
 async function forceLogout(userId:string){
  if(!confirm(`Sign ${name(userId)} out of every device now? They will need to sign in again.`))return
  setBusy(true);const {error}=await supabase.rpc('admin_force_logout',{p_user_id:userId});setBusy(false)
  if(error){onMessage(error.message);return}
  onMessage(`${name(userId)} has been signed out everywhere.`);load()
 }
 function exportCsv(){
  const rows=shown.map(e=>({date:new Date(e.created_at).toLocaleString('en-IN'),person:e.user_name||e.user_email||'',email:e.user_email||'',activity:EVENT_LABELS[e.event]||e.event,module:e.module_key||'',page:e.path||'',record:e.entity_table?`${e.entity_table} ${e.entity_id||''}`:'',details:e.description||''}))
  if(!rows.length)return
  const head=Object.keys(rows[0]);const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+[head.join(','),...rows.map(r=>head.map(h=>esc((r as any)[h])).join(','))].join('\n')],{type:'text/csv;charset=utf-8'}));a.download=`admin-activity-${from}-to-${to}.csv`;a.click()
  void Promise.resolve(supabase.rpc('log_admin_activity',{p_event:'export',p_module:'security',p_path:'/admin/access',p_description:`Exported ${rows.length} activity rows (${from} to ${to})`})).catch(()=>{})
 }

 if(loading&&!settings)return <section className="accessPanel"><p>Loading activity…</p></section>
 return <div className="actPanel">
  <section className="accessPanel"><div className="accessPanelHead"><div><h2>Session security</h2><p>Enforced by the database for every admin and staff account, on every device.</p></div><Timer/></div>
   {draft&&<div className="actSettings">
    <label>Sign out after no activity for<select disabled={!isOwner} value={draft.idle_timeout_minutes} onChange={e=>setDraft((d:any)=>({...d,idle_timeout_minutes:Number(e.target.value)}))}>{[10,15,20,30,45,60,120,240].map(n=><option key={n} value={n}>{n<60?`${n} minutes`:`${n/60} hour${n>60?'s':''}`}</option>)}</select></label>
    <label>Maximum session length<select disabled={!isOwner} value={draft.max_session_hours} onChange={e=>setDraft((d:any)=>({...d,max_session_hours:Number(e.target.value)}))}>{[4,8,12,24,72,168].map(n=><option key={n} value={n}>{n<24?`${n} hours`:`${n/24} day${n>24?'s':''}`}</option>)}</select></label>
    <label className="actSwitch"><input type="checkbox" disabled={!isOwner} checked={Boolean(draft.single_session)} onChange={e=>setDraft((d:any)=>({...d,single_session:e.target.checked}))}/><span><b>One session per person</b><small>Signing in on a new device signs the old one out.</small></span></label>
    <label className="actSwitch"><input type="checkbox" disabled={!isOwner} checked={Boolean(draft.track_page_views)} onChange={e=>setDraft((d:any)=>({...d,track_page_views:e.target.checked}))}/><span><b>Record pages opened</b><small>Adds every admin page visit to the activity log.</small></span></label>
    <label>Automation account (daily portal snapshot)<select disabled={!isOwner} value={draft.automation_user_id||''} onChange={e=>setDraft((d:any)=>({...d,automation_user_id:e.target.value||null}))}><option value="">None</option>{team.filter(t=>t.role==='staff').map(t=><option key={t.user_id} value={t.user_id}>{t.full_name||t.email}</option>)}</select><small className="accessHelp">Not signed out for inactivity or session length. Use a separate staff account with Field Executive rights, signed in only in the Claude browser panel.</small></label>
    {isOwner?<button className="accessPrimary" onClick={saveSettings} disabled={busy||JSON.stringify(draft)===JSON.stringify(settings)}><Save size={15}/>Save session security</button>:<p className="accessHelp">Only the Owner Admin can change these.</p>}
   </div>}
  </section>

  <section className="accessPanel"><div className="accessPanelHead"><div><h2>Who is signed in</h2><p>{online.length} online now · last 30 days of sign-ins. Online = active in the last 2 minutes.</p></div><button onClick={load}><RefreshCw size={15}/>Refresh</button></div>
   <div className="accessMatrixWrap"><table className="accessMatrix actTable"><thead><tr><th>Person</th><th>Status</th><th>Device</th><th>Signed in</th><th>Last activity</th><th></th></tr></thead><tbody>
    {team.filter(t=>t.role==='admin'||t.role==='staff').map(t=>{const s=latest.get(t.user_id);const st=s?sessionState(s,now):'never';return <tr key={t.user_id}>
     <td><b>{t.full_name||t.email}</b><small>{t.email}</small></td>
     <td><span className={`actState ${st}`}>{st==='online'?'Online':st==='idle'?'Open, idle':st==='ended'?`Signed out${s?.end_reason?` (${EVENT_LABELS[s.end_reason]||s.end_reason})`:''}`:st==='stale'?'Not seen recently':'Never signed in'}</span></td>
     <td><MonitorSmartphone size={14}/> {deviceLabel(s?.user_agent)}</td>
     <td>{fmt(s?.started_at)}</td><td>{fmt(s?.last_active_at)}</td>
     <td>{isOwner&&t.role!=='admin'&&t.user_id!==me&&<button className="danger" disabled={busy} onClick={()=>forceLogout(t.user_id)}><LogOut size={14}/>Sign out everywhere</button>}</td>
    </tr>})}
   </tbody></table></div>
  </section>

  <section className="accessPanel"><div className="accessPanelHead"><div><h2>User activity</h2><p>Sign-ins and sign-outs, pages opened, and every change to campaign records, with date and time. Other modules&apos; data changes are also in Audit Logs.</p></div><button onClick={exportCsv} disabled={!shown.length}><Download size={15}/>Export CSV</button></div>
   <div className="accessFilters actFilters">
    <label className="actDate">From<input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label>
    <label className="actDate">To<input type="date" value={to} min={from} max={today()} onChange={e=>setTo(e.target.value)}/></label>
    <select value={person} onChange={e=>setPerson(e.target.value)}><option value="all">Everyone</option>{team.map(t=><option key={t.user_id} value={t.user_id}>{t.full_name||t.email}</option>)}</select>
    <select value={event} onChange={e=>setEvent(e.target.value)}><option value="all">All activity</option>{Object.entries(EVENT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <select value={module} onChange={e=>setModule(e.target.value)}><option value="all">All modules</option>{modules.map(m=><option key={m.module_key} value={m.module_key}>{m.label}</option>)}</select>
    <label><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search page, record, details…"/></label>
   </div>
   <div className="actSummary">{summary.map(p=><article key={p.user_id||p.email}><b>{name(p.user_id,p.name||p.email)}</b><span>{p.logins} sign-ins · {p.pages} pages · {p.changes} changes</span><small>Last: {fmt(p.last)}</small></article>)}{!summary.length&&<p className="accessHelp">No activity in this period.</p>}</div>
   <div className="accessMatrixWrap"><table className="accessMatrix actTable"><thead><tr><th>Date & time</th><th>Person</th><th>Activity</th><th>Module</th><th>Details</th></tr></thead><tbody>
    {shown.slice(0,500).map(e=><tr key={e.id}><td>{fmt(e.created_at)}</td><td><b>{name(e.user_id,e.user_name||e.user_email)}</b></td><td><span className={`actEvent ${e.event}`}>{EVENT_LABELS[e.event]||e.event}</span></td><td>{modules.find(m=>m.module_key===e.module_key)?.label||e.module_key||'—'}</td><td>{e.description||e.path||'—'}{e.description&&e.path&&<small>{e.path}</small>}</td></tr>)}
    {!shown.length&&<tr><td colSpan={5}><span className="accessHelp">{loading?'Loading…':'No activity matches these filters.'}</span></td></tr>}
   </tbody></table></div>
   {shown.length>500&&<p className="accessHelp">Showing the latest 500 of {shown.length}. Export CSV for all of them, or narrow the dates.</p>}
  </section>
  <div className="accessSecurityNote"><ShieldCheck size={17}/><span>Activity rows cannot be edited or deleted from the admin. Changes to campaign households, camps, venues, vendors and targets are recorded automatically by the database.</span></div>
  <span hidden><Activity/></span>
 </div>
}

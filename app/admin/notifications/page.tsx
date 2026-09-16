'use client'

import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import {AlertTriangle,BellRing,CheckCircle2,Clock3,ExternalLink,ListTodo,RefreshCw,Search,UserPlus,XCircle} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import type {AdminAccess} from '../../../lib/adminAccess'

type Alert={id:string;notification_type:string;module_key:string;severity:'info'|'warning'|'critical'|'success';title:string;message:string|null;href:string|null;due_at:string|null;first_detected_at:string;last_detected_at:string;is_read:boolean;is_dismissed:boolean}
type Task={id:string;title:string;description:string|null;module_key:string;priority:'low'|'normal'|'high'|'urgent';status:'open'|'in_progress'|'done'|'cancelled';assigned_to:string;created_by:string|null;due_at:string|null;href:string|null;created_at:string;updated_at:string}
type Team={user_id:string;email:string|null;full_name:string|null;admin_role:string;staff_status:string;job_title:string|null}

const moduleLabels:Record<string,string>={orders:'Orders',rfqs:'RFQs',finance:'Finance',production:'Production',inventory:'Inventory',purchasing:'Purchasing',dashboard:'Dashboard',products:'Products',customers:'Customers',content:'Content',pricing:'Pricing',configurator:'Configurator'}
function fmt(v?:string|null){if(!v)return'—';return new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}
function isOverdue(v?:string|null){return Boolean(v&&new Date(v).getTime()<Date.now())}

export default function NotificationsPage(){
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[tab,setTab]=useState<'alerts'|'tasks'>('alerts'),[alerts,setAlerts]=useState<Alert[]>([]),[tasks,setTasks]=useState<Task[]>([]),[team,setTeam]=useState<Team[]>([]),[access,setAccess]=useState<AdminAccess|null>(null),[message,setMessage]=useState('')
 const [search,setSearch]=useState(''),[severity,setSeverity]=useState('all'),[module,setModule]=useState('all'),[readFilter,setReadFilter]=useState('all')
 const [taskForm,setTaskForm]=useState({title:'',description:'',module_key:'dashboard',priority:'normal',assigned_to:'',due_at:'',href:''})

 async function load(){
  setLoading(true);setMessage('')
  const {data:a}=await supabase.rpc('get_my_admin_access');const myAccess=(a||null) as AdminAccess|null;setAccess(myAccess)
  await supabase.rpc('refresh_workflow_notifications')
  const [feedRes,taskRes]=await Promise.all([supabase.rpc('workflow_notification_feed',{p_limit:150}),supabase.from('workflow_tasks').select('*').order('created_at',{ascending:false}).limit(150)])
  let teamRows:Team[]=[]
  if(myAccess?.role==='admin'){const t=await supabase.rpc('admin_list_team');teamRows=((t.data||[]) as Team[]).filter(x=>x.staff_status==='active')}
  setAlerts((feedRes.data||[]) as Alert[]);setTasks((taskRes.data||[]) as Task[]);setTeam(teamRows);setLoading(false)
  if(feedRes.error||taskRes.error)setMessage(feedRes.error?.message||taskRes.error?.message||'Could not load workflow data.')
 }
 useEffect(()=>{load()},[])

 const unread=alerts.filter(a=>!a.is_read).length,critical=alerts.filter(a=>a.severity==='critical').length,overdue=alerts.filter(a=>isOverdue(a.due_at)).length,myOpen=tasks.filter(t=>t.status==='open'||t.status==='in_progress').length
 const modules=useMemo(()=>Array.from(new Set(alerts.map(a=>a.module_key))).sort(),[alerts])
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return alerts.filter(a=>(severity==='all'||a.severity===severity)&&(module==='all'||a.module_key===module)&&(readFilter==='all'||(readFilter==='unread'&&!a.is_read)||(readFilter==='read'&&a.is_read))&&(!q||`${a.title} ${a.message||''} ${a.module_key}`.toLowerCase().includes(q)))},[alerts,search,severity,module,readFilter])

 async function mark(id:string,action:'read'|'unread'|'dismiss'){setBusy(true);const {error}=await supabase.rpc('workflow_mark_notification',{p_notification_id:id,p_action:action});setBusy(false);if(error){setMessage(error.message);return}await load()}
 async function markAll(){setBusy(true);const {error}=await supabase.rpc('workflow_mark_all_read');setBusy(false);if(error){setMessage(error.message);return}await load()}
 async function createTask(){if(!taskForm.title.trim()||!taskForm.assigned_to)return;setBusy(true);const {error}=await supabase.rpc('workflow_create_task',{p_title:taskForm.title.trim(),p_description:taskForm.description.trim()||null,p_module_key:taskForm.module_key,p_priority:taskForm.priority,p_assigned_to:taskForm.assigned_to,p_due_at:taskForm.due_at?new Date(taskForm.due_at).toISOString():null,p_href:taskForm.href.trim()||null});setBusy(false);if(error){setMessage(error.message);return}setTaskForm({title:'',description:'',module_key:'dashboard',priority:'normal',assigned_to:'',due_at:'',href:''});setMessage('Task assigned.');await load()}
 async function updateTask(id:string,status:Task['status']){setBusy(true);const {error}=await supabase.rpc('workflow_update_task_status',{p_task_id:id,p_status:status});setBusy(false);if(error){setMessage(error.message);return}await load()}

 if(loading)return <div className="notifyV2"><div className="notifyLoading">Loading workflow alerts…</div></div>
 return <div className="notifyV2">
  <div className="notifyHead"><div><span className="adminEyebrow">WORKFLOW CONTROL</span><h1>Notifications & Tasks</h1><p>One queue for sales follow-ups, finance ageing, production delays, stock alerts, purchase exceptions, dispatch readiness and assigned work.</p></div><button onClick={load} className="notifyRefresh"><RefreshCw size={16}/> Refresh</button></div>
  {message&&<div className="notifyMessage"><BellRing size={16}/>{message}</div>}

  <div className="notifyStats"><article><span><BellRing/></span><div><small>Unread</small><strong>{unread}</strong><p>{alerts.length} active alerts</p></div></article><article><span><AlertTriangle/></span><div><small>Critical</small><strong>{critical}</strong><p>Needs immediate action</p></div></article><article><span><Clock3/></span><div><small>Overdue</small><strong>{overdue}</strong><p>Past due time/date</p></div></article><article><span><ListTodo/></span><div><small>Open Tasks</small><strong>{myOpen}</strong><p>Assigned or visible to you</p></div></article></div>

  <div className="notifyTabs"><button className={tab==='alerts'?'active':''} onClick={()=>setTab('alerts')}><BellRing size={16}/> Alert Center</button><button className={tab==='tasks'?'active':''} onClick={()=>setTab('tasks')}><ListTodo size={16}/> Staff Tasks</button></div>

  {tab==='alerts'&&<section className="notifyPanel">
   <div className="notifyToolbar"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search alerts…"/></label><select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="all">All severity</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option><option value="success">Success</option></select><select value={module} onChange={e=>setModule(e.target.value)}><option value="all">All modules</option>{modules.map(m=><option key={m} value={m}>{moduleLabels[m]||m}</option>)}</select><select value={readFilter} onChange={e=>setReadFilter(e.target.value)}><option value="all">Read + unread</option><option value="unread">Unread only</option><option value="read">Read only</option></select><button onClick={markAll} disabled={busy||!alerts.length}><CheckCircle2 size={15}/> Mark all read</button></div>
   <div className="notifyList">{filtered.length?filtered.map(a=><article key={a.id} className={`notifyItem ${a.severity} ${a.is_read?'read':'unread'}`}><div className="notifyDot"/><div className="notifyMain"><div className="notifyTitle"><span className={`notifySeverity ${a.severity}`}>{a.severity}</span><span>{moduleLabels[a.module_key]||a.module_key}</span>{a.due_at&&<span className={isOverdue(a.due_at)?'overdue':''}><Clock3 size={13}/>{fmt(a.due_at)}</span>}</div><h3>{a.title}</h3>{a.message&&<p>{a.message}</p>}<small>Detected {fmt(a.first_detected_at)} · Updated {fmt(a.last_detected_at)}</small></div><div className="notifyActions">{a.href&&<Link href={a.href} onClick={()=>{if(!a.is_read)mark(a.id,'read')}}><ExternalLink size={15}/> Open</Link>}<button onClick={()=>mark(a.id,a.is_read?'unread':'read')} disabled={busy}>{a.is_read?'Unread':'Mark read'}</button><button className="quiet" onClick={()=>mark(a.id,'dismiss')} disabled={busy}><XCircle size={15}/> Dismiss</button></div></article>):<div className="notifyEmpty">No active alerts match these filters.</div>}</div>
  </section>}

  {tab==='tasks'&&<div className="notifyTaskLayout">
   {access?.role==='admin'&&<section className="notifyPanel notifyCreateTask"><div className="notifyPanelHead"><div><h2>Assign Task</h2><p>Create an internal action and route it to one staff member.</p></div><UserPlus/></div><label>Task title<input value={taskForm.title} onChange={e=>setTaskForm(v=>({...v,title:e.target.value}))} placeholder="Follow up EPC quotation"/></label><label>Description<textarea value={taskForm.description} onChange={e=>setTaskForm(v=>({...v,description:e.target.value}))} placeholder="Add the exact action required…"/></label><div className="notifyTwo"><label>Assign to<select value={taskForm.assigned_to} onChange={e=>setTaskForm(v=>({...v,assigned_to:e.target.value}))}><option value="">Select staff</option>{team.map(t=><option value={t.user_id} key={t.user_id}>{t.full_name||t.email} · {t.admin_role}</option>)}</select></label><label>Priority<select value={taskForm.priority} onChange={e=>setTaskForm(v=>({...v,priority:e.target.value}))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div><div className="notifyTwo"><label>Module<select value={taskForm.module_key} onChange={e=>setTaskForm(v=>({...v,module_key:e.target.value}))}>{Object.entries(moduleLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Due at<input type="datetime-local" value={taskForm.due_at} onChange={e=>setTaskForm(v=>({...v,due_at:e.target.value}))}/></label></div><label>Open link<input value={taskForm.href} onChange={e=>setTaskForm(v=>({...v,href:e.target.value}))} placeholder="/admin/rfqs"/></label><button className="notifyPrimary" onClick={createTask} disabled={busy||!taskForm.title.trim()||!taskForm.assigned_to}><UserPlus size={16}/> Assign Task</button></section>}
   <section className="notifyPanel notifyTasks"><div className="notifyPanelHead"><div><h2>Task Queue</h2><p>Open, in-progress and completed internal actions visible to your account.</p></div></div><div className="notifyTaskRows">{tasks.length?tasks.map(t=><article key={t.id} className={`notifyTask ${t.priority}`}><div><div className="notifyTaskMeta"><span>{t.priority}</span><span>{moduleLabels[t.module_key]||t.module_key}</span><span className={t.due_at&&isOverdue(t.due_at)&&t.status!=='done'?'overdue':''}><Clock3 size={13}/>{fmt(t.due_at)}</span></div><h3>{t.title}</h3>{t.description&&<p>{t.description}</p>}<small>Created {fmt(t.created_at)}</small></div><div className="notifyTaskActions">{t.href&&<Link href={t.href}><ExternalLink size={15}/> Open</Link>}<select value={t.status} onChange={e=>updateTask(t.id,e.target.value as Task['status'])} disabled={busy}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></div></article>):<div className="notifyEmpty">No workflow tasks yet.</div>}</div></section>
  </div>}
 </div>
}

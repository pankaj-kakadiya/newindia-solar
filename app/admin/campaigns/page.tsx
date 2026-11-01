'use client'

import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import * as XLSX from 'xlsx'
import {ArrowRight,Calculator,CalendarClock,Check,Download,LayoutDashboard,MapPin,MessageCircle,Phone,Plus,RefreshCw,Save,Search,Tent,Target,Trash2,Upload,Users,X} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import {canAdmin} from '../../../lib/adminAccess'
import {CAMPAIGN_DISTRICTS,CAMPAIGN_METRICS,CAMPAIGN_STAGES,SURYA_GHAR_RULES,calcSuryaGharSubsidy,leadsFromSheetRows,metricActual,normalizeMobile,reachedStage,stageLabel,whatsappLink} from '../../../lib/surya-ghar-campaign'

type Tab='overview'|'leads'|'camps'|'targets'|'calculator'
const money=(n:any)=>`₹${Math.round(Number(n||0)).toLocaleString('en-IN')}`
const day=(v:any)=>v?new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'
const dateInput=(v:any)=>v?String(v).slice(0,10):''
const followIso=(d:string)=>d?`${d}T10:00:00+05:30`:null
const openStage=(s:string)=>s!=='subsidy_received'&&s!=='lost'
const catLabel=(c:string)=>c==='sc'?'SC':c==='st'?'ST':'General'
const campStatus:Record<string,string>={planned:'Planned',announced:'Announced',completed:'Completed',cancelled:'Cancelled'}
const PRE_EVENT=[['sarpanch','Sarpanch / talati meeting done'],['vendor','Partner vendor price locked in writing'],['bank','Bank loan officer confirmed'],['whatsapp','WhatsApp invite posted in village groups'],['posters','Posters at dairy, ration shop, temple'],['rickshaw','Loudspeaker rickshaw round (day before)']]
const KIT=[['demo','Demo kit: panel, inverter, ACDB + DCDB'],['pamphlets','300 pamphlets + banner'],['gr','5 printed copies of the GR'],['devices','2 phones/laptops with data + power bank'],['sound','Mic, speaker, seating, water']]
const blankLead=(camp?:any)=>({full_name:'',mobile:'',village:camp?.village||'',taluka:camp?.taluka||'',district:camp?.district||'Amreli',camp_id:camp?.id||'',consumer_number:'',category:'general',avg_monthly_units:'',system_kw:'2.18',portal_registered:false,portal_application_no:'',loan_needed:false,bank_name:'',quoted_price:'',stage:'lead',survey_date:'',install_date:'',commission_date:'',central_subsidy_received:false,state_subsidy_received:false,next_follow_up_at:'',assigned_to:'',lost_reason:'',notes:''})
const blankCamp=(n:number)=>({camp_code:`C${String(n).padStart(2,'0')}`,camp_date:'',village:'',taluka:'',district:'Amreli',venue:'',status:'planned',sarpanch_name:'',sarpanch_phone:'',partner_vendor:'',bank_partner:'',attendance:'',checklist:{},notes:''})
const waText=(l:any)=>`નમસ્તે ${l.full_name||''}, ન્યૂ ઇન્ડિયા સોલાર તરફથી. PM સૂર્ય ઘર + ગુજરાત સરકારની નવી સબસિડી સાથે તમારી ${l.system_kw?`${l.system_kw} kW `:''}સોલાર અરજી અંગે વાત કરવી છે. અનુકૂળ સમય જણાવશો? +91 99099 77507`

export default function SuryaGharCampaign(){
 const [tab,setTab]=useState<Tab>('overview')
 const [leads,setLeads]=useState<any[]>([]),[camps,setCamps]=useState<any[]>([]),[targets,setTargets]=useState<any[]>([]),[staff,setStaff]=useState<any[]>([]),[access,setAccess]=useState<any>(null)
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[msg,setMsg]=useState(''),[err,setErr]=useState('')
 const [q,setQ]=useState(''),[fDistrict,setFDistrict]=useState('all'),[fCamp,setFCamp]=useState('all'),[fStage,setFStage]=useState('all'),[dueOnly,setDueOnly]=useState(false)
 const [lead,setLead]=useState<any>(null),[activities,setActivities]=useState<any[]>([]),[note,setNote]=useState(''),[camp,setCamp]=useState<any>(null)
 const [calcKw,setCalcKw]=useState('2.18'),[calcCat,setCalcCat]=useState<'general'|'sc'|'st'>('general')
 const can=(a:'create'|'edit'|'delete'|'export')=>canAdmin(access,'campaigns',a)

 async function load(){
  setLoading(true);setErr('')
  const [l,c,t,s,a]=await Promise.all([
   supabase.from('campaign_leads').select('*').order('created_at',{ascending:false}).limit(5000),
   supabase.from('campaign_camps').select('*').order('camp_date',{ascending:false,nullsFirst:false}).limit(500),
   supabase.from('campaign_targets').select('*').order('sort_order').order('created_at'),
   supabase.from('profiles').select('id,full_name,company_name,role').in('role',['admin','staff']).order('full_name'),
   supabase.rpc('get_my_admin_access'),
  ])
  const first=l.error||c.error||t.error
  if(first)setErr(/does not exist|schema cache/i.test(first.message)?'Campaign tables are not set up yet. Apply the Surya Ghar campaign database migration, then refresh.':first.message)
  setLeads(l.data||[]);setCamps(c.data||[]);setTargets(t.data||[]);setStaff(s.data||[]);setAccess(a.data||null);setLoading(false)
 }
 useEffect(()=>{load()},[])

 const now=Date.now()
 const isDue=(l:any)=>openStage(l.stage)&&l.next_follow_up_at&&new Date(l.next_follow_up_at).getTime()<now
 const campById=useMemo(()=>Object.fromEntries(camps.map(c=>[c.id,c])),[camps])
 const staffName=(id:string)=>staff.find(s=>s.id===id)?.full_name||''
 const filtered=useMemo(()=>leads.filter(l=>{
  const text=`${l.full_name||''} ${l.mobile||''} ${l.village||''} ${l.taluka||''} ${l.consumer_number||''} ${l.portal_application_no||''}`.toLowerCase()
  return text.includes(q.toLowerCase())&&(fDistrict==='all'||l.district===fDistrict)&&(fCamp==='all'||(fCamp==='none'?!l.camp_id:l.camp_id===fCamp))&&(fStage==='all'||l.stage===fStage)&&(!dueOnly||isDue(l))
 }),[leads,q,fDistrict,fCamp,fStage,dueOnly])
 const due=leads.filter(isDue).sort((a,b)=>+new Date(a.next_follow_up_at)-+new Date(b.next_follow_up_at))
 const active=leads.filter(l=>l.stage!=='lost')

 function flash(m:string){setMsg(m);setErr('');window.setTimeout(()=>setMsg(''),4000)}

 // ---- leads
 async function openLead(l:any){
  setLead({...blankLead(),...l,camp_id:l.camp_id||'',assigned_to:l.assigned_to||'',system_kw:l.system_kw??'',avg_monthly_units:l.avg_monthly_units??'',quoted_price:l.quoted_price??'',next_follow_up_at:dateInput(l.next_follow_up_at)})
  setNote('');setActivities([])
  if(l.id){const {data}=await supabase.from('campaign_lead_activities').select('*').eq('lead_id',l.id).order('created_at',{ascending:false}).limit(100);setActivities(data||[])}
 }
 async function saveLead(){
  if(!lead)return
  const mobile=lead.mobile?normalizeMobile(lead.mobile):null
  if(!lead.full_name.trim()){setErr('Household name is required.');return}
  if(lead.mobile&&!mobile){setErr('Mobile must be a valid 10-digit Indian number.');return}
  const num=(v:any)=>v===''||v==null?null:Number(v)
  const payload={full_name:lead.full_name.trim(),mobile,village:lead.village||null,taluka:lead.taluka||null,district:lead.district,camp_id:lead.camp_id||null,consumer_number:lead.consumer_number?.trim()||null,category:lead.category,avg_monthly_units:num(lead.avg_monthly_units),system_kw:num(lead.system_kw),portal_registered:Boolean(lead.portal_registered)||reachedStage(lead.stage,'registered'),portal_application_no:lead.portal_application_no||null,loan_needed:Boolean(lead.loan_needed),bank_name:lead.bank_name||null,quoted_price:num(lead.quoted_price),stage:lead.stage,survey_date:lead.survey_date||null,install_date:lead.install_date||null,commission_date:lead.commission_date||null,central_subsidy_received:Boolean(lead.central_subsidy_received),state_subsidy_received:Boolean(lead.state_subsidy_received),next_follow_up_at:followIso(lead.next_follow_up_at),assigned_to:lead.assigned_to||null,lost_reason:lead.stage==='lost'?lead.lost_reason||null:null,notes:lead.notes||null}
  setSaving(true)
  const res=lead.id?await supabase.from('campaign_leads').update(payload).eq('id',lead.id).select().single():await supabase.from('campaign_leads').insert(payload).select().single()
  setSaving(false)
  if(res.error){setErr(/consumer_number/.test(res.error.message)?'A lead with this PGVCL consumer number already exists.':res.error.message);return}
  flash(lead.id?'Lead saved.':'Lead added.');await load();await openLead(res.data)
 }
 async function deleteLead(){if(!lead?.id||!confirm(`Delete ${lead.full_name}? This removes the lead and its activity.`))return;const {error}=await supabase.from('campaign_leads').delete().eq('id',lead.id);if(error){setErr(error.message);return}setLead(null);flash('Lead deleted.');load()}
 async function quickStage(id:string,stage:string){const patch:any={stage};if(reachedStage(stage,'registered'))patch.portal_registered=true;const {error}=await supabase.from('campaign_leads').update(patch).eq('id',id);if(error)setErr(error.message);else load()}
 async function logActivity(leadId:string,type:string,message:string){const {data:{user}}=await supabase.auth.getUser();return supabase.from('campaign_lead_activities').insert({lead_id:leadId,activity_type:type,message,created_by:user?.id||null})}
 async function addNote(){if(!lead?.id||!note.trim())return;const {error}=await logActivity(lead.id,'note',note.trim());if(error){setErr(error.message);return}setNote('');openLead(lead)}
 function whatsapp(l:any){const link=whatsappLink(l.mobile,waText(l));if(!link)return;window.open(link,'_blank','noopener');if(l.id&&(can('create')||can('edit')))void logActivity(l.id,'whatsapp','WhatsApp follow-up opened')}

 async function importSheet(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file)return
  try{
   const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true})
   const ws=wb.Sheets['Leads']||wb.Sheets[wb.SheetNames[0]]
   const grid=XLSX.utils.sheet_to_json<any[]>(ws,{header:1,raw:true,defval:''})
   const h=grid.findIndex(r=>r.some((c:any)=>String(c).trim().toLowerCase()==='name'))
   if(h<0){setErr('No "Name" column found. Use the Village Solar Campaign lead tracker or a sheet with the same headers.');return}
   const headers=grid[h].map((c:any)=>String(c))
   const rows=grid.slice(h+1).map(r=>Object.fromEntries(headers.map((k,i)=>[k,r[i]])))
   const {leads:parsed,skipped}=leadsFromSheetRows(rows)
   if(!parsed.length){setErr('No household rows to import.');return}
   if(!confirm(`Import ${parsed.length} households from ${file.name}?`))return
   setSaving(true);let ok=0,failed=0,noCamp=0
   const byCode=Object.fromEntries(camps.map(c=>[String(c.camp_code).toLowerCase(),c.id]))
   for(const p of parsed){const {camp_code,...row}=p;const camp_id=camp_code?byCode[String(camp_code).toLowerCase()]||null:null;if(camp_code&&!camp_id)noCamp++;const {error}=await supabase.from('campaign_leads').insert({...row,camp_id,next_follow_up_at:followIso(row.next_follow_up_at||''),lead_source:'excel_import'});if(error)failed++;else ok++}
   setSaving(false);await load()
   flash(`Imported ${ok} households.${failed?` ${failed} failed (duplicate consumer number or invalid data).`:''}${skipped?` ${skipped} blank/example rows skipped.`:''}${noCamp?` ${noCamp} had an unknown Camp ID.`:''}`)
  }catch(x:any){setSaving(false);setErr(`Could not read the file: ${x?.message||x}`)}
 }
 function exportCsv(){
  const head=['Camp','Village','Taluka','District','Name','Mobile','Consumer no.','Category','Avg units','System kW','Household pays (₹)','Portal registered','Application no.','Loan needed','Stage','Survey date','Install date','Commission date','Central subsidy received','State subsidy received','Next follow-up','Owner','Notes']
  const body=filtered.map(l=>[campById[l.camp_id]?.camp_code||'',l.village,l.taluka,l.district,l.full_name,l.mobile,l.consumer_number,catLabel(l.category),l.avg_monthly_units,l.system_kw,l.system_kw?calcSuryaGharSubsidy(l.system_kw,l.category).householdPays:'',l.portal_registered?'Yes':'No',l.portal_application_no,l.loan_needed?'Yes':'No',stageLabel(l.stage),l.survey_date,l.install_date,l.commission_date,l.central_subsidy_received?'Yes':'No',l.state_subsidy_received?'Yes':'No',dateInput(l.next_follow_up_at),staffName(l.assigned_to),l.notes])
  const csv=[head,...body].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));a.download='surya-ghar-campaign-leads.csv';a.click()
 }

 // ---- camps
 async function saveCamp(){
  if(!camp)return
  if(!camp.camp_code.trim()||!camp.village.trim()){setErr('Camp ID and village are required.');return}
  const payload={camp_code:camp.camp_code.trim(),camp_date:camp.camp_date||null,village:camp.village.trim(),taluka:camp.taluka||null,district:camp.district,venue:camp.venue||null,status:camp.status,sarpanch_name:camp.sarpanch_name||null,sarpanch_phone:camp.sarpanch_phone||null,partner_vendor:camp.partner_vendor||null,bank_partner:camp.bank_partner||null,attendance:camp.attendance===''||camp.attendance==null?null:Number(camp.attendance),checklist:camp.checklist||{},notes:camp.notes||null}
  setSaving(true)
  const {error}=camp.id?await supabase.from('campaign_camps').update(payload).eq('id',camp.id):await supabase.from('campaign_camps').insert(payload)
  setSaving(false)
  if(error){setErr(/camp_code/.test(error.message)?'That Camp ID is already used.':error.message);return}
  setCamp(null);flash('Camp saved.');load()
 }
 async function deleteCamp(){if(!camp?.id||!confirm(`Delete camp ${camp.camp_code}? Its leads stay, without a camp.`))return;const {error}=await supabase.from('campaign_camps').delete().eq('id',camp.id);if(error){setErr(error.message);return}setCamp(null);flash('Camp deleted.');load()}
 const campStats=(id:string)=>{const L=leads.filter(l=>l.camp_id===id);return{leads:L.length,registered:L.filter(l=>l.portal_registered||reachedStage(l.stage,'registered')).length,commissioned:L.filter(l=>reachedStage(l.stage,'commissioned')).length}}

 // ---- targets
 async function saveTarget(t:any){const payload={metric_key:t.metric_key,label:t.label?.trim()||CAMPAIGN_METRICS.find(m=>m.key===t.metric_key)?.label||t.metric_key,target_value:Number(t.target_value),due_date:t.due_date||null,district:t.district||null,sort_order:Number(t.sort_order||100)};if(!(payload.target_value>0)){setErr('Target must be more than zero.');return}const {error}=t.id?await supabase.from('campaign_targets').update(payload).eq('id',t.id):await supabase.from('campaign_targets').insert(payload);if(error){setErr(error.message);return}flash('Target saved.');load()}
 async function deleteTarget(t:any){if(!t.id){setTargets(x=>x.filter(y=>y!==t));return}if(!confirm(`Delete target "${t.label}"?`))return;const {error}=await supabase.from('campaign_targets').delete().eq('id',t.id);if(error){setErr(error.message);return}load()}
 const editTarget=(i:number,k:string,v:any)=>setTargets(x=>x.map((t,j)=>j===i?{...t,[k]:v}:t))
 const targetProgress=(t:any)=>{const actual=metricActual(t.metric_key,leads,camps,t.district);const pct=t.target_value?Math.min(100,Math.round(actual/t.target_value*100)):0;const daysLeft=t.due_date?Math.ceil((new Date(`${t.due_date}T23:59:59+05:30`).getTime()-now)/864e5):null;return{actual,pct,daysLeft}}

 const subsidy=lead?calcSuryaGharSubsidy(lead.system_kw,lead.category):null
 const calc=calcSuryaGharSubsidy(calcKw,calcCat)

 return <div className="rfqV2 campV1">
  <div className="rfqHero"><div><span className="adminEyebrow">PM SURYA GHAR · GUJARAT STATE TOP-UP</span><h1>Surya Ghar Village Campaign</h1><p>Village camps, household leads and the subsidy pipeline for Gir Somnath, Amreli and Bhavnagar. Households pay 10% of the benchmark (SC/ST 5%) up to {SURYA_GHAR_RULES.stateLimitKw} kW under GR {SURYA_GHAR_RULES.grNumber}.</p></div><div className="rfqHeroActions"><button className="adminBtn ghost" onClick={load}><RefreshCw size={16}/>Refresh</button>{can('export')&&<button className="adminBtn ghost" onClick={exportCsv}><Download size={16}/>Export leads</button>}</div></div>
  {msg&&<div className="themeMessage"><Check size={16}/>{msg}</div>}
  {err&&<div className="themeMessage campError"><X size={16}/>{err}</div>}

  <div className="rfqStats">
   <div><span>Households</span><b>{active.length}</b><small>{leads.length-active.length} lost · {(n=>`${n} camp${n===1?'':'s'} held`)(camps.filter(c=>c.status==='completed').length)}</small></div>
   <div><span>Portal registered</span><b>{metricActual('registrations',leads,camps)}</b><small>{metricActual('surveys',leads,camps)} site surveys done</small></div>
   <div><span>Commissioned</span><b>{metricActual('commissioned',leads,camps)}</b><small>{metricActual('subsidy_received',leads,camps)} subsidy received</small></div>
   <div><span>Follow-ups due</span><b className={due.length?'followDue':''}>{due.length}</b><small>{leads.filter(l=>openStage(l.stage)&&!l.next_follow_up_at).length} open leads with no date</small></div>
  </div>

  <div className="reportsTabs" role="tablist">
   <button role="tab" aria-selected={tab==='overview'} className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><LayoutDashboard size={16}/>Overview</button>
   <button role="tab" aria-selected={tab==='leads'} className={tab==='leads'?'active':''} onClick={()=>setTab('leads')}><Users size={16}/>Leads ({leads.length})</button>
   <button role="tab" aria-selected={tab==='camps'} className={tab==='camps'?'active':''} onClick={()=>setTab('camps')}><Tent size={16}/>Village camps ({camps.length})</button>
   <button role="tab" aria-selected={tab==='targets'} className={tab==='targets'?'active':''} onClick={()=>setTab('targets')}><Target size={16}/>Targets</button>
   <button role="tab" aria-selected={tab==='calculator'} className={tab==='calculator'?'active':''} onClick={()=>setTab('calculator')}><Calculator size={16}/>Subsidy calculator</button>
  </div>

  {loading?<section className="adminPanel"><p className="emptyCell">Loading campaign…</p></section>:<>

  {tab==='overview'&&<div className="campOverview">
   <section className="adminPanel campPanel"><h2><Target size={18}/>Targets</h2>{targets.length?<div className="campTargets">{targets.map(t=>{const p=targetProgress(t);return <div key={t.id} className="campTarget"><div className="campTargetHead"><b>{t.label}{t.district?` · ${t.district}`:''}</b><span>{p.actual} / {t.target_value}</span></div><div className="campBar" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={t.label}><i style={{width:`${p.pct}%`}}/></div><small>{p.pct}% done{p.daysLeft!=null?` · ${p.daysLeft>0?`${p.daysLeft} days left`:'due date passed'} (${day(t.due_date)})`:''}</small></div>})}</div>:<p className="muted">No targets yet. Add them in the Targets tab.</p>}</section>
   <section className="adminPanel campPanel"><h2><ArrowRight size={18}/>Pipeline by stage</h2><div className="campFunnel">{CAMPAIGN_STAGES.map(s=>{const n=leads.filter(l=>l.stage===s.key).length;const w=leads.length?Math.max(n?4:0,Math.round(n/leads.length*100)):0;return <button key={s.key} className="campFunnelRow" onClick={()=>{setFStage(s.key);setTab('leads')}}><span>{s.label}</span><div className={`campBar ${s.key==='lost'?'lost':''}`}><i style={{width:`${w}%`}}/></div><b>{n}</b></button>})}</div></section>
   <section className="adminPanel campPanel campWide"><h2><MapPin size={18}/>By district</h2><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>District</th><th className="num">Camps held</th><th className="num">Leads</th><th className="num">Registered</th><th className="num">Surveys</th><th className="num">Commissioned</th><th className="num">Subsidy received</th></tr></thead><tbody>{CAMPAIGN_DISTRICTS.map(d=><tr key={d}><td><b>{d}</b></td>{['camps_held','leads','registrations','surveys','commissioned','subsidy_received'].map(m=><td className="num" key={m}>{metricActual(m,leads,camps,d)}</td>)}</tr>)}</tbody></table></div></section>
   <section className="adminPanel campPanel campWide"><h2><CalendarClock size={18}/>Follow-ups due</h2>{due.length?<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Household</th><th>Village</th><th>Stage</th><th>Due</th><th>Owner</th><th></th></tr></thead><tbody>{due.slice(0,15).map(l=><tr key={l.id}><td><button className="rfqOpportunity" onClick={()=>openLead(l)}><b>{l.full_name}</b><span>{l.mobile||'No mobile'}</span></button></td><td>{l.village||'—'}</td><td>{stageLabel(l.stage)}</td><td><span className="followDue">{day(l.next_follow_up_at)}</span></td><td>{staffName(l.assigned_to)||<span className="muted">Unassigned</span>}</td><td className="campRowActions">{l.mobile&&<a className="iconBtn" href={`tel:+91${l.mobile}`} aria-label={`Call ${l.full_name}`}><Phone size={16}/></a>}{l.mobile&&<button className="iconBtn" onClick={()=>whatsapp(l)} aria-label={`WhatsApp ${l.full_name}`}><MessageCircle size={16}/></button>}</td></tr>)}</tbody></table></div>:<p className="muted">Nothing overdue.</p>}</section>
   <section className="adminPanel campPanel campWide"><h2><Tent size={18}/>Camp performance</h2>{camps.length?<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Camp</th><th>Date</th><th>Village</th><th>Status</th><th className="num">Attendance</th><th className="num">Leads</th><th className="num">Registered</th><th className="num">Commissioned</th><th className="num">Lead rate</th></tr></thead><tbody>{camps.map(c=>{const s=campStats(c.id);return <tr key={c.id}><td><button className="rfqOpportunity" onClick={()=>setCamp({...blankCamp(0),...c,attendance:c.attendance??''})}><b>{c.camp_code}</b><span>{c.partner_vendor||'Vendor not set'}</span></button></td><td>{day(c.camp_date)}</td><td>{c.village}<span className="tableSub">{[c.taluka,c.district].filter(Boolean).join(', ')}</span></td><td><span className={`campBadge ${c.status}`}>{campStatus[c.status]}</span></td><td className="num">{c.attendance??'—'}</td><td className="num">{s.leads}</td><td className="num">{s.registered}</td><td className="num">{s.commissioned}</td><td className="num">{c.attendance?`${Math.round(s.leads/c.attendance*100)}%`:'—'}</td></tr>})}</tbody></table></div>:<p className="muted">No camps yet. Add the first one in Village camps.</p>}</section>
  </div>}

  {tab==='leads'&&<>
   <section className="campToolbar">
    <div className="rfqSearch"><Search size={17}/><input aria-label="Search leads" placeholder="Search name, mobile, village, consumer no…" value={q} onChange={e=>setQ(e.target.value)}/></div>
    <select aria-label="District" value={fDistrict} onChange={e=>setFDistrict(e.target.value)}><option value="all">All districts</option>{CAMPAIGN_DISTRICTS.map(d=><option key={d}>{d}</option>)}</select>
    <select aria-label="Camp" value={fCamp} onChange={e=>setFCamp(e.target.value)}><option value="all">All camps</option><option value="none">No camp</option>{camps.map(c=><option key={c.id} value={c.id}>{c.camp_code} · {c.village}</option>)}</select>
    <select aria-label="Stage" value={fStage} onChange={e=>setFStage(e.target.value)}><option value="all">All stages</option>{CAMPAIGN_STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select>
    <label className="campCheck"><input type="checkbox" checked={dueOnly} onChange={e=>setDueOnly(e.target.checked)}/>Follow-up due</label>
    <div className="campToolbarActions">
     {can('create')&&<label className="adminBtn ghost"><Upload size={16}/>{saving?'Importing…':'Import Excel'}<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={importSheet} disabled={saving}/></label>}
     {can('create')&&<button className="adminBtn" onClick={()=>openLead(blankLead(fCamp!=='all'&&fCamp!=='none'?campById[fCamp]:undefined))}><Plus size={16}/>Add lead</button>}
    </div>
   </section>
   <section className="adminPanel rfqTablePanel"><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Household</th><th>Village / camp</th><th>System</th><th className="num">Household pays</th><th>Stage</th><th>Follow-up</th><th></th></tr></thead><tbody>
    {filtered.length?filtered.map(l=>{const s=l.system_kw?calcSuryaGharSubsidy(l.system_kw,l.category):null;return <tr key={l.id}>
     <td><button className="rfqOpportunity" onClick={()=>openLead(l)}><b>{l.full_name}</b><span>{l.mobile||'No mobile'}{l.consumer_number?` · ${l.consumer_number}`:''}</span></button></td>
     <td>{l.village||'—'}<span className="tableSub">{campById[l.camp_id]?.camp_code||'No camp'} · {l.district}</span></td>
     <td>{l.system_kw?`${l.system_kw} kW`:'—'}<span className="tableSub">{catLabel(l.category)}{s&&!s.stateEligible?' · no state top-up':''}</span></td>
     <td className="num">{s?money(s.householdPays):'—'}</td>
     <td>{can('edit')?<select aria-label={`Stage for ${l.full_name}`} className="stageSelect" value={l.stage} onChange={e=>quickStage(l.id,e.target.value)}>{CAMPAIGN_STAGES.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select>:stageLabel(l.stage)}</td>
     <td><span className={isDue(l)?'followDue':''}>{day(l.next_follow_up_at)}</span></td>
     <td className="campRowActions">{l.mobile&&<a className="iconBtn" href={`tel:+91${l.mobile}`} aria-label={`Call ${l.full_name}`}><Phone size={16}/></a>}{l.mobile&&<button className="iconBtn" onClick={()=>whatsapp(l)} aria-label={`WhatsApp ${l.full_name}`}><MessageCircle size={16}/></button>}<button className="iconBtn" onClick={()=>openLead(l)} aria-label={`Open ${l.full_name}`}><ArrowRight size={16}/></button></td>
    </tr>}):<tr><td colSpan={7} className="emptyCell">{leads.length?'No leads match these filters.':'No leads yet. Add one, or import the Excel lead tracker.'}</td></tr>}
   </tbody></table></div></section>
  </>}

  {tab==='camps'&&<>
   <section className="campToolbar"><p className="muted campToolbarNote">One row per village camp. Leads link to a camp by its Camp ID.</p><div className="campToolbarActions">{can('create')&&<button className="adminBtn" onClick={()=>setCamp(blankCamp(camps.length+1))}><Plus size={16}/>Add camp</button>}</div></section>
   <section className="adminPanel rfqTablePanel"><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Camp</th><th>Date</th><th>Village</th><th>Status</th><th>Prep</th><th className="num">Attendance</th><th className="num">Leads</th><th className="num">Registered</th><th></th></tr></thead><tbody>
    {camps.length?camps.map(c=>{const s=campStats(c.id);const done=[...PRE_EVENT,...KIT].filter(([k])=>c.checklist?.[k]).length;return <tr key={c.id}>
     <td><button className="rfqOpportunity" onClick={()=>setCamp({...blankCamp(0),...c,attendance:c.attendance??''})}><b>{c.camp_code}</b><span>{c.venue||'Venue not set'}</span></button></td>
     <td>{day(c.camp_date)}</td><td>{c.village}<span className="tableSub">{[c.taluka,c.district].filter(Boolean).join(', ')}</span></td>
     <td><span className={`campBadge ${c.status}`}>{campStatus[c.status]}</span></td>
     <td>{done}/{PRE_EVENT.length+KIT.length}</td><td className="num">{c.attendance??'—'}</td><td className="num">{s.leads}</td><td className="num">{s.registered}</td>
     <td className="campRowActions"><button className="iconBtn" onClick={()=>{setFCamp(c.id);setTab('leads')}} aria-label={`Leads from ${c.camp_code}`}><Users size={16}/></button><button className="iconBtn" onClick={()=>setCamp({...blankCamp(0),...c,attendance:c.attendance??''})} aria-label={`Open ${c.camp_code}`}><ArrowRight size={16}/></button></td>
    </tr>}):<tr><td colSpan={9} className="emptyCell">No camps yet.</td></tr>}
   </tbody></table></div></section>
  </>}

  {tab==='targets'&&<section className="adminPanel campPanel"><h2><Target size={18}/>Campaign targets</h2><p className="muted">Actuals count automatically from leads and camps. Leave district empty for the whole campaign.</p>
   <div className="adminTableWrap"><table className="adminTable campTargetTable"><thead><tr><th>Metric</th><th>Label</th><th>District</th><th className="num">Target</th><th>Due date</th><th className="num">Actual</th><th className="num">Progress</th><th></th></tr></thead><tbody>
    {targets.map((t,i)=>{const p=targetProgress(t);const ro=!can('edit');return <tr key={t.id||`new-${i}`}>
     <td><select aria-label="Metric" disabled={ro} value={t.metric_key} onChange={e=>editTarget(i,'metric_key',e.target.value)}>{CAMPAIGN_METRICS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select></td>
     <td><input aria-label="Label" disabled={ro} value={t.label||''} onChange={e=>editTarget(i,'label',e.target.value)}/></td>
     <td><select aria-label="District" disabled={ro} value={t.district||''} onChange={e=>editTarget(i,'district',e.target.value)}><option value="">All</option>{CAMPAIGN_DISTRICTS.map(d=><option key={d}>{d}</option>)}</select></td>
     <td className="num"><input aria-label="Target" disabled={ro} type="number" min={1} value={t.target_value} onChange={e=>editTarget(i,'target_value',e.target.value)}/></td>
     <td><input aria-label="Due date" disabled={ro} type="date" value={dateInput(t.due_date)} onChange={e=>editTarget(i,'due_date',e.target.value)}/></td>
     <td className="num">{p.actual}</td><td className="num">{p.pct}%</td>
     <td className="campRowActions">{!ro&&<button className="iconBtn" onClick={()=>saveTarget(t)} aria-label="Save target"><Save size={16}/></button>}{can('delete')&&<button className="iconBtn" onClick={()=>deleteTarget(t)} aria-label="Delete target"><Trash2 size={16}/></button>}</td>
    </tr>})}
   </tbody></table></div>
   {can('edit')&&<button className="adminBtn ghost campAdd" onClick={()=>setTargets(x=>[...x,{metric_key:'registrations',label:'',target_value:50,due_date:'2026-12-31',district:'',sort_order:100+x.length}])}><Plus size={16}/>Add target</button>}
  </section>}

  {tab==='calculator'&&<section className="adminPanel campPanel"><h2><Calculator size={18}/>Subsidy calculator</h2>
   <div className="campCalc">
    <div className="rfqFormGrid"><label><span>System size (kW DC)</span><input type="number" step="0.01" min="0" value={calcKw} onChange={e=>setCalcKw(e.target.value)}/></label><label><span>Household category</span><select value={calcCat} onChange={e=>setCalcCat(e.target.value as any)}><option value="general">General</option><option value="sc">SC</option><option value="st">ST</option></select></label></div>
    <SubsidyBox s={calc}/>
   </div>
   <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>System</th><th className="num">Benchmark</th><th className="num">Central</th><th className="num">State (General)</th><th className="num">Pays (General)</th><th className="num">State (SC/ST)</th><th className="num">Pays (SC/ST)</th></tr></thead><tbody>{[1,1.09,2,2.18,3].map(kw=>{const g=calcSuryaGharSubsidy(kw,'general'),s=calcSuryaGharSubsidy(kw,'sc');return <tr key={kw}><td><b>{kw} kW</b></td><td className="num">{money(g.benchmark)}</td><td className="num">{money(g.central)}</td><td className="num">{money(g.state)}</td><td className="num"><b>{money(g.householdPays)}</b></td><td className="num">{money(s.state)}</td><td className="num"><b>{money(s.householdPays)}</b></td></tr>})}</tbody></table></div>
   <p className="muted campFoot">Benchmark ₹{SURYA_GHAR_RULES.benchmarkFirst2Kw.toLocaleString('en-IN')}/kW for the first 2 kW and ₹{SURYA_GHAR_RULES.benchmarkAbove2Kw.toLocaleString('en-IN')}/kW above. Gujarat GR {SURYA_GHAR_RULES.grNumber}, 22-10-2026; systems commissioned on or after that date. Final amounts are decided by PGVCL. If the vendor price is above the benchmark, the household also pays the difference.</p>
  </section>}
  </>}

  {lead&&<div className="adminDrawerBackdrop" onClick={()=>setLead(null)}><aside className="rfqDrawer" role="dialog" aria-label="Household lead" onClick={e=>e.stopPropagation()}>
   <div className="rfqDrawerHead"><div><span className="adminEyebrow">HOUSEHOLD LEAD</span><h2>{lead.id?lead.full_name:'New household'}</h2><p>{[lead.village,lead.district].filter(Boolean).join(', ')||'Village not set'}{lead.id?` · ${stageLabel(lead.stage)}`:''}</p></div><button className="iconBtn" onClick={()=>setLead(null)} aria-label="Close"><X size={19}/></button></div>
   <div className="rfqDrawerActions">{(lead.id?can('edit'):can('create'))&&<button className="adminBtn" onClick={saveLead} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save lead'}</button>}{lead.mobile&&normalizeMobile(lead.mobile)&&<button className="adminBtn ghost" onClick={()=>whatsapp(lead)}><MessageCircle size={16}/>WhatsApp</button>}{lead.mobile&&normalizeMobile(lead.mobile)&&<a className="adminBtn ghost" href={`tel:+91${normalizeMobile(lead.mobile)}`}><Phone size={16}/>Call</a>}{lead.id&&can('delete')&&<button className="adminBtn ghost" onClick={deleteLead}><Trash2 size={16}/>Delete</button>}</div>
   <div className="rfqDrawerGrid">
    <section className="rfqDrawerSection"><h3><Users size={16}/>Household</h3><div className="rfqFormGrid">
     <label><span>Name *</span><input value={lead.full_name} onChange={e=>setLead((x:any)=>({...x,full_name:e.target.value}))}/></label>
     <label><span>Mobile</span><input inputMode="numeric" value={lead.mobile||''} onChange={e=>setLead((x:any)=>({...x,mobile:e.target.value}))} placeholder="10 digits"/></label>
     <label><span>Camp</span><select value={lead.camp_id} onChange={e=>{const c=campById[e.target.value];setLead((x:any)=>({...x,camp_id:e.target.value,village:x.village||c?.village||'',taluka:x.taluka||c?.taluka||'',district:c?.district||x.district}))}}><option value="">No camp</option>{camps.map(c=><option key={c.id} value={c.id}>{c.camp_code} · {c.village}</option>)}</select></label>
     <label><span>District</span><select value={lead.district} onChange={e=>setLead((x:any)=>({...x,district:e.target.value}))}>{CAMPAIGN_DISTRICTS.map(d=><option key={d}>{d}</option>)}</select></label>
     <label><span>Village</span><input value={lead.village||''} onChange={e=>setLead((x:any)=>({...x,village:e.target.value}))}/></label>
     <label><span>Taluka</span><input value={lead.taluka||''} onChange={e=>setLead((x:any)=>({...x,taluka:e.target.value}))}/></label>
     <label><span>PGVCL consumer no.</span><input value={lead.consumer_number||''} onChange={e=>setLead((x:any)=>({...x,consumer_number:e.target.value}))}/></label>
     <label><span>Category</span><select value={lead.category} onChange={e=>setLead((x:any)=>({...x,category:e.target.value}))}><option value="general">General</option><option value="sc">SC</option><option value="st">ST</option></select></label>
     <label><span>Avg units / month</span><input type="number" min={0} value={lead.avg_monthly_units} onChange={e=>setLead((x:any)=>({...x,avg_monthly_units:e.target.value}))}/></label>
     <label><span>System size (kW DC)</span><select value={String(lead.system_kw)} onChange={e=>setLead((x:any)=>({...x,system_kw:e.target.value}))}><option value="">Not decided</option>{['1','1.09','2','2.18','3','4','5'].concat(['1','1.09','2','2.18','3','4','5'].includes(String(lead.system_kw))||!lead.system_kw?[]:[String(lead.system_kw)]).map(v=><option key={v} value={v}>{v} kW</option>)}</select></label>
    </div></section>

    <section className="rfqDrawerSection"><h3><Calculator size={16}/>Subsidy for this household</h3>{subsidy&&subsidy.kw>0?<SubsidyBox s={subsidy} quoted={lead.quoted_price}/>:<p className="muted">Pick a system size to see the subsidy.</p>}<div className="rfqFormGrid"><label><span>Vendor quoted price (₹)</span><input type="number" min={0} value={lead.quoted_price} onChange={e=>setLead((x:any)=>({...x,quoted_price:e.target.value}))}/></label><label className="campCheck"><input type="checkbox" checked={Boolean(lead.loan_needed)} onChange={e=>setLead((x:any)=>({...x,loan_needed:e.target.checked}))}/>Bank loan needed</label>{lead.loan_needed&&<label><span>Bank</span><input value={lead.bank_name||''} onChange={e=>setLead((x:any)=>({...x,bank_name:e.target.value}))}/></label>}</div></section>

    <section className="rfqDrawerSection"><h3><ArrowRight size={16}/>Pipeline</h3><div className="rfqFormGrid">
     <label><span>Stage</span><select value={lead.stage} onChange={e=>setLead((x:any)=>({...x,stage:e.target.value}))}>{CAMPAIGN_STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
     <label><span>Owner</span><select value={lead.assigned_to} onChange={e=>setLead((x:any)=>({...x,assigned_to:e.target.value}))}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.full_name||s.company_name||'Staff'}</option>)}</select></label>
     <label className="campCheck"><input type="checkbox" checked={Boolean(lead.portal_registered)||reachedStage(lead.stage,'registered')} onChange={e=>setLead((x:any)=>({...x,portal_registered:e.target.checked}))}/>Registered on portal</label>
     <label><span>Portal application no.</span><input value={lead.portal_application_no||''} onChange={e=>setLead((x:any)=>({...x,portal_application_no:e.target.value}))}/></label>
     <label><span>Next follow-up</span><input type="date" value={lead.next_follow_up_at} onChange={e=>setLead((x:any)=>({...x,next_follow_up_at:e.target.value}))}/></label>
     <label><span>Survey date</span><input type="date" value={dateInput(lead.survey_date)} onChange={e=>setLead((x:any)=>({...x,survey_date:e.target.value}))}/></label>
     <label><span>Install date</span><input type="date" value={dateInput(lead.install_date)} onChange={e=>setLead((x:any)=>({...x,install_date:e.target.value}))}/></label>
     <label><span>Commission date</span><input type="date" value={dateInput(lead.commission_date)} onChange={e=>setLead((x:any)=>({...x,commission_date:e.target.value}))}/></label>
     <label className="campCheck"><input type="checkbox" checked={Boolean(lead.central_subsidy_received)} onChange={e=>setLead((x:any)=>({...x,central_subsidy_received:e.target.checked}))}/>Central subsidy received</label>
     <label className="campCheck"><input type="checkbox" checked={Boolean(lead.state_subsidy_received)} onChange={e=>setLead((x:any)=>({...x,state_subsidy_received:e.target.checked}))}/>State subsidy received</label>
    </div>{lead.stage==='lost'&&<label className="rfqWideLabel"><span>Why lost</span><input value={lead.lost_reason||''} onChange={e=>setLead((x:any)=>({...x,lost_reason:e.target.value}))}/></label>}{lead.commission_date&&lead.commission_date<SURYA_GHAR_RULES.grDate&&<p className="campWarn">Commissioned before 22-10-2026: no Gujarat state top-up for this system.</p>}</section>

    <section className="rfqDrawerSection"><h3><MessageCircle size={16}/>Notes & activity</h3><label className="rfqWideLabel"><span>Notes</span><textarea rows={3} value={lead.notes||''} onChange={e=>setLead((x:any)=>({...x,notes:e.target.value}))}/></label>{lead.id?<><div className="rfqAddNote"><input aria-label="Add a note" placeholder="Call note, visit update, next action…" value={note} onChange={e=>setNote(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addNote()}}}/><button onClick={addNote}>Add</button></div><div className="rfqTimeline">{activities.length?activities.map(a=><div key={a.id}><span></span><section><b>{String(a.activity_type).replaceAll('_',' ')}</b><p>{a.message}</p><small>{new Date(a.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}{a.created_by&&staffName(a.created_by)?` · ${staffName(a.created_by)}`:''}</small></section></div>):<p className="muted">No activity yet.</p>}</div></>:<p className="muted">Save the lead to start its activity log.</p>}</section>
   </div>
  </aside></div>}

  {camp&&<div className="adminDrawerBackdrop" onClick={()=>setCamp(null)}><aside className="rfqDrawer" role="dialog" aria-label="Village camp" onClick={e=>e.stopPropagation()}>
   <div className="rfqDrawerHead"><div><span className="adminEyebrow">VILLAGE CAMP</span><h2>{camp.id?`${camp.camp_code} · ${camp.village}`:'New camp'}</h2><p>{camp.camp_date?day(camp.camp_date):'Date not set'} · {campStatus[camp.status]}</p></div><button className="iconBtn" onClick={()=>setCamp(null)} aria-label="Close"><X size={19}/></button></div>
   <div className="rfqDrawerActions">{(camp.id?can('edit'):can('create'))&&<button className="adminBtn" onClick={saveCamp} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save camp'}</button>}{camp.id&&can('create')&&<button className="adminBtn ghost" onClick={()=>{setCamp(null);openLead(blankLead(camp))}}><Plus size={16}/>Add lead to this camp</button>}{camp.id&&can('delete')&&<button className="adminBtn ghost" onClick={deleteCamp}><Trash2 size={16}/>Delete</button>}</div>
   <div className="rfqDrawerGrid">
    <section className="rfqDrawerSection"><h3><Tent size={16}/>Camp details</h3><div className="rfqFormGrid">
     <label><span>Camp ID *</span><input value={camp.camp_code} onChange={e=>setCamp((x:any)=>({...x,camp_code:e.target.value}))}/></label>
     <label><span>Date</span><input type="date" value={dateInput(camp.camp_date)} onChange={e=>setCamp((x:any)=>({...x,camp_date:e.target.value}))}/></label>
     <label><span>Village *</span><input value={camp.village} onChange={e=>setCamp((x:any)=>({...x,village:e.target.value}))}/></label>
     <label><span>Taluka</span><input value={camp.taluka||''} onChange={e=>setCamp((x:any)=>({...x,taluka:e.target.value}))}/></label>
     <label><span>District</span><select value={camp.district} onChange={e=>setCamp((x:any)=>({...x,district:e.target.value}))}>{CAMPAIGN_DISTRICTS.map(d=><option key={d}>{d}</option>)}</select></label>
     <label><span>Status</span><select value={camp.status} onChange={e=>setCamp((x:any)=>({...x,status:e.target.value}))}>{Object.entries(campStatus).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label><span>Venue</span><input value={camp.venue||''} onChange={e=>setCamp((x:any)=>({...x,venue:e.target.value}))} placeholder="Panchayat office, temple ground…"/></label>
     <label><span>Attendance</span><input type="number" min={0} value={camp.attendance} onChange={e=>setCamp((x:any)=>({...x,attendance:e.target.value}))}/></label>
     <label><span>Sarpanch name</span><input value={camp.sarpanch_name||''} onChange={e=>setCamp((x:any)=>({...x,sarpanch_name:e.target.value}))}/></label>
     <label><span>Sarpanch phone</span><input value={camp.sarpanch_phone||''} onChange={e=>setCamp((x:any)=>({...x,sarpanch_phone:e.target.value}))}/></label>
     <label><span>Partner vendor (PGVCL-registered)</span><input value={camp.partner_vendor||''} onChange={e=>setCamp((x:any)=>({...x,partner_vendor:e.target.value}))}/></label>
     <label><span>Bank partner</span><input value={camp.bank_partner||''} onChange={e=>setCamp((x:any)=>({...x,bank_partner:e.target.value}))}/></label>
    </div><label className="rfqWideLabel"><span>Notes</span><textarea rows={3} value={camp.notes||''} onChange={e=>setCamp((x:any)=>({...x,notes:e.target.value}))}/></label></section>
    {[['Before the camp',PRE_EVENT],['Kit checklist',KIT]].map(([title,items]:any)=><section className="rfqDrawerSection" key={title}><h3><Check size={16}/>{title}</h3><div className="campChecklist">{items.map(([k,label]:string[])=><label key={k} className="campCheck"><input type="checkbox" checked={Boolean(camp.checklist?.[k])} onChange={e=>setCamp((x:any)=>({...x,checklist:{...(x.checklist||{}),[k]:e.target.checked}}))}/>{label}</label>)}</div></section>)}
    {camp.id&&<section className="rfqDrawerSection"><h3><Users size={16}/>Results</h3>{(()=>{const s=campStats(camp.id);return <div className="campMini"><div><span>Leads</span><b>{s.leads}</b></div><div><span>Registered</span><b>{s.registered}</b></div><div><span>Commissioned</span><b>{s.commissioned}</b></div></div>})()}</section>}
   </div>
  </aside></div>}
 </div>
}

function SubsidyBox({s,quoted}:{s:ReturnType<typeof calcSuryaGharSubsidy>,quoted?:any}){
 const extra=quoted&&Number(quoted)>s.benchmark?Number(quoted)-s.benchmark:0
 return <div className="campSubsidy">
  <div><span>Benchmark cost</span><b>{money(s.benchmark)}</b></div>
  <div><span>Central subsidy</span><b>{money(s.central)}</b></div>
  <div><span>Gujarat state subsidy</span><b>{s.stateEligible?money(s.state):'Not eligible'}</b></div>
  <div className="pay"><span>Household pays</span><b>{money(s.householdPays+extra)}</b>{extra>0&&<small>includes {money(extra)} above benchmark</small>}</div>
  {!s.stateEligible&&s.kw>0&&<p className="campWarn">Above {SURYA_GHAR_RULES.stateLimitKw} kW DC there is no state top-up, only the central subsidy.</p>}
 </div>
}

'use client'

import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {AlertTriangle,Box,CalendarDays,Check,CheckCircle2,ClipboardCheck,Factory,ImagePlus,ListChecks,PackageCheck,Printer,RefreshCw,Search,ShieldCheck,UserRound,Warehouse,X} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

const stages=[
  {key:'new',label:'New'},
  {key:'bom_ready',label:'BOM Ready'},
  {key:'materials_reserved',label:'Materials Reserved'},
  {key:'assembly',label:'Assembly'},
  {key:'testing',label:'Testing'},
  {key:'qc_passed',label:'QC Passed'},
  {key:'packing',label:'Packing'},
  {key:'ready_to_dispatch',label:'Ready to Dispatch'},
  {key:'completed',label:'Completed'}
]
const qcItems=[
  ['components_verified','Components verified against BOM'],
  ['wiring_checked','Wiring and ferrules checked'],
  ['torque_checked','MCB/MCCB/SPD terminal torque checked'],
  ['continuity_tested','Continuity / electrical test completed'],
  ['spd_mcb_verified','Protection devices and ratings verified'],
  ['labels_applied','Labels, warning marks and branding applied'],
  ['enclosure_cleaned','Enclosure cleaned and glands checked'],
  ['final_visual_check','Final visual inspection passed']
]
const money=(n:any)=>`₹${Number(n||0).toLocaleString('en-IN')}`
const safeName=(s:string)=>s.toLowerCase().replace(/[^a-z0-9.]+/g,'-').replace(/-+/g,'-')
const measuredUnit=(unit:any)=>!['pcs','set','roll'].includes(String(unit||'pcs').toLowerCase())
const changeQuantity=(value:number,delta:number)=>Number((value+delta).toFixed(3))

export default function Production(){
 const [jobs,setJobs]=useState<any[]>([]),[profiles,setProfiles]=useState<any[]>([]),[selected,setSelected]=useState<any>(null)
 const [bom,setBom]=useState<any[]>([]),[reservations,setReservations]=useState<any[]>([]),[history,setHistory]=useState<any[]>([]),[materialStock,setMaterialStock]=useState<Record<string,any>>({})
 const [q,setQ]=useState(''),[priority,setPriority]=useState('all'),[onlyOverdue,setOnlyOverdue]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false),[msg,setMsg]=useState('')

 useEffect(()=>{load()},[])
 async function load(){
  setLoading(true)
  const [j,p]=await Promise.all([
   supabase.from('production_jobs').select('*,orders(order_number,status,payment_status,company_name,customer_snapshot)').order('created_at',{ascending:false}).limit(300),
   supabase.from('profiles').select('id,full_name,role').in('role',['admin','staff']).order('full_name')
  ])
  setJobs(j.data||[]);setProfiles(p.data||[]);setLoading(false)
  const requested=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('job'):null
  const requestedJob=(j.data||[]).find((x:any)=>x.id===requested);if(requestedJob&&!selected)await openJob(requestedJob)
 }
 async function openJob(j:any){
  setSelected(j);setMsg('')
  const [b,r,h]=await Promise.all([
   supabase.from('production_bom_items').select('*').eq('production_job_id',j.id).order('created_at'),
   supabase.from('inventory_reservations').select('*').eq('production_job_id',j.id).order('created_at'),
   supabase.from('production_job_history').select('*').eq('production_job_id',j.id).order('created_at',{ascending:false})
  ])
  const br=b.data||[];setBom(br);setReservations(r.data||[]);setHistory(h.data||[])
  const componentIds=br.map((x:any)=>x.component_id).filter(Boolean),enclosureIds=br.map((x:any)=>x.enclosure_id).filter(Boolean),variantIds=br.map((x:any)=>x.variant_id).filter(Boolean)
  const [components,enclosures,variants]=await Promise.all([
   componentIds.length?supabase.from('components').select('id,name,sku,stock_qty,unit').in('id',componentIds):Promise.resolve({data:[]}),
   enclosureIds.length?supabase.from('enclosures').select('id,name,sku,stock_qty').in('id',enclosureIds):Promise.resolve({data:[]}),
   variantIds.length?supabase.from('product_variants').select('id,sku,title,stock_qty,unit').in('id',variantIds):Promise.resolve({data:[]}),
  ])
  const all=[...(components.data||[]),...(enclosures.data||[]),...(variants.data||[])];setMaterialStock(Object.fromEntries(all.map((x:any)=>[x.id,x])))
 }
 async function refreshSelected(){if(!selected)return;const {data}=await supabase.from('production_jobs').select('*,orders(order_number,status,payment_status,company_name,customer_snapshot)').eq('id',selected.id).single();if(data)await openJob(data);await load()}

 const overdue=(j:any)=>j.due_date&&new Date(`${j.due_date}T23:59:59`).getTime()<Date.now()&&!['completed','cancelled'].includes(j.status)
 const filtered=useMemo(()=>jobs.filter(j=>{
  const hay=`${j.job_number||''} ${j.product_name||''} ${j.orders?.order_number||''} ${j.orders?.company_name||''} ${j.orders?.customer_snapshot?.name||''}`.toLowerCase()
  return (!q||hay.includes(q.toLowerCase()))&&(priority==='all'||j.priority===priority)&&(!onlyOverdue||overdue(j))
 }),[jobs,q,priority,onlyOverdue])
 const active=jobs.filter(j=>!['completed','cancelled'].includes(j.status))
 const stats={active:active.length,assembly:jobs.filter(j=>['assembly','testing'].includes(j.status)).length,qc:jobs.filter(j=>j.status==='qc_passed').length,dispatch:jobs.filter(j=>j.status==='ready_to_dispatch').length,overdue:jobs.filter(overdue).length}
 const assignee=(id:string)=>profiles.find(p=>p.id===id)?.full_name||'Unassigned'
 const qcComplete=(j:any)=>qcItems.every(([k])=>j?.qc_checklist?.[k]===true)
 const allPicked=()=>bom.length>0&&bom.every(x=>Number(x.picked_qty||0)>=Number(x.required_qty||x.quantity||0))
 const reservedQty=(row:any)=>reservations.filter(r=>r.status==='reserved'&&r.component_id===row.component_id&&r.enclosure_id===row.enclosure_id&&r.variant_id===row.variant_id).reduce((n,r)=>n+Number(r.quantity||0),0)
 const allReserved=()=>bom.length>0&&bom.every(x=>reservedQty(x)>=Number(x.required_qty||x.quantity||0))

 async function reserveMaterials(){
  if(!selected)return;setSaving(true);setMsg('')
  const {error}=await supabase.rpc('reserve_production_job_materials',{p_job_id:selected.id})
  setSaving(false);if(error){setMsg(error.message);return}setMsg('All BOM materials reserved.');await refreshSelected()
 }

 async function move(status:string){
  if(!selected)return
  if(status==='materials_reserved'&&!allReserved()){setMsg('Reserve every BOM material before moving to Materials Reserved.');return}
  if(status==='assembly'&&!allReserved()){setMsg('Reserve every BOM material before starting assembly.');return}
  if(status==='assembly'&&!allPicked()){setMsg('Pick all required BOM material before starting assembly.');return}
  if(status==='qc_passed'&&!qcComplete(selected)){setMsg('Complete every QC checkpoint before marking QC Passed.');return}
  if(['ready_to_dispatch','completed'].includes(status)&&(!qcComplete(selected)||!selected.final_photo_url)){setMsg('QC must be complete and a final product photo must be uploaded first.');return}
  setSaving(true);const {error}=await supabase.from('production_jobs').update({status}).eq('id',selected.id);setSaving(false)
  if(error){setMsg(error.message);return}setMsg(`Stage changed to ${stages.find(s=>s.key===status)?.label||status}.`);await refreshSelected()
 }
 async function saveJob(){
  if(!selected)return;setSaving(true)
  const payload={priority:selected.priority,assigned_to:selected.assigned_to||null,due_date:selected.due_date||null,internal_notes:selected.internal_notes||null,qc_notes:selected.qc_notes||null}
  const {error}=await supabase.from('production_jobs').update(payload).eq('id',selected.id);setSaving(false);setMsg(error?error.message:'Production job updated.');if(!error)await refreshSelected()
 }
 async function setBomQty(row:any,field:'picked_qty'|'issued_qty',value:number){
  const max=Number(row.required_qty||row.quantity||0);const next=Math.max(0,Math.min(max,Number(value||0)))
  const {error}=await supabase.from('production_bom_items').update({[field]:next}).eq('id',row.id)
  if(error){setMsg(error.message);return}setBom(b=>b.map(x=>x.id===row.id?{...x,[field]:next}:x))
 }
 async function markAll(field:'picked_qty'|'issued_qty'){
  setSaving(true);const results=await Promise.all(bom.map(x=>supabase.from('production_bom_items').update({[field]:Number(x.required_qty||x.quantity||0)}).eq('id',x.id)));setSaving(false)
  const err=results.find(x=>x.error)?.error;if(err){setMsg(err.message);return}setBom(b=>b.map(x=>({...x,[field]:Number(x.required_qty||x.quantity||0)})));setMsg(field==='picked_qty'?'All BOM material marked picked.':'All BOM material marked issued.')
 }
 async function toggleQc(key:string,value:boolean){
  if(!selected)return;const next={...(selected.qc_checklist||{}),[key]:value};setSelected((s:any)=>({...s,qc_checklist:next}))
  const {error}=await supabase.from('production_jobs').update({qc_checklist:next}).eq('id',selected.id);if(error)setMsg(error.message)
 }
 async function uploadPhoto(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file||!selected)return
  if(!file.type.startsWith('image/')){setMsg('Upload JPG, PNG or WebP image only.');return}
  setUploading(true);const path=`jobs/${selected.job_number}/${Date.now()}-${safeName(file.name)}`
  const up=await supabase.storage.from('production-assets').upload(path,file,{upsert:false,cacheControl:'3600'});if(up.error){setUploading(false);setMsg(up.error.message);return}
  const {data}=supabase.storage.from('production-assets').getPublicUrl(path)
  const {error}=await supabase.from('production_jobs').update({final_photo_url:data.publicUrl}).eq('id',selected.id);setUploading(false)
  if(error){setMsg(error.message);return}setMsg('Final production photo uploaded.');await refreshSelected()
 }
 function printSheet(){window.print()}

 return <div className="productionV2">
  <div className="productionHero"><div><span className="adminEyebrow">FACTORY OPERATIONS</span><h1>Production Control</h1><p>Material reservation, picking, assembly, testing, QC, packing and dispatch for every ACDB/DCDB job.</p></div><button className="adminBtn ghost" onClick={load}><RefreshCw size={16}/>Refresh</button></div>
  {msg&&!selected&&<div className="themeMessage"><Check size={16}/>{msg}</div>}
  <div className="productionStats">
   <div><Factory/><b>{stats.active}</b><span>Active jobs</span></div><div><ListChecks/><b>{stats.assembly}</b><span>Assembly / Test</span></div><div><ShieldCheck/><b>{stats.qc}</b><span>QC passed</span></div><div><PackageCheck/><b>{stats.dispatch}</b><span>Ready dispatch</span></div><div className={stats.overdue?'danger':''}><AlertTriangle/><b>{stats.overdue}</b><span>Overdue</span></div>
  </div>
  <div className="productionToolbar"><div className="adminSearch"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search job, order, product or customer"/></div><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><label className="productionCheck"><input type="checkbox" checked={onlyOverdue} onChange={e=>setOnlyOverdue(e.target.checked)}/>Overdue only</label></div>
  {loading?<div className="adminLoading">Loading production queue…</div>:<div className="productionBoardV2">{stages.map(stage=><section className="productionLane" key={stage.key}><header><b>{stage.label}</b><span>{filtered.filter(j=>j.status===stage.key).length}</span></header><div className="productionLaneBody">{filtered.filter(j=>j.status===stage.key).map(j=><button className={`productionCard ${overdue(j)?'overdue':''}`} onClick={()=>openJob(j)} key={j.id}><div className="productionCardTop"><small>{j.job_number}</small><span className={`priorityTag p-${j.priority||'normal'}`}>{j.priority||'normal'}</span></div><b>{j.product_name||'Custom Build'}</b><p>{j.orders?.order_number||'No order'} · Qty {j.quantity}</p><div className="productionCardMeta"><span><UserRound size={13}/>{assignee(j.assigned_to)}</span><span className={overdue(j)?'late':''}><CalendarDays size={13}/>{j.due_date?new Date(`${j.due_date}T00:00:00`).toLocaleDateString('en-IN'):'No due date'}</span></div></button>)}{!filtered.some(j=>j.status===stage.key)&&<div className="laneEmpty">No jobs</div>}</div></section>)}</div>}

  {selected&&<div className="productionDrawerBackdrop" onClick={()=>setSelected(null)}><aside className="productionDrawerV2" onClick={e=>e.stopPropagation()}>
   <div className="productionDrawerHead"><div><small>{selected.job_number}</small><h2>{selected.product_name||'Custom ACDB/DCDB Build'}</h2><p>{selected.orders?.order_number} · Qty {selected.quantity}</p></div><div className="drawerHeadActions"><button onClick={printSheet} title="Print production sheet"><Printer size={17}/></button><button onClick={()=>setSelected(null)}><X size={18}/></button></div></div>
   {msg&&<div className="productionMessage">{msg}</div>}
   <div className="productionProgress">{stages.map((s,i)=>{const current=stages.findIndex(x=>x.key===selected.status);return <button key={s.key} className={`${i<current?'done':''} ${i===current?'current':''}`} onClick={()=>move(s.key)} disabled={saving}><span>{i<current?<Check size={13}/>:i+1}</span><small>{s.label}</small></button>})}</div>
   <div className="productionDrawerGrid">
    <main>
     <section className="productionPanel"><div className="productionPanelHead"><div><h3><Warehouse size={18}/>Material & BOM</h3><p>Required, reserved, picked and issued quantities.</p></div><div><button onClick={reserveMaterials} disabled={!bom.length||allReserved()||saving}>{allReserved()?'Materials reserved':'Reserve materials'}</button><button onClick={()=>markAll('picked_qty')} disabled={!bom.length||!allReserved()||saving}>Pick all</button><button onClick={()=>markAll('issued_qty')} disabled={!bom.length||!allReserved()||saving}>Issue all</button></div></div>
      <div className="productionTableWrap"><table><thead><tr><th>Component</th><th>Required</th><th>On hand</th><th>Picked</th><th>Issued</th><th>Status</th></tr></thead><tbody>{bom.map(row=>{const stock=materialStock[row.component_id||row.enclosure_id||row.variant_id];const req=Number(row.required_qty||row.quantity||0);const picked=Number(row.picked_qty||0);const issued=Number(row.issued_qty||0);const step=measuredUnit(row.unit)?0.1:1;return <tr key={row.id}><td><b>{row.component_name}</b><small>{row.sku_snapshot||row.component_category||'Component'}</small></td><td>{req} {row.unit||'pcs'}</td><td>{stock?`${stock.stock_qty} ${stock.unit||'pcs'}`:'—'}</td><td><div className="qtyStepper"><button onClick={()=>setBomQty(row,'picked_qty',changeQuantity(picked,-step))}>−</button><input type="number" min="0" step={measuredUnit(row.unit)?'0.01':'1'} value={picked} onChange={e=>setBomQty(row,'picked_qty',Number(e.target.value))}/><button onClick={()=>setBomQty(row,'picked_qty',changeQuantity(picked,step))}>+</button></div><small>{row.unit||'pcs'}</small></td><td><div className="qtyStepper"><button onClick={()=>setBomQty(row,'issued_qty',changeQuantity(issued,-step))}>−</button><input type="number" min="0" step={measuredUnit(row.unit)?'0.01':'1'} value={issued} onChange={e=>setBomQty(row,'issued_qty',Number(e.target.value))}/><button onClick={()=>setBomQty(row,'issued_qty',changeQuantity(issued,step))}>+</button></div><small>{row.unit||'pcs'}</small></td><td><span className={`materialState ${picked>=req?'ok':'wait'}`}>{picked>=req?'Ready':'Pick pending'}</span></td></tr>})}{!bom.length&&<tr><td colSpan={6} className="emptyCell">No BOM items generated for this job.</td></tr>}</tbody></table></div>
      <div className="reservationSummary"><Box size={16}/><b>{reservations.filter(r=>r.status==='reserved').length}</b> active material reservations <span>·</span> {allReserved()?'BOM fully reserved':'Reservation pending / stock shortage'} <span>·</span> {reservations.filter(r=>r.status==='consumed').length} consumed</div>
     </section>

     <section className="productionPanel"><div className="productionPanelHead"><div><h3><ClipboardCheck size={18}/>Quality Control</h3><p>Complete all checks before QC Passed.</p></div><span className={`qcScore ${qcComplete(selected)?'complete':''}`}>{qcItems.filter(([k])=>selected.qc_checklist?.[k]).length}/{qcItems.length}</span></div>
      <div className="qcGrid">{qcItems.map(([key,label])=><label key={key} className={selected.qc_checklist?.[key]?'checked':''}><input type="checkbox" checked={!!selected.qc_checklist?.[key]} onChange={e=>toggleQc(key,e.target.checked)}/><span><CheckCircle2 size={18}/>{label}</span></label>)}</div>
      <label className="productionField full"><span>QC notes</span><textarea rows={3} value={selected.qc_notes||''} onChange={e=>setSelected((s:any)=>({...s,qc_notes:e.target.value}))} placeholder="Test results, observations or corrections…"/></label>
     </section>

     <section className="productionPanel"><div className="productionPanelHead"><div><h3><ImagePlus size={18}/>Final Product Photo</h3><p>Required before Ready to Dispatch.</p></div></div><div className="finalPhotoBox">{selected.final_photo_url?<img src={selected.final_photo_url} alt="Completed production"/>:<div><ImagePlus size={30}/><p>No final production photo uploaded.</p></div>}<label className="adminBtn"><ImagePlus size={15}/>{uploading?'Uploading…':selected.final_photo_url?'Replace Photo':'Upload Final Photo'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto}/></label></div></section>
    </main>
    <aside className="productionSide">
     <section className="productionPanel compact"><h3>Job control</h3><label className="productionField"><span>Stage</span><select value={selected.status} onChange={e=>move(e.target.value)} disabled={saving}>{stages.map(s=><option value={s.key} key={s.key}>{s.label}</option>)}<option value="cancelled">Cancelled</option></select></label><label className="productionField"><span>Priority</span><select value={selected.priority||'normal'} onChange={e=>setSelected((s:any)=>({...s,priority:e.target.value}))}><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label><label className="productionField"><span>Assigned to</span><select value={selected.assigned_to||''} onChange={e=>setSelected((s:any)=>({...s,assigned_to:e.target.value||null}))}><option value="">Unassigned</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name||p.role}</option>)}</select></label><label className="productionField"><span>Due date</span><input type="date" value={selected.due_date||''} onChange={e=>setSelected((s:any)=>({...s,due_date:e.target.value}))}/></label><label className="productionField"><span>Internal notes</span><textarea rows={4} value={selected.internal_notes||''} onChange={e=>setSelected((s:any)=>({...s,internal_notes:e.target.value}))}/></label><button className="adminBtn fullBtn" onClick={saveJob} disabled={saving}>{saving?'Saving…':'Save Job'}</button></section>
     <section className="productionPanel compact"><h3>{selected.build_mode==='make_to_stock'?'Finished inventory':'Customer order'}</h3>{selected.build_mode==='make_to_stock'?<><p><b>Make to stock batch</b></p><p>Estimated unit cost {money(selected.estimated_unit_cost)}</p>{selected.actual_unit_cost&&<p>Actual FIFO unit cost {money(selected.actual_unit_cost)}</p>}<div className="miniStatus"><span>{selected.output_recorded_at?'Stock received':'Output pending'}</span><span>Qty {selected.quantity}</span></div></>:<><p><b>{selected.orders?.company_name||selected.orders?.customer_snapshot?.name||'Customer'}</b></p><p>{selected.orders?.order_number||'—'}</p><div className="miniStatus"><span>{selected.orders?.status||'—'}</span><span>{selected.orders?.payment_status||'—'}</span></div>{selected.order_id&&<Link href={`/admin/orders/${selected.order_id}`}>Open order →</Link>}</>}</section>
     <section className="productionPanel compact"><h3>Timeline</h3><div className="productionTimeline">{history.map(h=><div key={h.id}><span></span><p><b>{(h.from_status||'Created').replaceAll('_',' ')} → {h.to_status.replaceAll('_',' ')}</b><small>{new Date(h.created_at).toLocaleString('en-IN')}</small></p></div>)}{!history.length&&<p className="muted">No stage changes recorded yet.</p>}</div></section>
    </aside>
   </div>
  </aside></div>}
 </div>
}

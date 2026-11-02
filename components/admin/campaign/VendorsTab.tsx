'use client'

import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import * as XLSX from 'xlsx'
import {Building2,ExternalLink,Mail,MessageCircle,Phone,Plus,Save,Search,Star,Trash2,Upload,UserCheck,X} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import {CAMPAIGN_GEO,talukasFor} from '../../../lib/gujarat-places'
import {VENDOR_STATUSES,installsIn,portalPatch,vendorKey,vendorLinks,vendorStatusLabel,vendorsFromPortalExport,vendorsFromSheetRows,type PortalVendor} from '../../../lib/campaign-vendors'

type Can=(a:'create'|'edit'|'delete'|'export')=>boolean
const DISTRICTS=Object.keys(CAMPAIGN_GEO).filter(d=>d!=='Other')
const IN=(n:any,d=0)=>n==null||n===''?'—':Number(n).toLocaleString('en-IN',{maximumFractionDigits:d})
const blank=()=>({name:'',contact_name:'',phone:'',email:'',address:'',website:'',brands:'',status:'prospect',our_rating:'',established_year:'',gst_number:'',pgvcl_registered:false,rate_per_kw:'',service_talukas:[] as string[],notes:'',district_installs:{},registered_districts:[] as string[]})
const thisYear=new Date().getFullYear()

function Stars({value}:{value:number|null}){
 if(value==null)return <span className="muted">No rating</span>
 return <span className="vendStars" aria-label={`${value} out of 5`}><Star size={13} fill="currentColor"/>{Number(value).toFixed(1)}</span>
}

export default function VendorsTab({vendors,leads,can,reload,setErr,flash,openLead,ready}:{vendors:any[];leads:any[];can:Can;reload:()=>Promise<void>;setErr:(m:string)=>void;flash:(m:string)=>void;openLead:(l:any)=>void;ready:boolean}){
 const [district,setDistrict]=useState('Amreli'),[q,setQ]=useState(''),[status,setStatus]=useState('all'),[activeOnly,setActiveOnly]=useState(true),[sort,setSort]=useState<'installs'|'rating'|'reviews'|'name'>('installs')
 const [limit,setLimit]=useState(100),[busy,setBusy]=useState(false),[vendor,setVendor]=useState<any>(null),[pick,setPick]=useState<Record<string,boolean>>({})
 useEffect(()=>{setLimit(100)},[district,q,status,activeOnly,sort])

 const assigned=useMemo(()=>{const m=new Map<string,any[]>();for(const l of leads)if(l.vendor_id){const a=m.get(l.vendor_id)||[];a.push(l);m.set(l.vendor_id,a)}return m},[leads])
 const shown=useMemo(()=>{
  const s=q.trim().toLowerCase(),sk=vendorKey(q)
  return vendors.filter(v=>(status==='all'||v.status===status)
   &&(district==='all'||(v.registered_districts||[]).includes(district)||installsIn(v,district)>0||(v.service_talukas||[]).some((t:string)=>talukasFor(district).some(([en])=>en===t)))
   &&(!activeOnly||installsIn(v,district)>0||['shortlisted','approved','active'].includes(v.status))
   &&(!s||vendorKey(v.name).includes(sk)||`${v.contact_name||''} ${v.phone||''} ${v.email||''} ${v.address||''} ${v.brands||''}`.toLowerCase().includes(s)))
   .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='rating'?(Number(b.portal_rating)||0)-(Number(a.portal_rating)||0)||(b.portal_reviews||0)-(a.portal_reviews||0):sort==='reviews'?(b.portal_reviews||0)-(a.portal_reviews||0):installsIn(b,district)-installsIn(a,district)||(b.portal_reviews||0)-(a.portal_reviews||0))
 },[vendors,district,q,status,activeOnly,sort])
 const working=vendors.filter(v=>['shortlisted','approved','active'].includes(v.status)).length
 const unassigned=leads.filter(l=>!l.vendor_id&&l.stage!=='lost')

 async function importFile(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file)return
  try{
   let list:PortalVendor[]=[]
   if(/\.json$/i.test(file.name))list=vendorsFromPortalExport(JSON.parse(await file.text()))
   else{const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const rows:any[]=[];for(const n of wb.SheetNames)rows.push(...XLSX.utils.sheet_to_json<any>(wb.Sheets[n],{defval:''}));list=vendorsFromSheetRows(rows)}
   if(!list.length){setErr('No vendors found in that file. Use the portal vendor export (.json) or a sheet with a Vendor/Name column.');return}
   const byKey=new Map(vendors.map(v=>[vendorKey(v.name),v]))
   const fresh=list.filter(v=>!byKey.has(vendorKey(v.name))),update=list.filter(v=>byKey.has(vendorKey(v.name)))
   if(!confirm(`${file.name}: ${fresh.length} new vendors and ${update.length} already in the list (their portal figures will be refreshed; your status, ratings and notes stay). Import?`))return
   setBusy(true);let failed=0
   const now=new Date().toISOString()
   for(let i=0;i<fresh.length;i+=300){const rows=fresh.slice(i,i+300).map(v=>({...v,portal_synced_at:now}));const {error}=await supabase.from('campaign_vendors').insert(rows);if(error){for(const r of rows){const x=await supabase.from('campaign_vendors').insert(r);if(x.error)failed++}}}
   for(const v of update){const ex=byKey.get(vendorKey(v.name));const {error}=await supabase.from('campaign_vendors').update(portalPatch(ex,v)).eq('id',ex.id);if(error)failed++}
   setBusy(false);await reload();flash(`Vendors updated: ${fresh.length} added, ${update.length} refreshed${failed?`, ${failed} could not be saved`:''}.`)
  }catch(x:any){setBusy(false);setErr(`Could not read the file: ${x?.message||x}`)}
 }

 function open(v:any){setPick({});setVendor({...blank(),...v,our_rating:v.our_rating??'',established_year:v.established_year??'',rate_per_kw:v.rate_per_kw??'',service_talukas:v.service_talukas||[],contact_name:v.contact_name||'',phone:v.phone||'',email:v.email||'',address:v.address||'',website:v.website||'',brands:v.brands||'',gst_number:v.gst_number||'',notes:v.notes||''})}
 async function save(){
  if(!vendor.name.trim()){setErr('Vendor name is required.');return}
  const n=(x:any)=>x===''||x==null?null:Number(x),t=(x:any)=>String(x||'').trim()||null
  const payload={name:vendor.name.trim(),contact_name:t(vendor.contact_name),phone:t(vendor.phone),email:t(vendor.email),address:t(vendor.address),website:t(vendor.website),brands:t(vendor.brands),status:vendor.status,our_rating:n(vendor.our_rating),established_year:n(vendor.established_year),gst_number:t(vendor.gst_number),pgvcl_registered:vendor.pgvcl_registered===null?null:Boolean(vendor.pgvcl_registered),rate_per_kw:n(vendor.rate_per_kw),service_talukas:vendor.service_talukas||[],notes:t(vendor.notes),...(vendor.id?{}:{source:'manual',registered_districts:district==='all'?[]:[district]})}
  setBusy(true)
  const res=vendor.id?await supabase.from('campaign_vendors').update(payload).eq('id',vendor.id).select().single():await supabase.from('campaign_vendors').insert(payload).select().single()
  setBusy(false)
  if(res.error){setErr(/unique|duplicate/i.test(res.error.message)?'A vendor with this name is already in the list.':res.error.message);return}
  flash('Vendor saved.');await reload();open(res.data)
 }
 async function remove(){if(!vendor?.id||!confirm(`Delete ${vendor.name}? Households assigned to it keep their data but lose the vendor.`))return;const {error}=await supabase.from('campaign_vendors').delete().eq('id',vendor.id);if(error){setErr(error.message);return}setVendor(null);flash('Vendor deleted.');reload()}
 async function assign(ids:string[],vendorId:string|null){
  if(!ids.length)return
  setBusy(true)
  const {error}=await supabase.from('campaign_leads').update({vendor_id:vendorId}).in('id',ids)
  if(!error){const {data:{user}}=await supabase.auth.getUser();await supabase.from('campaign_lead_activities').insert(ids.map(id=>({lead_id:id,activity_type:'system',message:vendorId?`Installation vendor: ${vendor?.name}`:'Installation vendor removed',created_by:user?.id||null})))}
  setBusy(false)
  if(error){setErr(error.message);return}
  setPick({});flash(vendorId?`${ids.length} household${ids.length===1?'':'s'} assigned to ${vendor?.name}.`:'Household unassigned.');reload()
 }

 if(!ready)return <section className="adminPanel campPanel"><p className="muted">Vendors need the campaign_vendors database update. Run it in Supabase, then refresh.</p></section>

 const links=vendor?vendorLinks(vendor):null
 const mine=vendor?.id?assigned.get(vendor.id)||[]:[]
 const candidates=vendor?unassigned.filter(l=>!vendor.registered_districts?.length||vendor.registered_districts.includes(l.district)||installsIn(vendor,l.district)>0):[]
 const wa=(p:string)=>{const d=String(p||'').replace(/\D/g,'').slice(-10);return d.length===10?`https://wa.me/91${d}`:null}

 return <>
  <section className="campToolbar">
   <select aria-label="District" value={district} onChange={e=>setDistrict(e.target.value)}>{DISTRICTS.map(d=><option key={d} value={d}>{d}</option>)}<option value="all">All districts</option></select>
   <div className="rfqSearch"><Search size={17}/><input type="search" aria-label="Search vendors" placeholder="Search vendor, contact, phone, email, brand…" value={q} onChange={e=>setQ(e.target.value)}/>{q&&<button type="button" className="placeClear" aria-label="Clear search" onClick={()=>setQ('')}><X size={15}/></button>}</div>
   <select aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{VENDOR_STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select>
   <select aria-label="Sort" value={sort} onChange={e=>setSort(e.target.value as any)}><option value="installs">Most installations here</option><option value="rating">Best rating</option><option value="reviews">Most reviews</option><option value="name">Name</option></select>
   <label className="campCheck"><input type="checkbox" checked={activeOnly} onChange={e=>setActiveOnly(e.target.checked)}/>Only vendors working here</label>
   <div className="campToolbarActions">
    {can('create')&&<label className="adminBtn ghost"><Upload size={16}/>{busy?'Working…':'Import vendors'}<input hidden type="file" accept=".json,.xlsx,.xls,.csv" onChange={importFile} disabled={busy}/></label>}
    {can('create')&&<button className="adminBtn" onClick={()=>open(blank())}><Plus size={16}/>Add vendor</button>}
   </div>
  </section>

  <div className="rfqStats">
   <div><span>Vendors {district==='all'?'in all districts':`in ${district}`}</span><b>{IN(shown.length)}</b><small>{IN(vendors.length)} in the full list</small></div>
   <div><span>Shortlisted / approved / working</span><b>{working}</b><small>{vendors.filter(v=>v.status==='active').length} working with us</small></div>
   <div><span>Households assigned</span><b>{leads.filter(l=>l.vendor_id).length}</b><small>{unassigned.length} open households without a vendor</small></div>
   <div><span>Top here by installations</span><b className="vendTop">{shown[0]?.name||'—'}</b><small>{shown[0]?`${IN(installsIn(shown[0],district))} installed · ${shown[0].portal_rating??'–'}★ (${IN(shown[0].portal_reviews)})`:''}</small></div>
  </div>

  <section className="adminPanel rfqTablePanel"><div className="adminTableWrap"><table className="adminTable vendTable"><thead><tr><th>Vendor</th><th className="num">{district==='all'?'Installations (our districts)':`Installations in ${district}`}</th><th>Portal rating</th><th>Contact</th><th>Status</th><th className="num">Our households</th><th></th></tr></thead><tbody>
   {shown.slice(0,limit).map(v=>{const mineN=assigned.get(v.id)?.length||0;return <tr key={v.id}>
    <td><button className="rfqOpportunity" onClick={()=>open(v)}><b>{v.name}</b><span>{[v.brands,v.address].filter(Boolean).join(' · ')||(v.registered_districts||[]).join(', ')||'—'}</span></button></td>
    <td className="num"><b>{IN(installsIn(v,district))}</b>{district!=='all'&&Object.keys(v.district_installs||{}).filter(d=>d!==district).length>0&&<span className="tableSub">{Object.entries(v.district_installs).filter(([d])=>d!==district).map(([d,n])=>`${d} ${IN(n)}`).join(' · ')}</span>}</td>
    <td><Stars value={v.portal_rating}/>{v.portal_reviews!=null&&<span className="tableSub">{IN(v.portal_reviews)} reviews</span>}</td>
    <td>{v.contact_name||'—'}<span className="tableSub">{v.phone?<a href={`tel:+91${String(v.phone).replace(/\D/g,'').slice(-10)}`}>{v.phone}</a>:null}{v.email?<> · <a href={`mailto:${v.email}`}>{v.email}</a></>:null}</span></td>
    <td><span className={`vendBadge ${v.status}`}>{vendorStatusLabel(v.status)}</span>{v.our_rating&&<span className="tableSub">Our rating {v.our_rating}/5</span>}</td>
    <td className="num">{mineN||'—'}</td>
    <td className="campRowActions">{v.phone&&<a className="iconBtn" href={`tel:+91${String(v.phone).replace(/\D/g,'').slice(-10)}`} aria-label={`Call ${v.name}`}><Phone size={16}/></a>}{wa(v.phone)&&<a className="iconBtn" href={wa(v.phone)!} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${v.name}`}><MessageCircle size={16}/></a>}<button className="iconBtn" onClick={()=>open(v)} aria-label={`Open ${v.name}`}><Building2 size={16}/></button></td>
   </tr>})}
   {!shown.length&&<tr><td colSpan={7} className="emptyCell">{vendors.length?'No vendors match. Untick "Only vendors working here" or clear the search.':'No vendors yet. Import the PM Surya Ghar vendor list or add one.'}</td></tr>}
  </tbody></table></div>{shown.length>limit&&<div className="placeMore"><span className="muted">Showing {IN(limit)} of {IN(shown.length)}.</span><button className="adminBtn ghost" onClick={()=>setLimit(l=>l+200)}>Show 200 more</button><button className="adminBtn ghost" onClick={()=>setLimit(shown.length)}>Show all</button></div>}</section>
  <p className="muted campFoot">Vendor list, contacts, installations and consumer ratings from the PM Surya Ghar national portal (Registered vendors, by district). Ratings and reviews are the portal&apos;s consumer ratings. Check Google reviews and company age from each vendor&apos;s page.</p>

  {vendor&&<div className="adminDrawerBackdrop" onClick={()=>setVendor(null)}><aside className="rfqDrawer" role="dialog" aria-label="Vendor" onClick={e=>e.stopPropagation()}>
   <div className="rfqDrawerHead"><div><span className="adminEyebrow">INSTALLATION VENDOR</span><h2>{vendor.id?vendor.name:'New vendor'}</h2><p>{vendorStatusLabel(vendor.status)}{vendor.registered_districts?.length?` · registered for ${vendor.registered_districts.join(', ')}`:''}</p></div><button className="iconBtn" onClick={()=>setVendor(null)} aria-label="Close"><X size={19}/></button></div>
   <div className="rfqDrawerActions">{(vendor.id?can('edit'):can('create'))&&<button className="adminBtn" onClick={save} disabled={busy}><Save size={16}/>Save vendor</button>}{vendor.phone&&<a className="adminBtn ghost" href={`tel:+91${String(vendor.phone).replace(/\D/g,'').slice(-10)}`}><Phone size={16}/>Call</a>}{wa(vendor.phone)&&<a className="adminBtn ghost" href={wa(vendor.phone)!} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/>WhatsApp</a>}{vendor.email&&<a className="adminBtn ghost" href={`mailto:${vendor.email}`}><Mail size={16}/>Email</a>}{vendor.id&&can('delete')&&<button className="adminBtn ghost" onClick={remove}><Trash2 size={16}/>Delete</button>}</div>
   <div className="rfqDrawerGrid">
    {vendor.id&&<section className="rfqDrawerSection"><h3><Star size={16}/>On the PM Surya Ghar portal</h3><div className="campMini vendMini">
     <div><span>Consumer rating</span><b><Stars value={vendor.portal_rating}/></b><small>{IN(vendor.portal_reviews)} reviews</small></div>
     {DISTRICTS.map(d=><div key={d}><span>Installed in {d}</span><b>{IN(installsIn(vendor,d))}</b></div>)}
     <div><span>Installed capacity</span><b>{vendor.capacity_kwp!=null?`${IN(vendor.capacity_kwp)} kWp`:'—'}</b></div>
    </div>{vendor.portal_synced_at&&<p className="muted">Portal figures from {new Date(vendor.portal_synced_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}.</p>}</section>}
    <section className="rfqDrawerSection"><h3><Building2 size={16}/>Company & contact</h3><div className="rfqFormGrid">
     <label><span>Vendor name *</span><input value={vendor.name} onChange={e=>setVendor((x:any)=>({...x,name:e.target.value}))}/></label>
     <label><span>Contact person</span><input value={vendor.contact_name} onChange={e=>setVendor((x:any)=>({...x,contact_name:e.target.value}))}/></label>
     <label><span>Phone</span><input inputMode="tel" value={vendor.phone} onChange={e=>setVendor((x:any)=>({...x,phone:e.target.value}))}/></label>
     <label><span>Email</span><input type="email" value={vendor.email} onChange={e=>setVendor((x:any)=>({...x,email:e.target.value}))}/></label>
     <label><span>Website</span><input value={vendor.website} onChange={e=>setVendor((x:any)=>({...x,website:e.target.value}))}/></label>
     <label><span>Panel brands</span><input value={vendor.brands} onChange={e=>setVendor((x:any)=>({...x,brands:e.target.value}))}/></label>
     <label><span>Company since (year)</span><input type="number" min={1950} max={thisYear} value={vendor.established_year} onChange={e=>setVendor((x:any)=>({...x,established_year:e.target.value}))} placeholder="e.g. 2015"/>{vendor.established_year&&<small className="campHint ok">{thisYear-Number(vendor.established_year)} years in business</small>}</label>
     <label><span>GST number</span><input value={vendor.gst_number} onChange={e=>setVendor((x:any)=>({...x,gst_number:e.target.value.toUpperCase()}))}/></label>
    </div><label className="rfqWideLabel"><span>Address</span><input value={vendor.address} onChange={e=>setVendor((x:any)=>({...x,address:e.target.value}))}/></label>
    {links&&vendor.name&&<div className="vendLinks"><a href={links.reviews} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Google reviews</a><a href={links.maps} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Map / office</a><a href={links.company} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Company age (CIN)</a><a href={links.portal} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Portal vendor list</a></div>}</section>
    <section className="rfqDrawerSection"><h3><UserCheck size={16}/>Our assessment</h3><div className="rfqFormGrid">
     <label><span>Status</span><select value={vendor.status} onChange={e=>setVendor((x:any)=>({...x,status:e.target.value}))}>{VENDOR_STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
     <label><span>Our rating</span><select value={String(vendor.our_rating)} onChange={e=>setVendor((x:any)=>({...x,our_rating:e.target.value}))}><option value="">Not rated</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)} {n}/5</option>)}</select></label>
     <label><span>Installation rate (₹ per kW)</span><input type="number" min={0} value={vendor.rate_per_kw} onChange={e=>setVendor((x:any)=>({...x,rate_per_kw:e.target.value}))}/></label>
     <label className="campCheck"><input type="checkbox" checked={Boolean(vendor.pgvcl_registered)} onChange={e=>setVendor((x:any)=>({...x,pgvcl_registered:e.target.checked}))}/>PGVCL-registered vendor (checked)</label>
    </div>
    <div className="vendTalukas"><span>Talukas they cover</span>{DISTRICTS.map(d=><div key={d}><b>{d}</b><div>{talukasFor(d).map(([en])=><label key={en} className="campCheck"><input type="checkbox" checked={vendor.service_talukas.includes(en)} onChange={e=>setVendor((x:any)=>({...x,service_talukas:e.target.checked?[...x.service_talukas,en]:x.service_talukas.filter((t:string)=>t!==en)}))}/>{en}</label>)}</div></div>)}</div>
    <label className="rfqWideLabel"><span>Notes</span><textarea rows={3} value={vendor.notes} onChange={e=>setVendor((x:any)=>({...x,notes:e.target.value}))} placeholder="Price agreed, quality of past work, team size, references…"/></label></section>
    {vendor.id&&<section className="rfqDrawerSection vendWork"><h3><UserCheck size={16}/>Installation work ({mine.length})</h3>
     {mine.length?<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Household</th><th>Village</th><th>Stage</th><th></th></tr></thead><tbody>{mine.map(l=><tr key={l.id}><td><button className="rfqOpportunity" onClick={()=>{setVendor(null);openLead(l)}}><b>{l.full_name}</b><span>{l.mobile||''}</span></button></td><td>{l.village||'—'}<span className="tableSub">{l.district}</span></td><td>{String(l.stage).replaceAll('_',' ')}</td><td>{can('edit')&&<button className="adminBtn ghost" onClick={()=>assign([l.id],null)} disabled={busy}>Remove</button>}</td></tr>)}</tbody></table></div>:<p className="muted">No households assigned yet.</p>}
     {can('edit')&&<><h4 className="vendSub">Give work: households without a vendor{vendor.registered_districts?.length?` in ${vendor.registered_districts.join(', ')}`:''}</h4>
      {candidates.length?<><div className="vendPick">{candidates.slice(0,200).map(l=><label key={l.id} className="campCheck"><input type="checkbox" checked={Boolean(pick[l.id])} onChange={e=>setPick(p=>({...p,[l.id]:e.target.checked}))}/>{l.full_name}<span className="muted"> · {l.village||'—'}, {l.district} · {l.system_kw?`${l.system_kw} kW`:'size not set'}</span></label>)}</div>
      <button className="adminBtn" disabled={busy||!Object.values(pick).some(Boolean)} onClick={()=>assign(Object.keys(pick).filter(k=>pick[k]),vendor.id)}><UserCheck size={16}/>Assign {Object.values(pick).filter(Boolean).length||''} to {vendor.name}</button></>:<p className="muted">Every open household in these districts already has a vendor.</p>}</>}
    </section>}
   </div>
  </aside></div>}
 </>
}

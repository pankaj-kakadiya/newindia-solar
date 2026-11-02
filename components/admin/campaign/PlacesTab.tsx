'use client'

import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import * as XLSX from 'xlsx'
import {Landmark,MapPin,Plus,Save,Search,Trash2,Upload,X} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import {CAMPAIGN_GEO,VENUE_TYPES,bilingual,findVillage,searchVillages,squashPlace,talukasFor,venueTypeLabel,villagesFromSheetRows,type VillageRow} from '../../../lib/gujarat-places'
import {reachedStage} from '../../../lib/surya-ghar-campaign'
import {PlaceFields} from './PlaceFields'

type Can=(a:'create'|'edit'|'delete'|'export')=>boolean
const key=(d:string,v:string)=>`${d}|${String(v||'').trim().toLowerCase()}`
const int=(v:any)=>v===''||v==null?null:Math.max(0,Math.round(Number(v)))
const blankVillage=(district:string,taluka:string)=>({district:district==='all'?'Amreli':district,taluka:taluka==='all'?'':taluka,name_en:'',name_gu:'',households:'',population:'',lgd_code:''})
const blankVenue=(district:string,taluka:string)=>({district:district==='all'?'Amreli':district,taluka:taluka==='all'?'':taluka,village:'',venue_type:'panchayat_office',name:'',contact_name:'',contact_phone:'',capacity:'',notes:''})

export default function PlacesTab({villages,venues,leads,camps,can,reload,setErr,flash}:{villages:VillageRow[];venues:any[];leads:any[];camps:any[];can:Can;reload:()=>Promise<void>;setErr:(m:string)=>void;flash:(m:string)=>void}){
 const [district,setDistrict]=useState('all'),[taluka,setTaluka]=useState('all'),[q,setQ]=useState(''),[busy,setBusy]=useState(false)
 const [village,setVillage]=useState<any>(null),[venue,setVenue]=useState<any>(null),[limit,setLimit]=useState(300)

 const stats=useMemo(()=>{
  const m=new Map<string,{camps:number;leads:number;registered:number;commissioned:number;venues:number}>()
  const get=(k:string)=>{let s=m.get(k);if(!s){s={camps:0,leads:0,registered:0,commissioned:0,venues:0};m.set(k,s)}return s}
  for(const c of camps)get(key(c.district,c.village)).camps++
  for(const v of venues)get(key(v.district,v.village)).venues++
  for(const l of leads){if(!l.village)continue;const s=get(key(l.district,l.village));s.leads++;if(l.portal_registered||reachedStage(l.stage,'registered'))s.registered++;if(reachedStage(l.stage,'commissioned'))s.commissioned++}
  return m
 },[camps,venues,leads])
 const none={camps:0,leads:0,registered:0,commissioned:0,venues:0}
 const talukaOptions=district==='all'?[]:talukasFor(district)
 useEffect(()=>{setLimit(300)},[district,taluka,q])
 const searching=q.trim().length>0
 const inArea=useMemo(()=>villages.filter(v=>(district==='all'||v.district===district)&&(taluka==='all'||v.taluka===taluka)),[villages,district,taluka])
 const shown=useMemo(()=>q.trim()?searchVillages(inArea,q,100000):inArea.slice().sort((a,b)=>a.district.localeCompare(b.district)||a.taluka.localeCompare(b.taluka)||a.name_en.localeCompare(b.name_en)),[inArea,q])
 const byDistrict=useMemo(()=>Object.keys(CAMPAIGN_GEO).filter(d=>d!=='Other').map(d=>[d,villages.filter(v=>v.district===d).length] as const),[villages])
 // Venues match on venue name, village (English or the directory's Gujarati name), taluka or contact.
 const guName=useMemo(()=>new Map(villages.map(v=>[`${v.district}|${squashPlace(v.name_en)}`,v.name_gu||''])),[villages])
 const shownVenues=useMemo(()=>{const s=squashPlace(q);return venues.filter(v=>(district==='all'||v.district===district)&&(taluka==='all'||!v.taluka||v.taluka===taluka)&&(!s||squashPlace(`${v.name} ${v.village} ${v.taluka||''} ${v.contact_name||''} ${guName.get(`${v.district}|${squashPlace(v.village)}`)||''} ${venueTypeLabel(v.venue_type)}`).includes(s)))},[venues,district,taluka,q,guName])

 // Taluka coverage: villages in the directory, villages reached by a camp, and the household pipeline.
 const coverage=useMemo(()=>Object.entries(CAMPAIGN_GEO).filter(([d])=>d!=='Other'&&(district==='all'||d===district)).flatMap(([d,info])=>info.talukas.map(([t,gu])=>{
  const vs=villages.filter(v=>v.district===d&&v.taluka===t)
  const L=leads.filter(l=>l.district===d&&l.taluka===t)
  const campVillages=new Set(camps.filter(c=>c.district===d&&c.taluka===t).map(c=>String(c.village).toLowerCase()))
  return {d,t,gu,villages:vs.length,households:vs.reduce((a,v)=>a+(v.households||0),0),reached:campVillages.size,leads:L.length,registered:L.filter(l=>l.portal_registered||reachedStage(l.stage,'registered')).length,commissioned:L.filter(l=>reachedStage(l.stage,'commissioned')).length}
 })),[villages,leads,camps,district])

 async function importVillages(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file)return
  try{
   const wb=XLSX.read(await file.arrayBuffer(),{type:'array'})
   const rows:any[]=[]
   for(const name of wb.SheetNames){
    const grid=XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name],{header:1,raw:false,defval:''})
    const h=grid.findIndex(r=>r.some((c:any)=>/village/i.test(String(c))))
    if(h<0)continue
    const headers=grid[h].map((c:any)=>String(c))
    for(const r of grid.slice(h+1))rows.push(Object.fromEntries(headers.map((k,i)=>[k,r[i]])))
   }
   const {villages:parsed,skipped}=villagesFromSheetRows(rows,district==='all'?undefined:district)
   if(!parsed.length){setErr('No villages from Gir Somnath, Amreli or Bhavnagar found. The sheet needs Village name, Sub-district/Taluka and District columns (an LGD "Villages" download works), or pick a district first for a single-district file.');return}
   const fresh:VillageRow[]=[],update:{id:string;patch:any}[]=[]
   for(const v of parsed){const hit=findVillage(villages,v.district,v.taluka,v.name_en);if(!hit)fresh.push(v);else{const patch:any={};for(const k of ['name_gu','lgd_code','census_code','households','population'] as const)if(v[k]!=null&&v[k]!==''&&(hit as any)[k]==null)patch[k]=v[k];if(Object.keys(patch).length&&hit.id)update.push({id:hit.id,patch})}}
   if(!confirm(`${file.name}: ${fresh.length} new villages, ${update.length} existing villages get missing details${skipped?`, ${skipped} rows skipped (other districts, unknown taluka or duplicates)`:''}. Import?`))return
   setBusy(true);let failed=0
   const source=parsed.some(v=>v.lgd_code)?'lgd':'census'
   // Insert in batches; when a batch hits an existing village, split it until only the clashing rows are left out.
   const insertRows=async(rows:VillageRow[]):Promise<number>=>{if(!rows.length)return 0;const {error}=await supabase.from('geo_villages').insert(rows.map(v=>({...v,source})));if(!error)return 0;if(rows.length===1)return 1;const mid=Math.ceil(rows.length/2);return (await insertRows(rows.slice(0,mid)))+(await insertRows(rows.slice(mid)))}
   for(let i=0;i<fresh.length;i+=500)failed+=await insertRows(fresh.slice(i,i+500))
   for(const u of update){const {error}=await supabase.from('geo_villages').update(u.patch).eq('id',u.id);if(error)failed++}
   setBusy(false);await reload()
   flash(`Village directory updated: ${fresh.length} new and ${update.length} updated${failed?`, ${failed} could not be saved`:''}.`)
  }catch(x:any){setBusy(false);setErr(`Could not read the file: ${x?.message||x}`)}
 }

 async function saveVillage(){
  if(!village.name_en.trim()||!village.taluka){setErr('Village name and taluka are required.');return}
  const payload={district:village.district,taluka:village.taluka,name_en:village.name_en.trim(),name_gu:village.name_gu?.trim()||null,households:int(village.households),population:int(village.population),lgd_code:village.lgd_code?.trim()||null}
  setBusy(true)
  const {error}=village.id?await supabase.from('geo_villages').update(payload).eq('id',village.id):await supabase.from('geo_villages').insert({...payload,source:'manual'})
  setBusy(false)
  if(error){setErr(/unique|duplicate/i.test(error.message)?'This village is already in the directory for that taluka.':error.message);return}
  setVillage(null);flash('Village saved.');reload()
 }
 async function deleteVillage(){if(!village?.id||!confirm(`Remove ${village.name_en} from the village directory? Leads and camps keep their village text.`))return;const {error}=await supabase.from('geo_villages').delete().eq('id',village.id);if(error){setErr(error.message);return}setVillage(null);reload()}

 async function saveVenue(){
  if(!venue.village.trim()||!venue.name.trim()){setErr('Village and venue name are required.');return}
  const payload={district:venue.district,taluka:venue.taluka||null,village:venue.village.trim(),venue_type:venue.venue_type,name:venue.name.trim(),contact_name:venue.contact_name||null,contact_phone:venue.contact_phone||null,capacity:int(venue.capacity),notes:venue.notes||null}
  setBusy(true)
  const {error}=venue.id?await supabase.from('campaign_venues').update(payload).eq('id',venue.id):await supabase.from('campaign_venues').insert(payload)
  setBusy(false)
  if(error){setErr(/unique|duplicate/i.test(error.message)?'A venue with this name is already saved for this village.':error.message);return}
  setVenue(null);flash('Venue saved.');reload()
 }
 async function deleteVenue(){if(!venue?.id||!confirm(`Delete venue ${venue.name}? Camps that used it keep the venue name.`))return;const {error}=await supabase.from('campaign_venues').delete().eq('id',venue.id);if(error){setErr(error.message);return}setVenue(null);reload()}

 return <>
  <section className="campToolbar">
   <select aria-label="District" value={district} onChange={e=>{setDistrict(e.target.value);setTaluka('all')}}><option value="all">All districts</option>{Object.entries(CAMPAIGN_GEO).filter(([d])=>d!=='Other').map(([d,i])=><option key={d} value={d}>{bilingual(d,i.gu)}</option>)}</select>
   <select aria-label="Taluka" value={taluka} disabled={district==='all'} onChange={e=>setTaluka(e.target.value)}><option value="all">{district==='all'?'Pick a district':'All talukas'}</option>{talukaOptions.map(([en,gu])=><option key={en} value={en}>{bilingual(en,gu)}</option>)}</select>
   <div className="rfqSearch"><Search size={17}/><input type="search" aria-label="Search villages and venues" placeholder="Search village or venue (English / ગુજરાતી)" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setQ('')}}/>{q&&<button type="button" className="placeClear" aria-label="Clear search" onClick={()=>setQ('')}><X size={15}/></button>}</div>
   <div className="campToolbarActions">
    {can('create')&&<label className="adminBtn ghost"><Upload size={16}/>{busy?'Working…':'Import village list'}<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={importVillages} disabled={busy}/></label>}
    {can('create')&&<button className="adminBtn ghost" onClick={()=>setVillage(blankVillage(district,taluka))}><Plus size={16}/>Add village</button>}
    {can('create')&&<button className="adminBtn" onClick={()=>setVenue(blankVenue(district,taluka))}><Plus size={16}/>Add venue</button>}
   </div>
  </section>

  {searching&&<section className="placeResultBar" role="status"><b>{shown.length.toLocaleString('en-IN')} {shown.length===1?'village':'villages'}</b> and <b>{shownVenues.length} {shownVenues.length===1?'venue':'venues'}</b> match “{q.trim()}”{taluka!=='all'?` in ${taluka}`:district!=='all'?` in ${district}`:''}.{!shown.length&&(taluka!=='all'||district!=='all')&&<> <button type="button" className="linkBtn" onClick={()=>{setDistrict('all');setTaluka('all')}}>Search all districts</button></>}<button type="button" className="adminBtn ghost" onClick={()=>setQ('')}><X size={15}/>Clear search</button></section>}
  {!searching&&<section className="adminPanel campPanel"><h2><MapPin size={18}/>Taluka coverage</h2><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Taluka</th><th>District</th><th className="num">Villages in directory</th><th className="num">Households (Census)</th><th className="num">Villages with a camp</th><th className="num">Leads</th><th className="num">Registered</th><th className="num">Commissioned</th></tr></thead><tbody>
   {coverage.map(r=><tr key={r.d+r.t}><td><button className="rfqOpportunity" onClick={()=>{setDistrict(r.d);setTaluka(r.t)}}><b>{r.t}</b><span>{r.gu}</span></button></td><td>{r.d}</td><td className="num">{r.villages||'—'}</td><td className="num">{r.households?r.households.toLocaleString('en-IN'):'—'}</td><td className="num">{r.reached}{r.villages?<span className="tableSub">{Math.round(r.reached/r.villages*100)}%</span>:null}</td><td className="num">{r.leads}</td><td className="num">{r.registered}</td><td className="num">{r.commissioned}</td></tr>)}
  </tbody></table></div></section>}

  <section className="adminPanel campPanel"><h2><MapPin size={18}/>Villages ({shown.length.toLocaleString('en-IN')})</h2><p className="muted">In the directory: {byDistrict.map(([d,n])=>`${d} ${n.toLocaleString('en-IN')}`).join(' · ')} · total {villages.length.toLocaleString('en-IN')}</p>{villages.length?null:<p className="muted">The village directory is empty. Import the LGD village list (lgdirectory.gov.in → Download Directory → Villages, State Gujarat, District Gir Somnath / Amreli / Bhavnagar) to get every village in English and Gujarati. Villages typed on leads and camps are also added here.</p>}
   <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Village</th><th>Taluka</th><th className="num">Households</th><th className="num">Camps</th><th className="num">Venues</th><th className="num">Leads</th><th className="num">Registered</th><th className="num">Commissioned</th></tr></thead><tbody>
    {shown.slice(0,limit).map(v=>{const s=stats.get(key(v.district,v.name_en))||none;return <tr key={v.id}><td><button className="rfqOpportunity" onClick={()=>setVillage({...v,name_gu:v.name_gu||'',households:v.households??'',population:v.population??'',lgd_code:v.lgd_code||''})}><b>{v.name_en}</b><span>{v.name_gu||'Gujarati name not set'}</span></button></td><td>{v.taluka}<span className="tableSub">{v.district}</span></td><td className="num">{v.households?.toLocaleString('en-IN')??'—'}</td><td className="num">{s.camps}</td><td className="num">{s.venues}</td><td className="num">{s.leads}</td><td className="num">{s.registered}</td><td className="num">{s.commissioned}</td></tr>})}
    {!shown.length&&<tr><td colSpan={8} className="emptyCell">No villages match.</td></tr>}
   </tbody></table></div>{shown.length>limit&&<div className="placeMore"><span className="muted">Showing {limit.toLocaleString('en-IN')} of {shown.length.toLocaleString('en-IN')}.</span><button className="adminBtn ghost" onClick={()=>setLimit(l=>l+500)}>Show 500 more</button><button className="adminBtn ghost" onClick={()=>setLimit(shown.length)}>Show all</button></div>}
  </section>

  <section className="adminPanel campPanel"><h2><Landmark size={18}/>Saved venues ({shownVenues.length})</h2><p className="muted">Save a venue once (panchayat office, government school, temple, ground) and pick it for every later camp in that village.</p>
   <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Venue</th><th>Type</th><th>Village</th><th>Contact</th><th className="num">Capacity</th><th className="num">Camps</th></tr></thead><tbody>
    {shownVenues.map(v=><tr key={v.id}><td><button className="rfqOpportunity" onClick={()=>setVenue({...v,taluka:v.taluka||'',contact_name:v.contact_name||'',contact_phone:v.contact_phone||'',capacity:v.capacity??'',notes:v.notes||''})}><b>{v.name}</b><span>{v.notes||''}</span></button></td><td>{venueTypeLabel(v.venue_type)}</td><td>{v.village}<span className="tableSub">{[v.taluka,v.district].filter(Boolean).join(', ')}</span></td><td>{v.contact_name||'—'}<span className="tableSub">{v.contact_phone||''}</span></td><td className="num">{v.capacity??'—'}</td><td className="num">{camps.filter(c=>c.venue_id===v.id).length}</td></tr>)}
    {!shownVenues.length&&<tr><td colSpan={6} className="emptyCell">No saved venues yet.</td></tr>}
   </tbody></table></div>
  </section>

  {village&&<div className="adminDrawerBackdrop" onClick={()=>setVillage(null)}><aside className="rfqDrawer campSmallDrawer" role="dialog" aria-label="Village" onClick={e=>e.stopPropagation()}>
   <div className="rfqDrawerHead"><div><span className="adminEyebrow">VILLAGE DIRECTORY</span><h2>{village.id?bilingual(village.name_en,village.name_gu):'New village'}</h2><p>{[village.taluka,village.district].filter(Boolean).join(', ')}</p></div><button className="iconBtn" onClick={()=>setVillage(null)} aria-label="Close"><X size={19}/></button></div>
   <div className="rfqDrawerActions">{(village.id?can('edit'):can('create'))&&<button className="adminBtn" onClick={saveVillage} disabled={busy}><Save size={16}/>Save village</button>}{village.id&&can('delete')&&<button className="adminBtn ghost" onClick={deleteVillage}><Trash2 size={16}/>Remove</button>}</div>
   <section className="rfqDrawerSection"><div className="rfqFormGrid">
    <label><span>District</span><select value={village.district} onChange={e=>setVillage((x:any)=>({...x,district:e.target.value,taluka:''}))}>{Object.entries(CAMPAIGN_GEO).map(([d,i])=><option key={d} value={d}>{bilingual(d,i.gu)}</option>)}</select></label>
    <label><span>Taluka *</span>{talukasFor(village.district).length?<select value={village.taluka} onChange={e=>setVillage((x:any)=>({...x,taluka:e.target.value}))}><option value="">Select taluka</option>{talukasFor(village.district).map(([en,gu])=><option key={en} value={en}>{bilingual(en,gu)}</option>)}</select>:<input value={village.taluka} onChange={e=>setVillage((x:any)=>({...x,taluka:e.target.value}))}/>}</label>
    <label><span>Village name (English) *</span><input value={village.name_en} onChange={e=>setVillage((x:any)=>({...x,name_en:e.target.value}))}/></label>
    <label><span>ગામનું નામ (Gujarati)</span><input lang="gu" value={village.name_gu} onChange={e=>setVillage((x:any)=>({...x,name_gu:e.target.value}))}/></label>
    <label><span>Households</span><input type="number" min={0} value={village.households} onChange={e=>setVillage((x:any)=>({...x,households:e.target.value}))}/></label>
    <label><span>Population</span><input type="number" min={0} value={village.population} onChange={e=>setVillage((x:any)=>({...x,population:e.target.value}))}/></label>
    <label><span>LGD village code</span><input value={village.lgd_code} onChange={e=>setVillage((x:any)=>({...x,lgd_code:e.target.value}))}/></label>
   </div></section>
  </aside></div>}

  {venue&&<div className="adminDrawerBackdrop" onClick={()=>setVenue(null)}><aside className="rfqDrawer campSmallDrawer" role="dialog" aria-label="Venue" onClick={e=>e.stopPropagation()}>
   <div className="rfqDrawerHead"><div><span className="adminEyebrow">CAMP VENUE</span><h2>{venue.id?venue.name:'New venue'}</h2><p>{[venue.village,venue.taluka,venue.district].filter(Boolean).join(', ')||'Village not set'}</p></div><button className="iconBtn" onClick={()=>setVenue(null)} aria-label="Close"><X size={19}/></button></div>
   <div className="rfqDrawerActions">{(venue.id?can('edit'):can('create'))&&<button className="adminBtn" onClick={saveVenue} disabled={busy}><Save size={16}/>Save venue</button>}{venue.id&&can('delete')&&<button className="adminBtn ghost" onClick={deleteVenue}><Trash2 size={16}/>Delete</button>}</div>
   <section className="rfqDrawerSection"><div className="rfqFormGrid">
    <PlaceFields value={{district:venue.district,taluka:venue.taluka,village:venue.village}} villages={villages} required onChange={p=>setVenue((x:any)=>({...x,...p}))}/>
    <label><span>Venue type</span><select value={venue.venue_type} onChange={e=>setVenue((x:any)=>({...x,venue_type:e.target.value}))}>{VENUE_TYPES.map(t=><option key={t.key} value={t.key}>{t.label} ({t.gu})</option>)}</select></label>
    <label><span>Venue name *</span><input value={venue.name} onChange={e=>setVenue((x:any)=>({...x,name:e.target.value}))} placeholder="e.g. Prathmik Shala, Khambha"/></label>
    <label><span>Contact person</span><input value={venue.contact_name} onChange={e=>setVenue((x:any)=>({...x,contact_name:e.target.value}))} placeholder="Principal, talati, pujari…"/></label>
    <label><span>Contact phone</span><input inputMode="tel" value={venue.contact_phone} onChange={e=>setVenue((x:any)=>({...x,contact_phone:e.target.value}))}/></label>
    <label><span>Seating capacity</span><input type="number" min={0} value={venue.capacity} onChange={e=>setVenue((x:any)=>({...x,capacity:e.target.value}))}/></label>
   </div><label className="rfqWideLabel"><span>Notes</span><textarea rows={3} value={venue.notes} onChange={e=>setVenue((x:any)=>({...x,notes:e.target.value}))} placeholder="Power socket, shade, permission needed from…"/></label></section>
  </aside></div>}
 </>
}

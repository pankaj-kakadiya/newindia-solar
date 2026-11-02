'use client'

import {useEffect,useMemo,useState} from 'react'
import {Activity,BarChart3,Check,ClipboardPaste,Download,Gauge,MapPin,RefreshCw,Save,Search,Sun,X,Zap} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import {canAdmin} from '../../../lib/adminAccess'
import {SOLAR_SITES,districtInsights,estimateDailyKwh,estimateOutputMw,parsePortalTable,type PmsgRow} from '../../../lib/solar-market'
import {reachedStage} from '../../../lib/surya-ghar-campaign'

type Tab='pmsg'|'energy'
const CAMPAIGN=['Gir Somnath','Amreli','Bhavnagar']
const IN=(n:any,d=0)=>Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:d,minimumFractionDigits:d})
const pct=(n:number)=>`${(n*100).toFixed(1)}%`
const cr=(lakh:number)=>`₹${IN(lakh/100,0)} Cr`
const fmtDate=(d:string)=>d?new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'
const today=()=>new Date(Date.now()+5.5*3600_000).toISOString().slice(0,10)

// Sunlight straight from Open-Meteo in the browser, used when the server could not reach it.
async function browserSun(){
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${SOLAR_SITES.map(s=>s.lat).join(',')}&longitude=${SOLAR_SITES.map(s=>s.lon).join(',')}&current=temperature_2m,cloud_cover,shortwave_radiation&daily=shortwave_radiation_sum,sunshine_duration&timezone=Asia%2FKolkata&forecast_days=1`
 const j=await (await fetch(url)).json();const list=Array.isArray(j)?j:[j]
 return SOLAR_SITES.map((s,i)=>{const w=list[i]||{};const rad=Number(w.daily?.shortwave_radiation_sum?.[0]??0);return{...s,irradiance:Number(w.current?.shortwave_radiation??0),cloud_cover:w.current?.cloud_cover??null,temperature:w.current?.temperature_2m??null,sunshine_hours:Math.round(Number(w.daily?.sunshine_duration?.[0]??0)/360)/10,kwh_today_2_18:Math.round(estimateDailyKwh(2.18,rad)*10)/10}})
}

async function fetchAll(table:string,select='*'){const out:any[]=[];for(let from=0;from<100000;from+=1000){const {data,error}=await supabase.from(table).select(select).order('id').range(from,from+999);if(error)return {data:out,error};out.push(...(data||[]));if(!data||data.length<1000)break}return {data:out,error:null as any}}

export default function SolarMarketData(){
 const [tab,setTab]=useState<Tab>('pmsg')
 const [rows,setRows]=useState<PmsgRow[]>([]),[leads,setLeads]=useState<any[]>([]),[access,setAccess]=useState<any>(null)
 const [loading,setLoading]=useState(true),[err,setErr]=useState(''),[msg,setMsg]=useState('')
 const [snap,setSnap]=useState(''),[q,setQ]=useState(''),[onlyCampaign,setOnlyCampaign]=useState(false),[sort,setSort]=useState<'pending'|'installations'|'capacity_mw'|'conversion'|'name'>('pending')
 const [importOpen,setImportOpen]=useState(false),[pasteDate,setPasteDate]=useState(today()),[paste,setPaste]=useState(''),[saving,setSaving]=useState(false)
 const [live,setLive]=useState<any>(null),[liveErr,setLiveErr]=useState(''),[liveLoading,setLiveLoading]=useState(false)

 async function load(){
  setLoading(true);setErr('')
  const [p,l,a]=await Promise.all([fetchAll('pmsg_stats','snapshot_date,level,state,name,applications,installations,households,capacity_mw,subsidy_lakh'),fetchAll('campaign_leads','district,stage,portal_registered'),supabase.rpc('get_my_admin_access')])
  if(p.error)setErr(/does not exist|schema cache/i.test(p.error.message)?'The solar data tables are not set up yet. Run the solar_market_dashboards database update in Supabase, then refresh.':p.error.message)
  const data=(p.data||[]).map((r:any)=>({...r,applications:Number(r.applications),installations:Number(r.installations),households:Number(r.households),capacity_mw:Number(r.capacity_mw),subsidy_lakh:Number(r.subsidy_lakh)}))
  setRows(data);setLeads(l.data||[]);setAccess(a.data||null)
  const dates=[...new Set(data.map((r:PmsgRow)=>r.snapshot_date))].sort().reverse()
  setSnap(s=>s&&dates.includes(s)?s:dates[0]||'')
  setLoading(false)
 }
 useEffect(()=>{load()},[])

 async function loadLive(){
  setLiveLoading(true);setLiveErr('')
  try{
   const {data:{session}}=await supabase.auth.getSession()
   const r=await fetch('/api/admin/solar/live',{headers:{Authorization:`Bearer ${session?.access_token||''}`},cache:'no-store'})
   const j=await r.json().catch(()=>({error:`The server answered HTTP ${r.status}`}))
   if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`)
   if(!j.sun?.length){try{j.sun=await browserSun();j.sun_error=null}catch{}}
   setLive(j)
  }catch(x:any){
   setLiveErr(x?.message||String(x))
   // Still show today's sunlight and the rooftop estimate when the server route is unavailable.
   try{const sun=await browserSun();const guj=rows.filter(r=>r.level==='state'&&r.state.toLowerCase()==='gujarat').sort((a,b)=>b.snapshot_date.localeCompare(a.snapshot_date))[0];const avg=sun.reduce((a,x)=>a+x.irradiance,0)/sun.length;const camp=sun.slice(0,3);setLive((prev:any)=>prev||{grid:null,sun,history:[],rooftop:{installed_mw:guj?.capacity_mw||0,installed_as_of:guj?.snapshot_date||null,avg_irradiance:Math.round(avg),estimated_output_mw:Math.round(estimateOutputMw(guj?.capacity_mw||0,avg)),campaign_kwh_today_2_18:Math.round(camp.reduce((a,x)=>a+x.kwh_today_2_18,0)/camp.length*10)/10}})}catch{}
  }
  setLiveLoading(false)
 }
 useEffect(()=>{if(tab!=='energy')return;loadLive();const t=window.setInterval(loadLive,120_000);return()=>window.clearInterval(t)},[tab])

 const dates=useMemo(()=>[...new Set(rows.map(r=>r.snapshot_date))].sort().reverse(),[rows])
 const prevDate=dates[dates.indexOf(snap)+1]||''
 const at=(d:string,level:string)=>rows.filter(r=>r.snapshot_date===d&&r.level===level)
 const india=at(snap,'india')[0]
 const states=useMemo(()=>at(snap,'state').sort((a,b)=>b.installations-a.installations),[rows,snap])
 const guj=states.find(s=>s.name.toLowerCase()==='gujarat')
 const gujRank=guj?states.indexOf(guj)+1:0
 const districts=useMemo(()=>districtInsights(at(snap,'district').filter(r=>r.state.toLowerCase()==='gujarat'),at(prevDate,'district')),[rows,snap,prevDate])
 const discoms=useMemo(()=>districtInsights(at(snap,'discom').filter(r=>r.state.toLowerCase()==='gujarat'),at(prevDate,'discom')).sort((a,b)=>b.installations-a.installations),[rows,snap,prevDate])
 const ours=(d:string)=>{const L=leads.filter(l=>l.district===d);return{leads:L.length,registered:L.filter(l=>l.portal_registered||reachedStage(l.stage,'registered')).length,commissioned:L.filter(l=>reachedStage(l.stage,'commissioned')).length}}
 const shown=useMemo(()=>{const s=q.trim().toLowerCase();const list=districts.filter(d=>(!onlyCampaign||CAMPAIGN.includes(d.name))&&(!s||d.name.toLowerCase().includes(s)));return list.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):(b as any)[sort]-(a as any)[sort])},[districts,q,onlyCampaign,sort])
 const maxPending=Math.max(1,...districts.map(d=>d.pending)),maxInst=Math.max(1,...districts.map(d=>d.installations))
 const campaignTotals=districts.filter(d=>CAMPAIGN.includes(d.name)).reduce((a,d)=>({applications:a.applications+d.applications,installations:a.installations+d.installations,pending:a.pending+d.pending,capacity_mw:a.capacity_mw+d.capacity_mw}),{applications:0,installations:0,pending:0,capacity_mw:0})

 const parsed=useMemo(()=>paste.trim()?parsePortalTable(paste,pasteDate):null,[paste,pasteDate])
 async function saveSnapshot(){
  if(!parsed?.rows.length)return
  setSaving(true);setErr('')
  const groups=[...new Set(parsed.rows.map(r=>`${r.level}|${r.state}`))]
  for(const g of groups){const [level,state]=g.split('|');const {error}=await supabase.from('pmsg_stats').delete().eq('snapshot_date',pasteDate).eq('level',level).ilike('state',state);if(error){setSaving(false);setErr(error.message);return}}
  const {error}=await supabase.from('pmsg_stats').insert(parsed.rows)
  setSaving(false)
  if(error){setErr(error.message);return}
  setMsg(`Saved ${parsed.rows.length} rows for ${fmtDate(pasteDate)}.`);setPaste('');setImportOpen(false);await load();setSnap(pasteDate)
  window.setTimeout(()=>setMsg(''),5000)
 }
 function exportCsv(){
  const head=['Snapshot','District','Applications','Installations','Pending applications','Conversion %','Capacity (MW)','Subsidy (₹ lakh)','Households']
  const body=shown.map(d=>[d.snapshot_date,d.name,d.applications,d.installations,d.pending,(d.conversion*100).toFixed(1),d.capacity_mw,d.subsidy_lakh,d.households])
  const csv=[head,...body].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));a.download=`pm-surya-ghar-gujarat-districts-${snap}.csv`;a.click()
 }

 return <div className="rfqV2 campV1 solarV1">
  <div className="rfqHero"><div><span className="adminEyebrow">MARKET INTELLIGENCE</span><h1>Solar Market Data</h1><p>PM Surya Ghar progress for Gujarat by district and DISCOM, compared with every state, and the live Gujarat grid with today&apos;s sunlight in your campaign districts.</p></div><div className="rfqHeroActions"><button className="adminBtn ghost" onClick={()=>tab==='pmsg'?load():loadLive()}><RefreshCw size={16}/>Refresh</button>{tab==='pmsg'&&canAdmin(access,'campaigns','export')&&<button className="adminBtn ghost" onClick={exportCsv}><Download size={16}/>Export districts</button>}</div></div>
  {msg&&<div className="themeMessage"><Check size={16}/>{msg}</div>}
  {err&&<div className="themeMessage campError"><X size={16}/>{err}</div>}

  <div className="reportsTabs" role="tablist">
   <button role="tab" aria-selected={tab==='pmsg'} className={tab==='pmsg'?'active':''} onClick={()=>setTab('pmsg')}><BarChart3 size={16}/>PM Surya Ghar data</button>
   <button role="tab" aria-selected={tab==='energy'} className={tab==='energy'?'active':''} onClick={()=>setTab('energy')}><Zap size={16}/>Gujarat energy (live)</button>
  </div>

  {tab==='pmsg'&&(loading?<section className="adminPanel"><p className="emptyCell">Loading portal data…</p></section>:<>
   <section className="campToolbar">
    <label className="solarInline"><span>Snapshot</span><select aria-label="Snapshot date" value={snap} onChange={e=>setSnap(e.target.value)}>{dates.map(d=><option key={d} value={d}>{fmtDate(d)}</option>)}</select></label>
    <span className="muted solarNote">{prevDate?`Change shown since ${fmtDate(prevDate)}`:'Add a newer snapshot to see change over time.'}</span>
    <div className="campToolbarActions">{canAdmin(access,'campaigns','edit')&&<button className="adminBtn ghost" onClick={()=>setImportOpen(o=>!o)}><ClipboardPaste size={16}/>Add portal snapshot</button>}</div>
   </section>

   {importOpen&&<section className="adminPanel campPanel"><h2><ClipboardPaste size={18}/>Add a portal snapshot</h2>
    <p className="muted">On pmsuryaghar.gov.in open Reports → State/UT-wise Progress, click Gujarat, then District Info (or Discom Info). Select the whole table from its title down, copy, and paste it here. Repeat for the other table. Pasting again for the same date replaces that date&apos;s figures.</p>
    <div className="solarImport"><label className="solarInline"><span>Snapshot date</span><input type="date" value={pasteDate} onChange={e=>setPasteDate(e.target.value)}/></label>
     <textarea aria-label="Pasted portal table" rows={8} value={paste} onChange={e=>setPaste(e.target.value)} placeholder={'District-wise Data for Gujarat\nDistrict\tAPPLICATION (No.)\tINSTALLATION (No.)\tHOUSEHOLD COVERED (No.)\tINSTALLATION CAPACITY (MW)\tSUBSIDY RELEASED(Lakhs)\nAhmedabad\t1,31,428\t1,04,934\t2,48,682\t441.17\t76,266.99'}/>
     {parsed&&<p className={parsed.rows.length?'campHint ok':'campHint'}>{parsed.rows.length?`${parsed.rows.length} ${parsed.rows[0].level} rows for ${parsed.rows[0].state} ready`:'No rows recognised yet.'}{parsed.skipped.length?` · ${parsed.skipped.length} lines not recognised`:''}</p>}
     <div><button className="adminBtn" disabled={!parsed?.rows.length||saving} onClick={saveSnapshot}><Save size={16}/>{saving?'Saving…':'Save snapshot'}</button></div></div>
   </section>}

   {!snap?<section className="adminPanel campPanel"><p className="muted">No portal data yet.</p></section>:<>
   <div className="rfqStats">
    <div><span>Gujarat installations</span><b>{IN(guj?.installations)}</b><small>{IN(guj?.applications)} applications · rank #{gujRank} of {states.length} states</small></div>
    <div><span>Gujarat capacity</span><b>{IN(guj?.capacity_mw,0)} MW</b><small>{india?`${pct((guj?.capacity_mw||0)/india.capacity_mw)} of India's ${IN(india.capacity_mw,0)} MW`:''}</small></div>
    <div><span>Pending applications</span><b>{IN(Math.max((guj?.applications||0)-(guj?.installations||0),0))}</b><small>Applied, not yet installed: the open market</small></div>
    <div><span>Subsidy released</span><b>{guj?cr(guj.subsidy_lakh):'—'}</b><small>{IN(guj?.households)} households covered</small></div>
   </div>

   <section className="adminPanel campPanel solarCampaign"><h2><MapPin size={18}/>Your campaign districts</h2>
    <div className="solarCampaignGrid">{CAMPAIGN.map(name=>{const d=districts.find(x=>x.name===name);const o=ours(name);return <div key={name} className="solarCard"><b>{name}</b>{d?<><div className="solarCardRow"><span>Installed</span><strong>{IN(d.installations)}</strong></div><div className="solarCardRow"><span>Pending applications</span><strong>{IN(d.pending)}</strong></div><div className="solarCardRow"><span>Conversion</span><strong>{pct(d.conversion)}</strong></div><div className="solarCardRow"><span>Capacity</span><strong>{IN(d.capacity_mw,1)} MW</strong></div></>:<p className="muted">Not in this snapshot.</p>}<div className="solarOurs"><span>NewIndia campaign</span>{o.leads} leads · {o.registered} registered · {o.commissioned} commissioned</div></div>})}</div>
    <p className="muted solarFoot">Together: {IN(campaignTotals.installations)} installed and {IN(campaignTotals.pending)} applications still pending ({IN(campaignTotals.capacity_mw,1)} MW installed). Taluka and village figures come from your own campaign data in Surya Ghar Campaign → Villages &amp; venues; the portal publishes nothing below district level.</p>
   </section>

   <section className="adminPanel campPanel"><h2><BarChart3 size={18}/>Gujarat districts ({shown.length})</h2>
    <div className="campToolbar solarFilters">
     <div className="rfqSearch"><Search size={17}/><input aria-label="Search districts" placeholder="Search district" value={q} onChange={e=>setQ(e.target.value)}/></div>
     <select aria-label="Sort by" value={sort} onChange={e=>setSort(e.target.value as any)}><option value="pending">Most pending applications</option><option value="installations">Most installations</option><option value="capacity_mw">Most capacity</option><option value="conversion">Best conversion</option><option value="name">District name</option></select>
     <label className="campCheck"><input type="checkbox" checked={onlyCampaign} onChange={e=>setOnlyCampaign(e.target.checked)}/>Campaign districts only</label>
    </div>
    <div className="adminTableWrap"><table className="adminTable solarTable"><thead><tr><th>District</th><th className="num">Applications</th><th>Installations</th><th>Pending applications</th><th className="num">Conversion</th><th className="num">Capacity (MW)</th><th className="num">Subsidy</th>{prevDate&&<th className="num">New installs</th>}</tr></thead><tbody>
     {shown.map(d=><tr key={d.name} className={CAMPAIGN.includes(d.name)?'solarHighlight':''}><td><b>{d.name}</b>{CAMPAIGN.includes(d.name)&&<span className="tableSub">Campaign district</span>}</td><td className="num">{IN(d.applications)}</td><td><div className="solarBarCell"><div className="campBar"><i style={{width:`${d.installations/maxInst*100}%`}}/></div><span>{IN(d.installations)}</span></div></td><td><div className="solarBarCell"><div className="campBar solarPending"><i style={{width:`${d.pending/maxPending*100}%`}}/></div><span>{IN(d.pending)}</span></div></td><td className="num">{pct(d.conversion)}</td><td className="num">{IN(d.capacity_mw,1)}</td><td className="num">{cr(d.subsidy_lakh)}</td>{prevDate&&<td className="num">{d.change?`+${IN(d.change.installations)}`:'—'}</td>}</tr>)}
    </tbody></table></div>
   </section>

   <div className="campOverview">
    <section className="adminPanel campPanel"><h2><Zap size={18}/>Gujarat DISCOMs</h2><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>DISCOM</th><th className="num">Installations</th><th className="num">Pending</th><th className="num">MW</th></tr></thead><tbody>{discoms.map(d=><tr key={d.name} className={/paschim/i.test(d.name)?'solarHighlight':''}><td>{d.name}{/paschim/i.test(d.name)&&<span className="tableSub">Your campaign area (PGVCL)</span>}</td><td className="num">{IN(d.installations)}</td><td className="num">{IN(d.pending)}</td><td className="num">{IN(d.capacity_mw,1)}</td></tr>)}</tbody></table></div></section>
    <section className="adminPanel campPanel"><h2><Activity size={18}/>All states by installations</h2><div className="adminTableWrap solarScroll"><table className="adminTable"><thead><tr><th>#</th><th>State / UT</th><th className="num">Installations</th><th className="num">MW</th><th className="num">Conversion</th></tr></thead><tbody>{states.map((s,i)=><tr key={s.name} className={s===guj?'solarHighlight':''}><td>{i+1}</td><td>{s.name}</td><td className="num">{IN(s.installations)}</td><td className="num">{IN(s.capacity_mw,0)}</td><td className="num">{s.applications?pct(s.installations/s.applications):'—'}</td></tr>)}</tbody></table></div></section>
   </div>
   <p className="muted solarFoot">Source: PM Surya Ghar national portal, <a href="https://pmsuryaghar.gov.in/#/state-ut-wise-progress" target="_blank" rel="noopener noreferrer">State/UT-wise Progress</a> (District Info, Discom Info), snapshot {fmtDate(snap)}. Pending applications = applications − installations. India total: {india?`${IN(india.installations)} installations, ${IN(india.capacity_mw,0)} MW`:'—'}.</p>
   </>}
  </>)}

  {tab==='energy'&&<EnergyTab live={live} err={liveErr} loading={liveLoading}/>}
 </div>
}

function EnergyTab({live,err,loading}:{live:any;err:string;loading:boolean}){
 if(!live&&loading)return <section className="adminPanel"><p className="emptyCell">Reading the Gujarat grid and today&apos;s sunlight…</p></section>
 if(!live)return <section className="adminPanel campPanel"><p className="muted">{err?`Could not load live data: ${err}`:'No live data yet.'}</p></section>
 const g=live.grid||{},r=live.rooftop||{}
 const sun=live.sun||[]
 const night=sun.length>0&&sun.every((x:any)=>!x.irradiance)
 // Units per kW today across the six places × installed MW = expected MWh for Gujarat's PM Surya Ghar rooftops.
 const perKw=sun.length?sun.reduce((a:number,x:any)=>a+(x.kwh_today_2_18||0)/2.18,0)/sun.length:0
 const todayMwh=Math.round(perKw*(r.installed_mw||0))
 const gridDown=!live.grid
 const demand=(live.history||[]).filter((h:any)=>h.metric==='gujarat_demand_mw').map((h:any)=>({t:Date.parse(h.observed_at),v:Number(h.value)}))
 const updated=g.observed_at?new Date(g.observed_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—'
 return <>
  {err&&<div className="themeMessage campError"><X size={16}/>Last refresh failed: {err}</div>}
  <div className="rfqStats">
   <div><span>Gujarat demand now</span><b>{g.demand_mw!=null?`${IN(g.demand_mw)} MW`:'—'}</b><small>Catered by the state grid · {updated}</small></div>
   <div><span>Grid frequency</span><b>{g.frequency_hz!=null?`${g.frequency_hz.toFixed(2)} Hz`:'—'}</b><small>Normal band 49.90–50.05 Hz</small></div>
   <div><span>Exchange price (DAM)</span><b>{g.dam_rate!=null?`₹${g.dam_rate.toFixed(2)}`:'—'}</b><small>Per unit, day-ahead market</small></div>
   <div><span>PM Surya Ghar rooftops now</span><b>{night?'Sun not up':r.estimated_output_mw!=null?`≈ ${IN(r.estimated_output_mw)} MW`:'—'}</b><small>{todayMwh?`≈ ${IN(todayMwh/1000,1)} GWh expected today from ${IN(r.installed_mw,0)} MW installed`:`Estimate from ${IN(r.installed_mw,0)} MW installed`}{night?'':` · ${r.avg_irradiance} W/m² now`}</small></div>
  </div>
  {gridDown&&<p className="campWarn">Live grid figures are unavailable right now: {live.grid_error||err||'SLDC Gujarat did not answer'}. Sunlight and rooftop estimates below are still live. The page tries again every 2 minutes.</p>}

  <section className="adminPanel campPanel"><h2><Gauge size={18}/>Gujarat demand, last 36 hours</h2>
   {demand.length>1?<DemandChart points={demand}/>:<p className="muted">The chart fills in as readings are collected: one every 5 minutes while this page is open (or on a schedule once set up). Come back after a few hours to see the day&apos;s curve.</p>}
  </section>

  <section className="adminPanel campPanel"><h2><Sun size={18}/>Sunlight right now</h2>
   {live.sun_error&&<p className="campWarn">Weather service did not answer: {live.sun_error}</p>}
   <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Place</th><th className="num">Sunlight (W/m²)</th><th className="num">Cloud cover</th><th className="num">Temperature</th><th className="num">Sunshine today</th><th className="num">2.18 kW system today</th></tr></thead><tbody>
    {(live.sun||[]).map((s:any,i:number)=><tr key={s.place} className={i<3?'solarHighlight':''}><td><b>{s.place}</b><span className="tableSub">{s.district}{i<3?' · campaign district':''}</span></td><td className="num">{s.irradiance?IN(s.irradiance):<span className="muted">Night</span>}</td><td className="num">{s.cloud_cover!=null?`${s.cloud_cover}%`:'—'}</td><td className="num">{s.temperature!=null?`${s.temperature} °C`:'—'}</td><td className="num">{s.sunshine_hours} h</td><td className="num"><b>≈ {s.kwh_today_2_18} kWh</b><span className="tableSub">expected today</span></td></tr>)}
   </tbody></table></div>
   {r.campaign_kwh_today_2_18!=null&&<p className="solarPitch">Today a 2.18 kW rooftop in your campaign districts makes about <b>{r.campaign_kwh_today_2_18} units</b>, roughly <b>{Math.round(r.campaign_kwh_today_2_18*30)} units a month</b> at this level of sunshine. Useful as a live example at village camps.</p>}
  </section>
  <p className="muted solarFoot">Sources: grid figures from the <a href="https://www.sldcguj.com/" target="_blank" rel="noopener noreferrer">SLDC Gujarat</a> home page; sunlight from <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>; installed rooftop capacity from the PM Surya Ghar portal snapshot of {r.installed_as_of?fmtDate(r.installed_as_of):'—'}. Rooftop output and kWh figures are estimates (sunlight × capacity × 75% system performance), not metered generation. Refreshes every 2 minutes.</p>
 </>
}

function DemandChart({points}:{points:{t:number;v:number}[]}){
 const W=960,H=240,P={l:56,r:16,t:16,b:28}
 const t0=points[0].t,t1=points[points.length-1].t
 const vs=points.map(p=>p.v),lo=Math.floor(Math.min(...vs)/500)*500,hi=Math.ceil(Math.max(...vs)/500)*500||lo+500
 const x=(t:number)=>P.l+(t1===t0?0:(t-t0)/(t1-t0))*(W-P.l-P.r)
 const y=(v:number)=>P.t+(1-(v-lo)/(hi-lo||1))*(H-P.t-P.b)
 const path=points.map((p,i)=>`${i?'L':'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
 const ticks=[lo,(lo+hi)/2,hi]
 const hours:number[]=[];for(let h=Math.ceil(t0/10_800_000)*10_800_000;h<=t1;h+=10_800_000)hours.push(h)
 const last=points[points.length-1]
 return <svg className="solarChart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gujarat demand from ${IN(Math.min(...vs))} to ${IN(Math.max(...vs))} MW; latest ${IN(last.v)} MW`}>
  {ticks.map(v=><g key={v}><line x1={P.l} x2={W-P.r} y1={y(v)} y2={y(v)} className="solarGrid"/><text x={P.l-8} y={y(v)+4} textAnchor="end" className="solarAxis">{IN(v)}</text></g>)}
  {hours.map(h=><text key={h} x={x(h)} y={H-8} textAnchor="middle" className="solarAxis">{new Date(h).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false})}</text>)}
  <path d={path} className="solarLine"/>
  <circle cx={x(last.t)} cy={y(last.v)} r={4} className="solarDot"/>
  <text x={x(last.t)-8} y={y(last.v)-10} textAnchor="end" className="solarLabel">{IN(last.v)} MW</text>
 </svg>
}

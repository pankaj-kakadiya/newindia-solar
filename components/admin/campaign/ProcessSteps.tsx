'use client'

import {useMemo,useState} from 'react'
import {ArrowRight,Check,CheckCircle2,ClipboardList,Printer,Undo2} from 'lucide-react'
import {INSTALL_STEPS,processProgress,stepChecks,stepDone,type InstallStep} from '../../../lib/installation-process'

const today=()=>new Date(Date.now()+5.5*3600_000).toISOString().slice(0,10)
const day=(v:any)=>v?new Date(`${String(v).slice(0,10)}T00:00:00+05:30`).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):''

/** Progress chip for tables: "Step 4 of 9" or "All 9 done". */
export function ProcessChip({lead}:{lead:any}){
 const p=processProgress(lead)
 if(lead.stage==='lost')return <span className="procChip lost">Lost</span>
 return <span className={`procChip ${p.current>9?'done':''}`} title={p.current>9?'All 9 steps done':INSTALL_STEPS[p.current-1].title}><i style={{width:`${p.done/9*100}%`}}/>{p.current>9?'All 9 done':`Step ${p.current} of 9`}</span>
}

/**
 * The household's 9 steps. Ticking a checklist item or writing a note saves at once for a saved lead;
 * "Mark step done" saves the step, moves the stage and fills the matching date.
 */
export function LeadProcessPanel({lead,canEdit,onChecks,onNote,onDone}:{lead:any;canEdit:boolean;onChecks:(step:string,checks:Record<string,boolean>)=>void;onNote:(step:string,note:string)=>void;onDone:(step:string,date:string|null)=>void}){
 const p=processProgress(lead)
 const [open,setOpen]=useState<string>(()=>INSTALL_STEPS[Math.min(p.current,9)-1].key)
 const [dates,setDates]=useState<Record<string,string>>({})
 return <div className="procSteps">
  <div className="procHead"><b>{p.current>9?'All 9 steps done':`Step ${p.current} of 9: ${INSTALL_STEPS[p.current-1].title}`}</b><span>{p.done}/9 done</span></div>
  <div className="procBar"><i style={{width:`${p.done/9*100}%`}}/></div>
  <ol>
   {INSTALL_STEPS.map(s=>{
    const done=stepDone(lead,s),rec=lead.process?.[s.key]||{},checks=rec.checks||{},isOpen=open===s.key,isCurrent=s.n===p.current
    const ticked=stepChecks(lead,s)
    return <li key={s.key} className={`${done?'done':''} ${isCurrent?'current':''} ${isOpen?'open':''}`}>
     <button type="button" className="procStepHead" aria-expanded={isOpen} onClick={()=>setOpen(isOpen?'':s.key)}>
      <span className="procNum">{done?<Check size={14}/>:s.n}</span>
      <span className="procTitle"><b>{s.title}</b><small lang="gu">{s.gu}</small></span>
      <span className="procMeta">{done?(rec.done_at?day(rec.done_at):'Done'):`${ticked}/${s.checklist.length}`}</span>
     </button>
     {isOpen&&<div className="procBody">
      <p className="procSummary">{s.summary} <span className="muted">Owner: {s.owner}</span></p>
      <div className="procChecklist">{s.checklist.map(([k,label])=><label key={k} className="campCheck"><input type="checkbox" disabled={!canEdit} checked={Boolean(checks[k])} onChange={e=>onChecks(s.key,{...checks,[k]:e.target.checked})}/>{label}</label>)}</div>
      <label className="rfqWideLabel"><span>Step note</span><input disabled={!canEdit} defaultValue={rec.note||''} placeholder="Reference no., who to call, what is pending…" onBlur={e=>{if((rec.note||'')!==e.target.value)onNote(s.key,e.target.value)}}/></label>
      {canEdit&&<div className="procActions">{done?<><span className="campHint ok"><CheckCircle2 size={15}/>Done{rec.done_at?` on ${day(rec.done_at)}`:' (from the lead stage)'}</span><button type="button" className="adminBtn ghost" onClick={()=>onDone(s.key,null)}><Undo2 size={15}/>Mark not done</button></>:<>
       <label className="procDate"><span>Done on</span><input type="date" value={dates[s.key]||today()} max={today()} onChange={e=>setDates(d=>({...d,[s.key]:e.target.value}))}/></label>
       <button type="button" className="adminBtn" onClick={()=>{onDone(s.key,dates[s.key]||today());const next=INSTALL_STEPS[s.n];if(next)setOpen(next.key)}}><Check size={15}/>Mark step {s.n} done</button>
       {ticked<s.checklist.length&&<small className="muted">{s.checklist.length-ticked} checklist item{s.checklist.length-ticked===1?'':'s'} not ticked</small>}
      </>}</div>}
     </div>}
    </li>})}
  </ol>
 </div>
}

/** Board of where every household is in the 9 steps, plus the printable step guide for the team. */
export function ProcessTab({leads,openLead,campCode}:{leads:any[];openLead:(l:any)=>void;campCode:(id:string)=>string}){
 const [step,setStep]=useState<number|'all'>('all'),[showGuide,setShowGuide]=useState(false)
 const active=useMemo(()=>leads.filter(l=>l.stage!=='lost').map(l=>({l,p:processProgress(l)})),[leads])
 const counts=INSTALL_STEPS.map(s=>active.filter(x=>x.p.current===s.n).length)
 const finished=active.filter(x=>x.p.current>9).length
 const list=active.filter(x=>step==='all'||x.p.current===step).sort((a,b)=>a.p.current-b.p.current||String(a.l.full_name).localeCompare(String(b.l.full_name)))
 return <>
  <section className="campToolbar procToolbar"><p className="muted campToolbarNote">Where each household is in the 9 installation steps. Open a household to tick its checklist and mark steps done.</p><div className="campToolbarActions"><button className="adminBtn ghost" onClick={()=>setShowGuide(g=>!g)}><ClipboardList size={16}/>{showGuide?'Hide step guide':'Step guide'}</button>{showGuide&&<button className="adminBtn ghost" onClick={()=>window.print()}><Printer size={16}/>Print guide</button>}</div></section>

  {showGuide&&<section className="adminPanel campPanel procGuide"><h2><ClipboardList size={18}/>Installation process: 9 steps</h2><p className="muted">PM Surya Ghar + Gujarat state top-up (GR dated 22-10-2026), from the first visit to the subsidy credit.</p>
   <div className="procGuideGrid">{INSTALL_STEPS.map((s:InstallStep)=><article key={s.key}><header><span className="procNum">{s.n}</span><div><b>{s.title}</b><small lang="gu">{s.gu}</small></div></header><p>{s.summary}</p><small className="muted">Owner: {s.owner}</small><ul>{s.checklist.map(([k,label])=><li key={k}>{label}</li>)}</ul></article>)}</div>
  </section>}

  <section className="procBoard" aria-label="Households by step">
   <button className={step==='all'?'active':''} onClick={()=>setStep('all')}><span>All</span><b>{active.length}</b><small>active households</small></button>
   {INSTALL_STEPS.map((s,i)=><button key={s.key} className={step===s.n?'active':''} onClick={()=>setStep(s.n)}><span>Step {s.n}</span><b>{counts[i]}</b><small>{s.title}</small></button>)}
   <div className="procFinished"><span>All 9 done</span><b>{finished}</b><small>subsidy and handover complete</small></div>
  </section>

  <section className="adminPanel rfqTablePanel"><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Household</th><th>Village</th><th>Now at</th><th>Progress</th><th>Checklist</th><th></th></tr></thead><tbody>
   {list.length?list.map(({l,p})=>{const s=INSTALL_STEPS[p.current-1];return <tr key={l.id}>
    <td><button className="rfqOpportunity" onClick={()=>openLead(l)}><b>{l.full_name}</b><span>{l.mobile||'No mobile'}</span></button></td>
    <td>{l.village||'—'}<span className="tableSub">{campCode(l.camp_id)} · {l.district}</span></td>
    <td>{s?<><b>{s.n}. {s.title}</b><span className="tableSub">{s.owner}</span></>:<b>All 9 done</b>}</td>
    <td><ProcessChip lead={l}/></td>
    <td>{s?`${stepChecks(l,s)}/${s.checklist.length}`:'—'}</td>
    <td className="campRowActions"><button className="iconBtn" onClick={()=>openLead(l)} aria-label={`Open ${l.full_name}`}><ArrowRight size={16}/></button></td>
   </tr>}):<tr><td colSpan={6} className="emptyCell">{active.length?'No households at this step.':'No households yet.'}</td></tr>}
  </tbody></table></div></section>
 </>
}


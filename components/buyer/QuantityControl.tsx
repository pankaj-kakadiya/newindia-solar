'use client'
import {useId,useState} from 'react'
import {Minus,Plus} from 'lucide-react'

type Props={value:number;min?:number;max?:number;step?:number;label:string;className?:string;onChange:(value:number)=>void}
export default function QuantityControl({value,min=1,max=1e9,step=1,label,className='',onChange}:Props){
  const [draft,setDraft]=useState<string|null>(null)
  const errorId=useId()
  const valid=(n:number)=>Number.isFinite(n)&&n>=min&&n<=max&&Math.abs(n/step-Math.round(n/step))<=1e-6
  const invalid=draft!==null&&(draft.trim()===''||!valid(Number(draft)))
  const change=(direction:number)=>{
    const next=Number((value+direction*step).toFixed(6))
    if(valid(next)){setDraft(null);onChange(next)}
  }
  return <div className="buyerQuantityField"><div className={`buyerQuantityControl ${className}`}>
    <button type="button" aria-label={`Decrease ${label}`} disabled={!valid(Number((value-step).toFixed(6)))} onClick={()=>change(-1)}><Minus size={14}/></button>
    <input type="number" inputMode={step%1===0?'numeric':'decimal'} aria-label={label} aria-invalid={invalid} aria-describedby={invalid?errorId:undefined} min={min} max={max} step={step} value={draft??String(value)} onFocus={e=>e.currentTarget.select()} onChange={e=>{const text=e.target.value;setDraft(text);if(text.trim()!==''&&valid(Number(text)))onChange(Number(text))}} onBlur={()=>setDraft(null)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}if(e.key==='Escape'){setDraft(null);e.currentTarget.blur()}}}/>
    <button type="button" aria-label={`Increase ${label}`} disabled={!valid(Number((value+step).toFixed(6)))} onClick={()=>change(1)}><Plus size={14}/></button>
  </div>{invalid&&<small id={errorId} role="status">Enter at least {min}, in increments of {step}{max<1e9?`, up to ${max}`:''}. Invalid entry resets when you leave this field.</small>}</div>
}

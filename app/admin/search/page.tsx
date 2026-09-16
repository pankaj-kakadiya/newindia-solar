'use client'

import Link from 'next/link'
import {useEffect,useMemo,useRef,useState} from 'react'
import {Boxes,Building2,ClipboardList,Copy,Factory,FileText,IndianRupee,Package,RefreshCw,Search,ShoppingCart,Truck,Users} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

type SearchResult={
 result_type:string;result_id:string;module_key:string;title:string;subtitle:string|null;identifier:string|null;status:string|null;amount:number|null;href:string;updated_at:string|null;rank:number
}

const labels:Record<string,string>={order:'Order',customer:'Customer',product:'Product',component:'Component',supplier:'Supplier',purchase_order:'Purchase Order',grn:'GRN',invoice:'Invoice',rfq:'RFQ',production_job:'Production Job'}
const moduleLabels:Record<string,string>={orders:'Orders',customers:'Customers',products:'Products',components:'Components',purchasing:'Purchasing',finance:'Finance',rfqs:'RFQs',production:'Production'}
const typeOrder=['order','customer','product','component','rfq','invoice','purchase_order','grn','supplier','production_job']
const money=(n:number|null)=>n==null?'':`₹${Number(n).toLocaleString('en-IN',{maximumFractionDigits:2})}`
const fmt=(v:string|null)=>v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'

function ResultIcon({type}:{type:string}){
 const props={size:18,strokeWidth:1.9}
 if(type==='order')return <ShoppingCart {...props}/>
 if(type==='customer')return <Users {...props}/>
 if(type==='product')return <Package {...props}/>
 if(type==='component')return <Boxes {...props}/>
 if(type==='supplier')return <Building2 {...props}/>
 if(type==='purchase_order')return <ClipboardList {...props}/>
 if(type==='grn')return <Truck {...props}/>
 if(type==='invoice')return <IndianRupee {...props}/>
 if(type==='production_job')return <Factory {...props}/>
 return <FileText {...props}/>
}

export default function GlobalSearchPage(){
 const [query,setQuery]=useState(''),[results,setResults]=useState<SearchResult[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState(''),[type,setType]=useState('all')
 const [recent,setRecent]=useState<SearchResult[]>([])
 const inputRef=useRef<HTMLInputElement>(null)

 useEffect(()=>{inputRef.current?.focus();try{const raw=localStorage.getItem('nis-admin-global-recent');if(raw)setRecent(JSON.parse(raw).slice(0,8))}catch{}},[])
 useEffect(()=>{
  const q=query.trim();setMessage('')
  if(q.length<2){setResults([]);setLoading(false);return}
  let active=true;const timer=window.setTimeout(async()=>{setLoading(true);const {data,error}=await supabase.rpc('admin_global_search',{p_query:q,p_limit:80});if(!active)return;setLoading(false);if(error){setMessage(error.message);setResults([]);return}setResults((data||[]) as SearchResult[])},180)
  return()=>{active=false;window.clearTimeout(timer)}
 },[query])

 const filtered=useMemo(()=>type==='all'?results:results.filter(r=>r.result_type===type),[results,type])
 const types=useMemo(()=>typeOrder.filter(t=>results.some(r=>r.result_type===t)),[results])
 const grouped=useMemo(()=>{const m=new Map<string,SearchResult[]>();for(const r of filtered){const arr=m.get(r.result_type)||[];arr.push(r);m.set(r.result_type,arr)}return m},[filtered])
 const exact=results.filter(r=>r.rank>=120).length
 const modules=new Set(results.map(r=>r.module_key)).size

 function remember(r:SearchResult){try{const next=[r,...recent.filter(x=>x.result_id!==r.result_id||x.result_type!==r.result_type)].slice(0,8);setRecent(next);localStorage.setItem('nis-admin-global-recent',JSON.stringify(next))}catch{}}
 async function copyIdentifier(r:SearchResult){if(!r.identifier)return;await navigator.clipboard.writeText(r.identifier)}
 function clear(){setQuery('');setResults([]);setType('all');inputRef.current?.focus()}

 return <div className="globalSearchV2">
  <div className="globalSearchHero"><div><span className="adminEyebrow">GLOBAL COMMAND CENTER</span><h1>Search Everything</h1><p>Find orders, customers, GSTINs, phone numbers, SKUs, components, suppliers, POs, GRNs, invoices, RFQs and production jobs from one secure search.</p></div><button onClick={()=>query.trim().length>=2&&setQuery(q=>q+' ')} className="globalRefresh"><RefreshCw size={16}/>Refresh</button></div>

  <section className="globalSearchBox"><Search size={22}/><input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search order no., customer, GSTIN, phone, SKU, PO, GRN, invoice, RFQ…"/><kbd>⌘ K</kbd>{query&&<button onClick={clear}>Clear</button>}</section>
  <div className="globalSearchHints"><span>Examples</span><button onClick={()=>setQuery('NIS')}>NIS order</button><button onClick={()=>setQuery('PO-')}>Purchase order</button><button onClick={()=>setQuery('SPD')}>Component / SKU</button><button onClick={()=>setQuery('Gujarat')}>Customer / invoice</button></div>

  {message&&<div className="globalSearchMessage">{message}</div>}

  {query.trim().length>=2&&<div className="globalSearchStats"><article><small>Results</small><strong>{loading?'…':results.length}</strong></article><article><small>Exact / Strong matches</small><strong>{exact}</strong></article><article><small>Modules matched</small><strong>{modules}</strong></article><article><small>Security</small><strong>Role-filtered</strong></article></div>}

  {results.length>0&&<div className="globalTypeFilters"><button className={type==='all'?'active':''} onClick={()=>setType('all')}>All <b>{results.length}</b></button>{types.map(t=><button key={t} className={type===t?'active':''} onClick={()=>setType(t)}>{labels[t]||t} <b>{results.filter(r=>r.result_type===t).length}</b></button>)}</div>}

  {loading?<div className="globalSearchEmpty">Searching permitted ERP records…</div>:query.trim().length>=2&&!filtered.length?<div className="globalSearchEmpty"><Search size={28}/><h3>No records found</h3><p>Try an order number, GSTIN, customer/company name, phone number, SKU, PO, GRN, invoice or RFQ reference.</p></div>:null}

  {!loading&&filtered.length>0&&<div className="globalSearchGroups">{typeOrder.filter(t=>grouped.has(t)).map(t=><section key={t} className="globalResultGroup"><div className="globalGroupHead"><h2>{labels[t]||t}</h2><span>{grouped.get(t)?.length||0}</span></div><div className="globalResultRows">{grouped.get(t)?.map(r=><article key={`${r.result_type}-${r.result_id}`} className="globalResult"><div className={`globalResultIcon type-${r.result_type}`}><ResultIcon type={r.result_type}/></div><div className="globalResultMain"><div className="globalResultTop"><h3>{r.title}</h3>{r.identifier&&<code>{r.identifier}</code>}</div>{r.subtitle&&<p>{r.subtitle}</p>}<div className="globalResultMeta"><span>{moduleLabels[r.module_key]||r.module_key}</span>{r.status&&<span>{r.status.replaceAll('_',' ')}</span>}{r.amount!=null&&<span>{money(r.amount)}</span>}<span>{fmt(r.updated_at)}</span></div></div><div className="globalResultActions">{r.identifier&&<button title="Copy reference" onClick={()=>copyIdentifier(r)}><Copy size={15}/></button>}<Link href={r.href} onClick={()=>remember(r)}>Open</Link></div></article>)}</div></section>)}</div>}

  {!query.trim()&&<div className="globalSearchStart"><section><h2>Search coverage</h2><div className="globalCoverage"><span><ShoppingCart/>Orders</span><span><Users/>Customers</span><span><Package/>Products & SKUs</span><span><Boxes/>Components</span><span><Building2/>Suppliers</span><span><ClipboardList/>POs</span><span><Truck/>GRNs</span><span><IndianRupee/>Invoices</span><span><FileText/>RFQs</span><span><Factory/>Production</span></div></section>{recent.length>0&&<section><h2>Recently opened</h2><div className="globalRecent">{recent.map(r=><Link href={r.href} onClick={()=>remember(r)} key={`${r.result_type}-${r.result_id}`}><span><ResultIcon type={r.result_type}/></span><div><b>{r.title}</b><small>{r.identifier||labels[r.result_type]}</small></div></Link>)}</div></section>}</div>}
 </div>
}

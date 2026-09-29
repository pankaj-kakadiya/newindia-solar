'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {fileDownload} from '../../lib/builder-buyer'
import {canAdmin} from '../../lib/adminAccess'

export function BuilderRequestDetails({snapshot}:{snapshot:any}){
 if(!snapshot||typeof snapshot!=='object')return null
 return <section className="cfgPanel"><h3>{String(snapshot.product||'Builder')} component request</h3><p>Customer-supplied selection for quotation review. Confirm availability, pricing and engineering before creating a production BOM.</p><p>Catalogue: {snapshot.source==='published'?'Published builder':'Visual sample'}</p><pre style={{whiteSpace:'pre-wrap'}}>{typeof snapshot.summary==='string'?snapshot.summary:'Component details available in the request download.'}</pre><button type="button" onClick={()=>fileDownload(JSON.stringify(snapshot,null,2),'builder-request.json','application/json')}>Download selected components</button></section>
}
export default function BuilderRequests(){
 const [rows,setRows]=useState<any[]>([]),[message,setMessage]=useState(''),[selected,setSelected]=useState<any>(null),[allowed,setAllowed]=useState(false),[loading,setLoading]=useState(true)
 async function load(){setLoading(true);try{const a=await supabase.rpc('get_my_admin_access');const permitted=!a.error&&canAdmin(a.data,'rfqs','view');setAllowed(permitted);if(!permitted){setMessage('RFQ view permission is required to review customer requests.');return}const r=await supabase.from('bulk_rfqs').select('id,name,company_name,product_interest,quantity_text,status,created_at,builder_snapshot').eq('lead_source','builder').order('created_at',{ascending:false}).limit(300);if(r.error)throw r.error;setRows(r.data||[]);setMessage('')}catch(e){setMessage(String((e as any)?.message||e))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 return <section className="cfgPanel"><h2>Submitted builder quotation requests</h2><p>Buyers send these after submitting their contact details. Device-only drafts appear here after submission.</p><button onClick={load} disabled={loading}>Refresh requests</button>{allowed&&<Link href="/admin/rfqs"> Open RFQ sales pipeline</Link>}{message&&<p role="status">{message}</p>}{allowed&&<table className="adminTable"><thead><tr><th>Customer</th><th>Builder</th><th>Quantity</th><th>Status</th><th>Request</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.company_name||r.name}</td><td>{r.product_interest}</td><td>{r.quantity_text||'Not specified'}</td><td>{r.status}</td><td><button onClick={()=>setSelected(r)}>View components</button></td></tr>)}</tbody></table>}{!loading&&allowed&&!rows.length&&<p>No submitted builder requests yet.</p>}{selected&&<><button onClick={()=>setSelected(null)}>Close request</button><BuilderRequestDetails snapshot={selected.builder_snapshot}/></>}</section>
}

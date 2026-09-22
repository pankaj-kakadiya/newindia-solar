'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {loadBuilderCatalogue} from '../../lib/builder-catalogue'
import {defaults,selectionIssues} from '../../lib/builder-buyer'
import {canAdmin} from '../../lib/adminAccess'

export default function BuilderPublication(){
 const [rows,setRows]=useState<any[]>([]),[checks,setChecks]=useState<Record<string,string[]>>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(''),[allowed,setAllowed]=useState(false)
 async function load(){const r=await supabase.from('configurator_templates').select('id,name,slug,type,is_active').in('slug',['custom-acdb','custom-dcdb']).order('name');if(r.error)setMessage(r.error.message);else setRows(r.data||[])}
 useEffect(()=>{void load();void supabase.rpc('get_my_admin_access').then(({data,error})=>setAllowed(!error&&canAdmin(data,'configurator','edit')))},[])
 async function inspect(row:any,publish=false){setBusy(row.id);setMessage('');try{
  const catalog=await loadBuilderCatalogue(supabase,row.slug,AbortSignal.timeout(15000),true)
  const issues=selectionIssues(catalog,defaults(catalog),row.type==='acdb'?'ACDB':'DCDB')
  if(!catalog.groups.length)issues.push('Add buyer option groups first.')
  // Inspect every offered option, not only the default combination.
  for(const group of catalog.groups)for(const value of group.configurator_option_values){const selection={...defaults(catalog),[group.option_key]:[{id:value.id,qty:Math.max(1,Number(group.min_quantity)||1)}]};for(const issue of selectionIssues(catalog,selection,row.type==='acdb'?'ACDB':'DCDB'))if(!issues.includes(issue))issues.push(issue)}
  setChecks(current=>({...current,[row.id]:issues}))
  if(issues.length){setMessage('Complete the listed option, image, default and slot settings before publishing.');return}
  if(publish){const result=await supabase.from('configurator_templates').update({is_active:true}).eq('id',row.id).select('id').single();if(result.error)throw result.error;await load();setMessage(`${row.name} published for quotation requests.`)}else setMessage('Catalogue check passed. Publishing enables quotation requests; engineering review is still required.')
 }catch(e){setMessage(e instanceof Error?e.message:String((e as any)?.message||e))}finally{setBusy('')}}
 async function unpublish(row:any){setBusy(row.id);try{const r=await supabase.from('configurator_templates').update({is_active:false}).eq('id',row.id).select('id').single();if(r.error)throw r.error;await load();setMessage(`${row.name} unpublished.`)}catch(e){setMessage(String((e as any)?.message||e))}finally{setBusy('')}}
 return <section className="cfgPanel"><h2>Buyer builder publication</h2><p>Link options, choose defaults, map each component to an enclosure slot, then check and publish. Publishing does not approve an electrical design or enable automatic checkout.</p>{message&&<p role="status">{message}</p>}<div className="cfgTemplateGrid">{rows.map(row=><article key={row.id}><div><h3>{row.name}</h3><p>{row.is_active?'Published':'Draft — buyers see a quotation link'}</p>{checks[row.id]&&<ul>{checks[row.id].map(issue=><li key={issue}>{issue}</li>)}</ul>}</div><footer><button disabled={!!busy} onClick={()=>inspect(row)}>Check catalogue</button>{allowed&&(row.is_active?<button disabled={!!busy} onClick={()=>unpublish(row)}>Unpublish</button>:<button disabled={!!busy} onClick={()=>inspect(row,true)}>Check & publish</button>)}<Link href={`/customize/${row.type}`} target="_blank">View buyer page</Link></footer></article>)}</div><p><Link href="/admin/configurator/options">1. Options & defaults</Link> · <Link href="/admin/configurator/slot-mapping">2. Preview slots</Link> · <Link href="/admin/configurator/rules">3. Compatibility rules</Link> · <Link href="/admin/configurator/combo">Combo products</Link> · <Link href="/admin/rfqs">Customer quotation requests</Link></p></section>
}

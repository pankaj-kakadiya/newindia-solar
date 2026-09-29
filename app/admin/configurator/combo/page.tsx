'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {supabase} from '../../../../lib/supabase'
import {COMBO_PRODUCT_SELECT,choices} from '../../../../lib/combo-catalogue'
import {publishedProducts} from '../../../../lib/catalogue'
import {canAdmin} from '../../../../lib/adminAccess'
export default function ComboAdmin(){
 const [rows,setRows]=useState<any[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(''),[allowed,setAllowed]=useState(false)
 async function load(){const r=await supabase.from('products').select(COMBO_PRODUCT_SELECT).order('name');if(r.error)setMessage(r.error.message);else setRows(r.data||[])}
 useEffect(()=>{void load();void supabase.rpc('get_my_admin_access').then(({data,error})=>setAllowed(!error&&canAdmin(data,'products','edit')))},[])
 async function save(row:any,side:string){setBusy(row.id);setMessage('');try{
  const fresh=await supabase.from('products').select('specifications').eq('id',row.id).single();if(fresh.error)throw fresh.error
  const specifications={...(fresh.data.specifications||{}),combo_enabled:side!=='disabled',combo_side:['acdb','dcdb'].includes(side)?side:null}
  const result=await supabase.from('products').update({specifications}).eq('id',row.id).select('id').single();if(result.error)throw result.error;await load();setMessage('Combo setting saved. Buyer selections are checked again against this setting before adding to cart.')
 }catch(e){setMessage(String((e as any)?.message||e))}finally{setBusy('')}}
 const published=publishedProducts(rows),ac=choices(published,'acdb'),dc=choices(published,'dcdb')
 return <div className="cfgAdmin"><div className="adminPageHead"><div><h1>Combo Products</h1><p>Combo pairs one finished ACDB with one finished DCDB. Products, prices, GST, minimum quantities and stock are managed in Products. Both lines follow the standard order flow.</p></div><Link href="/combo" target="_blank">Open buyer combo</Link></div>{message&&<p role="status">{message}</p>}<p>{ac.length} eligible ACDB options · {dc.length} eligible DCDB options</p><button disabled={!!busy} onClick={load}>Refresh catalogue</button><section className="cfgPanel"><table className="adminTable"><thead><tr><th>Product</th><th>Combo assignment</th><th>Buyer availability</th><th>Catalogue</th></tr></thead><tbody>{rows.filter(r=>r.product_type==='standard').map(row=>{const eligible=[...ac,...dc].filter(p=>p.product.id===row.id);return <tr key={row.id}><td>{row.name}</td><td><select aria-label={`Combo assignment for ${row.name}`} disabled={!allowed||!!busy} value={row.specifications?.combo_enabled===false?'disabled':row.specifications?.combo_side||'auto'} onChange={e=>save(row,e.target.value)}><option value="auto">Use category / product name</option><option value="acdb">ACDB side</option><option value="dcdb">DCDB side</option><option value="disabled">Exclude from combo</option></select></td><td>{eligible.length?`${eligible.length} available option(s)`:'Unavailable — check assignment, publication, active variants, GST, price and stock'}</td><td><Link href="/admin/products">Manage products</Link></td></tr>})}</tbody></table></section></div>
}

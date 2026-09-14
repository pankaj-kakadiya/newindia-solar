'use client'

import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import {Check,CheckCircle2,Download,Image as ImageIcon,Loader2,Minus,PackagePlus,Plus,RotateCcw,Save,Settings2,ShieldCheck,ZoomIn,ZoomOut} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useCart,VisualSelection} from './CartProvider'
import StoreHeader from './StoreHeader'
import StoreFooter from './StoreFooter'

type Selected={id:string;qty:number}
const money=(n:number)=>`₹${Math.round(n).toLocaleString('en-IN')}`

export default function ConfiguratorBuilder({slug,title,code}:{slug:'custom-acdb'|'custom-dcdb';title:string;code:'ACDB'|'DCDB'}){
  const {add}=useCart()
  const [template,setTemplate]=useState<any>(null)
  const [groups,setGroups]=useState<any[]>([])
  const [components,setComponents]=useState<Record<string,any>>({})
  const [enclosures,setEnclosures]=useState<Record<string,any>>({})
  const [slots,setSlots]=useState<any[]>([])
  const [sel,setSel]=useState<Record<string,Selected[]>>({})
  const [loading,setLoading]=useState(true)
  const [zoom,setZoom]=useState(1)
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)

  useEffect(()=>{(async()=>{
    setLoading(true)
    const {data:t}=await supabase.from('configurator_templates').select('*').eq('slug',slug).eq('is_active',true).single()
    if(!t){setLoading(false);return}
    setTemplate(t)
    const {data:o}=await supabase.from('configurator_options').select('id,option_key,label,option_type,sort_order,required,allow_quantity,min_quantity,max_quantity,settings,configurator_option_values(id,label,value,price_adjustment,component_id,enclosure_id,metadata,sort_order,is_active)').eq('template_id',t.id).order('sort_order')
    const gs=(o||[]).map((g:any)=>({...g,configurator_option_values:(g.configurator_option_values||[]).filter((v:any)=>v.is_active).sort((a:any,b:any)=>(a.sort_order||0)-(b.sort_order||0))}))
    setGroups(gs)
    const cids=[...new Set(gs.flatMap((g:any)=>g.configurator_option_values.map((v:any)=>v.component_id).filter(Boolean)))] as string[]
    const eids=[...new Set(gs.flatMap((g:any)=>g.configurator_option_values.map((v:any)=>v.enclosure_id).filter(Boolean)))] as string[]
    const [cr,er,sr]=await Promise.all([
      cids.length?supabase.from('components').select('id,category,name,model,sku,selling_price,gst_rate,stock_qty,unit,image_url,visual_role,visual_settings,specifications,brands(name)').in('id',cids):Promise.resolve({data:[]} as any),
      eids.length?supabase.from('enclosures').select('id,name,sku,dimensions_mm,material,ip_rating,module_capacity,selling_price,gst_rate,stock_qty,image_url,inside_image_url,closed_image_url,visual_settings,supported_types,specifications').in('id',eids):Promise.resolve({data:[]} as any),
      supabase.from('configurator_visual_slots').select('*').eq('template_id',t.id).eq('is_active',true).order('slot_index')
    ])
    setComponents(Object.fromEntries((cr.data||[]).map((x:any)=>[x.id,x])))
    setEnclosures(Object.fromEntries((er.data||[]).map((x:any)=>[x.id,x])))
    setSlots(sr.data||[])
    setLoading(false)
  })()},[slug])

  const valueById=useMemo(()=>Object.fromEntries(groups.flatMap((g:any)=>(g.configurator_option_values||[]).map((v:any)=>[v.id,{...v,group:g}]))),[groups])
  const flatSelections=useMemo(()=>Object.entries(sel).flatMap(([option_key,list])=>list.map(s=>({option_key,value_id:s.id,quantity:s.qty}))),[sel])
  const selectedEnclosureId=useMemo(()=>{const s=sel.enclosure?.[0];return s?valueById[s.id]?.enclosure_id||null:null},[sel,valueById])
  const selectedEnclosure=selectedEnclosureId?enclosures[selectedEnclosureId]:null
  const activeSlots=useMemo(()=>slots.filter((s:any)=>!selectedEnclosureId||s.enclosure_id===selectedEnclosureId),[slots,selectedEnclosureId])

  const pricing=useMemo(()=>{
    let componentsSubtotal=0
    for(const item of flatSelections){const v=valueById[item.value_id];if(!v)continue;const linked=v.component_id?components[v.component_id]:v.enclosure_id?enclosures[v.enclosure_id]:null;componentsSubtotal+=(Number(v.price_adjustment||0)+Number(linked?.selling_price||0))*item.quantity}
    const assembly=Number(template?.base_assembly_charge||0)
    const subtotal=componentsSubtotal+assembly
    const gstRate=Number(template?.default_gst_rate||18)
    const gst=Math.round(subtotal*gstRate)/100
    return {componentsSubtotal,assembly,subtotal,gstRate,gst,final:subtotal+gst}
  },[flatSelections,valueById,components,enclosures,template])

  const requiredGroups=groups.filter((g:any)=>g.required)
  const completedRequired=requiredGroups.filter((g:any)=>(sel[g.option_key]||[]).length>0).length
  const ready=requiredGroups.length>0&&completedRequired===requiredGroups.length

  const layers=useMemo(()=>{
    const out:any[]=[]
    for(const g of groups){for(const chosen of sel[g.option_key]||[]){const v=valueById[chosen.id];if(!v?.component_id)continue;const comp=components[v.component_id];if(!comp?.image_url)continue;const candidates=activeSlots.filter((s:any)=>s.option_key===g.option_key).sort((a:any,b:any)=>a.slot_index-b.slot_index)
      for(let i=0;i<Math.min(chosen.qty,candidates.length);i++)out.push({key:`${chosen.id}-${i}`,component:comp,slot:candidates[i]})
    }}
    return out.sort((a,b)=>a.slot.z_index-b.slot.z_index)
  },[groups,sel,valueById,components,activeSlots])

  function choose(g:any,v:any){
    const multi=g.option_type==='multi'||['extras','indicator','busbar'].includes(g.option_key)
    setSel(s=>{const current=s[g.option_key]||[];const exists=current.find(x=>x.id===v.id);if(multi){return {...s,[g.option_key]:exists?current.filter(x=>x.id!==v.id):[...current,{id:v.id,qty:Math.max(1,Number(g.min_quantity||1))}]}}return {...s,[g.option_key]:[{id:v.id,qty:Math.max(1,Number(g.min_quantity||1))}]}})
  }
  function changeQty(g:any,v:any,delta:number){setSel(s=>{const current=s[g.option_key]||[];return {...s,[g.option_key]:current.map(x=>x.id===v.id?{...x,qty:Math.max(Number(g.min_quantity||1),Math.min(Number(g.max_quantity||1),x.qty+delta))}:x)}})}
  function reset(){setSel({});setZoom(1);setMessage('Configuration reset.')}

  function previewSnapshot(){return {version:2,type:code.toLowerCase(),template_id:template?.id,enclosure_id:selectedEnclosureId,selections:flatSelections,layers:layers.map(l=>({component_id:l.component.id,component_name:l.component.name,image_url:l.component.image_url,slot_key:l.slot.slot_key,slot_index:l.slot.slot_index,x_pct:l.slot.x_pct,y_pct:l.slot.y_pct,width_pct:l.slot.width_pct,height_pct:l.slot.height_pct,z_index:l.slot.z_index}))}}
  function labelSummary(){return groups.flatMap((g:any)=>{const picks=sel[g.option_key]||[];if(!picks.length)return [];return [`${g.label}: ${picks.map(p=>`${valueById[p.id]?.label||''}${p.qty>1?` ×${p.qty}`:''}`).join(', ')}`]}).join(' • ')}
  function addBuild(){if(!ready||!template)return;const visualSelections:VisualSelection[]=flatSelections.map(s=>({value_id:s.value_id,quantity:s.quantity,option_key:s.option_key}));add({id:`${code.toLowerCase()}-${Date.now()}`,kind:'custom',name:`Custom ${code}`,variant:labelSummary(),price:pricing.subtotal,qty:1,customType:code.toLowerCase() as 'acdb'|'dcdb',templateId:template.id,selectedValueIds:[...new Set(flatSelections.map(s=>s.value_id))],visualSelections,visualPreview:previewSnapshot()});setMessage(`Custom ${code} added to cart.`)}
  async function saveBuild(){if(!ready||!template)return;setSaving(true);setMessage('');const {data:{user}}=await supabase.auth.getUser();if(!user){setSaving(false);setMessage('Sign in first to save this configuration.');return}const {data,error}=await supabase.rpc('save_visual_configuration',{p_template_id:template.id,p_config_name:`Custom ${code}`,p_selections:flatSelections.map(s=>({value_id:s.value_id,quantity:s.quantity})),p_preview_snapshot:previewSnapshot()});setSaving(false);if(error){setMessage(error.message);return}setMessage(`Saved ${(data as any)?.configuration_code||'configuration'} successfully.`)}

  if(loading)return <><StoreHeader/><main className="container cvLoading"><Loader2 className="spin"/><h2>Loading {code} visual builder…</h2></main></>
  if(!template)return <><StoreHeader/><main className="container emptyCatalogue"><h1>Configurator unavailable.</h1><Link className="btn btnPrimary" href="/shop">Browse Products</Link></main></>

  return <><StoreHeader/><main className="container cvPage">
    <div className="cvBreadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/customize">Customize</Link><span>›</span><b>{code}</b></div>
    <div className="cvHead"><div><span className="eyebrow darkEye">VISUAL {code} CONFIGURATOR</span><h1>{title}</h1><p>Choose enclosure, protection, SPD, terminals and wiring. The BOM, price and visual preview update together.</p></div><div><button onClick={reset}><RotateCcw size={16}/>Reset</button><button onClick={saveBuild} disabled={!ready||saving}><Save size={16}/>{saving?'Saving…':'Save Build'}</button></div></div>
    {message&&<div className="cvMessage"><Check size={16}/>{message}</div>}

    <div className="cvLayout">
      <aside className="cvPreviewPanel">
        <div className="cvPreviewTop"><div><span>LIVE INSIDE VIEW</span><b>{selectedEnclosure?.name||'Select an enclosure'}</b></div><div><button onClick={()=>setZoom(z=>Math.max(.7,z-.1))} aria-label="Zoom out"><ZoomOut size={16}/></button><button onClick={()=>setZoom(z=>Math.min(1.5,z+.1))} aria-label="Zoom in"><ZoomIn size={16}/></button><button type="button" aria-label="Download preview coming in next stage" title="Preview export is enabled from saved configurations in admin"><Download size={16}/></button></div></div>
        <div className="cvCanvasWrap"><div className="cvCanvas" style={{transform:`scale(${zoom})`}}>
          {selectedEnclosure?(selectedEnclosure.inside_image_url||selectedEnclosure.image_url?<img className="cvEnclosure" src={selectedEnclosure.inside_image_url||selectedEnclosure.image_url} alt={selectedEnclosure.name}/>:<div className="cvEmptyBox"><ImageIcon/><b>{selectedEnclosure.name}</b><span>Upload an inside-view PNG from Admin → Configurator → Templates.</span></div>):<div className="cvEmptyBox"><Settings2/><b>Choose an enclosure</b><span>Your live component preview will appear here.</span></div>}
          {layers.map(l=><img key={l.key} className="cvLayer" src={l.component.image_url} alt={l.component.name} style={{left:`${l.slot.x_pct}%`,top:`${l.slot.y_pct}%`,width:`${l.slot.width_pct}%`,height:`${l.slot.height_pct}%`,zIndex:l.slot.z_index,transform:`rotate(${l.slot.rotation_deg||0}deg)`}}/>)}
        </div></div>
        <div className="cvPreviewStatus"><ShieldCheck size={17}/><div><b>{selectedEnclosure?'Preview engine ready':'Start with enclosure'}</b><span>{layers.length?`${layers.length} visual component layer${layers.length!==1?'s':''} rendered`:'Component PNGs appear automatically when linked in admin.'}</span></div></div>
        <div className="cvPreviewBadges"><span>{code}</span>{selectedEnclosure?.dimensions_mm&&<span>{selectedEnclosure.dimensions_mm} mm</span>}<span>{flatSelections.reduce((a,b)=>a+b.quantity,0)} selections</span><span>{pricing.gstRate}% GST</span></div>
      </aside>

      <section className="cvConfigPanel">
        <div className="cvProgress"><div><span>Required selections</span><b>{completedRequired}/{requiredGroups.length}</b></div><i><em style={{width:`${requiredGroups.length?completedRequired/requiredGroups.length*100:0}%`}}/></i></div>
        {groups.map((g:any,index:number)=><section className="cvStep" key={g.id}><div className="cvStepHead"><span>{String(index+1).padStart(2,'0')}</span><div><h2>{g.label}{g.required?' *':''}</h2><p>{g.required?'Required':'Optional'}{g.allow_quantity?` • quantity up to ${g.max_quantity}`:''}</p></div>{(sel[g.option_key]||[]).length>0&&<CheckCircle2 size={19}/>}</div><div className="cvChoices">{(g.configurator_option_values||[]).map((v:any)=>{const active=(sel[g.option_key]||[]).some(x=>x.id===v.id);const chosen=(sel[g.option_key]||[]).find(x=>x.id===v.id);const comp=v.component_id?components[v.component_id]:null;const enc=v.enclosure_id?enclosures[v.enclosure_id]:null;const linked=comp||enc;const addon=Number(v.price_adjustment||0)+Number(linked?.selling_price||0);const img=comp?.image_url||enc?.inside_image_url||enc?.image_url;return <article className={'cvChoice '+(active?'active':'')} key={v.id} onClick={()=>choose(g,v)}>{img?<div className="cvChoiceImg"><img src={img} alt={v.label}/></div>:<div className="cvChoiceImg placeholder"><PackagePlus/></div>}<div className="cvChoiceBody"><b>{v.label}</b>{linked&&<small>{comp?.brands?.name||linked.material||linked.category||''}{linked.model?` • ${linked.model}`:''}</small>}<span>{addon>0?money(addon):'Included / rule based'}</span></div>{active&&<CheckCircle2 className="cvSelected"/>}{active&&g.allow_quantity&&chosen&&<div className="cvQty" onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>changeQty(g,v,-1)}><Minus size={13}/></button><b>{chosen.qty}</b><button type="button" onClick={()=>changeQty(g,v,1)}><Plus size={13}/></button></div>}</article>})}</div></section>)}
      </section>

      <aside className="cvSummary"><div className="cvSummaryTitle"><Settings2 size={17}/><div><span>LIVE BOM</span><b>Custom {code}</b></div></div>{flatSelections.length?<div className="cvBom">{groups.map((g:any)=>{const picks=sel[g.option_key]||[];if(!picks.length)return null;return <div key={g.id}><span>{g.label}</span><b>{picks.map(p=>`${valueById[p.id]?.label}${p.qty>1?` ×${p.qty}`:''}`).join(', ')}</b></div>})}</div>:<p className="cvEmptySummary">Your selected components will appear here.</p>}<div className="cvPrice"><div><span>Components</span><b>{money(pricing.componentsSubtotal)}</b></div><div><span>Assembly</span><b>{money(pricing.assembly)}</b></div><div><span>Subtotal</span><b>{money(pricing.subtotal)}</b></div><div><span>GST @ {pricing.gstRate}%</span><b>{money(pricing.gst)}</b></div><div className="total"><span>Total incl. GST</span><b>{money(pricing.final)}</b></div></div><button className="cvAdd" disabled={!ready} onClick={addBuild}><PackagePlus size={18}/>{ready?'Add Custom Build to Cart':'Complete Required Options'}</button><Link className="cvBulk" href="/bulk-order">Need multiple boxes? Request project price →</Link></aside>
    </div>
  </main><div className="cvMobileBar"><div><span>Total incl. GST</span><b>{money(pricing.final)}</b></div><button disabled={!ready} onClick={addBuild}>Add to Cart</button></div><StoreFooter/></>
}

'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect,useMemo,useState} from 'react'
import {Check,CheckCircle2,Download,Loader2,Minus,PackagePlus,Plus,RotateCcw,Save,Settings2,ZoomIn,ZoomOut} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {buildLayers,imageSource,quoteDraft,requiresQuote,spriteFor} from '../lib/configurator-visuals'
import {exportBuilder} from '../lib/export-builder'
import starter from '../lib/builder-starter.json'
import {useCart,VisualSelection} from './CartProvider'
import ComponentSprite from './ComponentSprite'
import StoreHeader from './StoreHeader'
import StoreFooter from './StoreFooter'

type Selected={id:string;qty:number}
const money=(n:number)=>`₹${n.toLocaleString('en-IN',{maximumFractionDigits:2})}`
function defaults(groups:any[]):Record<string,Selected[]>{return Object.fromEntries(groups.map(g=>[g.option_key,g.configurator_option_values.filter((v:any)=>v.metadata?.default).map((v:any)=>({id:v.id,qty:Math.min(g.max_quantity,Math.max(g.min_quantity,Number(v.metadata.default_quantity)||1))}))]))}

export default function ConfiguratorBuilder({slug,title,code,assetPreview=false}:{slug:'custom-acdb'|'custom-dcdb';title:string;code:'ACDB'|'DCDB';assetPreview?:boolean}){
  const {add}=useCart(),router=useRouter()
  const [template,setTemplate]=useState<any>(null),[groups,setGroups]=useState<any[]>([])
  const [components,setComponents]=useState<Record<string,any>>({}),[enclosures,setEnclosures]=useState<Record<string,any>>({}),[slots,setSlots]=useState<any[]>([])
  const [sel,setSel]=useState<Record<string,Selected[]>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
  const [zoom,setZoom]=useState(1),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[exporting,setExporting]=useState(false)

  useEffect(()=>{
    let cancelled=false;const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),25000)
    setLoading(true);setError('');setTemplate(null);setSel({});setMessage('')
    async function load(){
      if(assetPreview){const data=starter[code];setTemplate(data.template);setGroups(data.groups);setComponents(data.components);setEnclosures(data.enclosures);setSlots(data.slots);setSel(defaults(data.groups));setLoading(false);return}
      try{
        const tr=await supabase.from('configurator_templates').select('*').eq('slug',slug).eq('is_active',true).abortSignal(abort.signal).maybeSingle()
        if(tr.error)throw tr.error;if(!tr.data){if(!cancelled)setLoading(false);return}
        const t=tr.data,assetPack=t.preview_settings?.asset_pack
        const options=await supabase.from('configurator_options').select('id,option_key,label,option_type,sort_order,required,allow_quantity,min_quantity,max_quantity,settings,configurator_option_values(id,label,value,price_adjustment,component_id,enclosure_id,metadata,sort_order,is_active)').eq('template_id',t.id).order('sort_order').abortSignal(abort.signal)
        if(options.error)throw options.error
        const gs=(options.data||[]).filter((g:any)=>!assetPack||g.settings?.asset_pack===assetPack).map((g:any)=>({...g,configurator_option_values:(g.configurator_option_values||[]).filter((v:any)=>v.is_active&&(!assetPack||v.metadata?.asset_pack===assetPack)).sort((a:any,b:any)=>(a.sort_order||0)-(b.sort_order||0))}))
        const cids=[...new Set(gs.flatMap((g:any)=>g.configurator_option_values.map((v:any)=>v.component_id).filter(Boolean)))] as string[]
        const eids=[...new Set(gs.flatMap((g:any)=>g.configurator_option_values.map((v:any)=>v.enclosure_id).filter(Boolean)))] as string[]
        const [cr,er,sr]=await Promise.all([
          cids.length?supabase.from('components').select('id,category,name,model,sku,selling_price,gst_rate,stock_qty,unit,image_url,visual_role,visual_settings,specifications,brands(name)').in('id',cids).eq('is_active',true).abortSignal(abort.signal):Promise.resolve({data:[],error:null}),
          eids.length?supabase.from('enclosures').select('id,name,sku,dimensions_mm,material,ip_rating,module_capacity,selling_price,gst_rate,stock_qty,image_url,inside_image_url,closed_image_url,visual_settings,supported_types,specifications').in('id',eids).eq('is_active',true).abortSignal(abort.signal):Promise.resolve({data:[],error:null}),
          supabase.from('configurator_visual_slots').select('*').eq('template_id',t.id).eq('is_active',true).order('slot_index').abortSignal(abort.signal)
        ])
        if(cr.error||er.error||sr.error)throw cr.error||er.error||sr.error
        if(cancelled)return
        const cs=Object.fromEntries((cr.data||[]).map((x:any)=>[x.id,x])),es=Object.fromEntries((er.data||[]).map((x:any)=>[x.id,x]))
        const valid=gs.map((g:any)=>({...g,configurator_option_values:g.configurator_option_values.filter((v:any)=>(!v.component_id||cs[v.component_id])&&(!v.enclosure_id||es[v.enclosure_id]))}))
        setTemplate(t);setGroups(valid);setComponents(cs);setEnclosures(es);setSlots(sr.data||[]);setSel(defaults(valid))
      }catch{if(!cancelled)setError('The component catalogue could not be loaded. Please retry.')}finally{if(!cancelled)setLoading(false)}
    }
    load().finally(()=>clearTimeout(timer));return()=>{cancelled=true;abort.abort();clearTimeout(timer)}
  },[slug,code,retry,assetPreview])

  const valueById=useMemo(()=>Object.fromEntries(groups.flatMap(g=>g.configurator_option_values.map((v:any)=>[v.id,{...v,group:g}]))),[groups])
  const flatSelections=useMemo(()=>Object.entries(sel).flatMap(([option_key,list])=>list.map(s=>({option_key,value_id:s.id,quantity:s.qty}))),[sel])
  const selectedEnclosureId=sel.enclosure?.[0]?valueById[sel.enclosure[0].id]?.enclosure_id:null
  const selectedEnclosure=selectedEnclosureId?enclosures[selectedEnclosureId]:null
  const activeSlots=useMemo(()=>selectedEnclosureId?slots.filter(s=>s.enclosure_id===selectedEnclosureId):[],[slots,selectedEnclosureId])
  const layers=useMemo(()=>buildLayers(groups,sel,valueById,components,activeSlots),[groups,sel,valueById,components,activeSlots])
  const linkedItems=flatSelections.map(s=>{const v=valueById[s.value_id];return v?.component_id?components[v.component_id]:v?.enclosure_id?enclosures[v.enclosure_id]:null}).filter(Boolean)
  const quoteOnly=assetPreview||requiresQuote(template,linkedItems)
  const pricing=useMemo(()=>{
    let componentsSubtotal=0
    for(const item of flatSelections){const v=valueById[item.value_id];if(!v)continue;const linked=v.component_id?components[v.component_id]:v.enclosure_id?enclosures[v.enclosure_id]:null;componentsSubtotal+=(Number(v.price_adjustment||0)+Number(linked?.selling_price||0))*item.quantity}
    const assembly=Number(template?.base_assembly_charge||0),subtotal=componentsSubtotal+assembly,gstRate=Number(template?.default_gst_rate??18),gst=Math.round(subtotal*gstRate)/100
    return {componentsSubtotal,assembly,subtotal,gstRate,gst,final:subtotal+gst}
  },[flatSelections,valueById,components,enclosures,template])
  const requiredGroups=groups.filter(g=>g.required),completedRequired=requiredGroups.filter(g=>(sel[g.option_key]||[]).length>0).length
  const ready=requiredGroups.length>0&&completedRequired===requiredGroups.length&&!!selectedEnclosure
  function choose(g:any,v:any){const multi=g.option_type==='multi';setSel(s=>{const current=s[g.option_key]||[],exists=current.some(x=>x.id===v.id);return {...s,[g.option_key]:multi?(exists?current.filter(x=>x.id!==v.id):[...current,{id:v.id,qty:Number(v.metadata?.default_quantity)||g.min_quantity||1}]):exists&&!g.required?[]:[{id:v.id,qty:Number(v.metadata?.default_quantity)||g.min_quantity||1}]}})}
  function changeQty(g:any,id:string,delta:number){setSel(s=>({...s,[g.option_key]:(s[g.option_key]||[]).map(x=>x.id===id?{...x,qty:Math.max(g.min_quantity,Math.min(g.max_quantity,x.qty+delta))}:x)}))}
  function reset(){setSel(defaults(groups));setZoom(1);setMessage('Default layout restored.')}
  function labelSummary(){return groups.flatMap(g=>{const picks=sel[g.option_key]||[];return picks.length?[`${g.label}: ${picks.map(p=>`${valueById[p.id]?.label||''}${p.qty>1?` ×${p.qty}`:''}`).join(', ')}`]:[]}).join('\n')}
  function previewSnapshot(){return {version:3,type:code.toLowerCase(),template_id:template?.id,enclosure_id:selectedEnclosureId,selections:flatSelections,layers:layers.map(l=>({component_id:l.component.id,component_name:l.component.name,image_url:imageSource(l.component),asset_id:l.component.visual_settings?.asset_id,...l.slot}))}}
  function requestQuote(){if(!ready)return;try{sessionStorage.setItem('nis-builder-rfq',JSON.stringify(quoteDraft(code,labelSummary(),flatSelections)));router.push('/bulk-order?source=builder')}catch{setMessage('Your browser could not retain the selection. Download the BOM and include it in your enquiry.')}}
  function downloadBom(){const blob=new Blob([`${code} — quotation request\n\n${labelSummary()}\n\nVisual configuration. Ratings, fit, price and availability to be confirmed.\n`],{type:'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`New-India-Solar-${code}-BOM.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function addBuild(){if(!ready||!template||quoteOnly)return;const visualSelections:VisualSelection[]=flatSelections.map(s=>({value_id:s.value_id,quantity:s.quantity,option_key:s.option_key}));add({id:`${code.toLowerCase()}-${Date.now()}`,kind:'custom',name:`Custom ${code}`,variant:labelSummary(),price:pricing.subtotal,qty:1,customType:code.toLowerCase() as 'acdb'|'dcdb',templateId:template.id,selectedValueIds:[...new Set(flatSelections.map(s=>s.value_id))],visualSelections,visualPreview:previewSnapshot()});setMessage(`Custom ${code} added to cart.`)}
  async function saveBuild(){if(!ready||!template||assetPreview)return;setSaving(true);setMessage('');try{const {data:{user}}=await supabase.auth.getUser();if(!user){setMessage('Sign in first to save this configuration.');return}const {data,error}=await supabase.rpc('save_visual_configuration',{p_template_id:template.id,p_config_name:`Custom ${code}`,p_selections:flatSelections.map(s=>({value_id:s.value_id,quantity:s.quantity})),p_preview_snapshot:previewSnapshot()});if(error)throw error;setMessage(`Saved ${(data as any)?.configuration_code||'configuration'} successfully.`)}catch{setMessage('This configuration could not be saved. Download the BOM or retry.')}finally{setSaving(false)}}
  async function downloadPreview(){if(!selectedEnclosure)return;setExporting(true);setMessage('');try{await exportBuilder(selectedEnclosure,layers,code)}catch(e){setMessage(e instanceof Error?e.message:'Could not export preview.')}finally{setExporting(false)}}

  if(loading)return <><StoreHeader/><main className="container cvLoading"><Loader2 className="spin"/><h2>Loading {code} builder…</h2></main><StoreFooter/></>
  if(error||!template)return <><StoreHeader/><main className="container emptyCatalogue"><h1>{error?'Unable to load builder':'Builder is being prepared.'}</h1><p>{error||'Please send your requirements for a quotation.'}</p>{error&&<button className="btn" onClick={()=>setRetry(n=>n+1)}>Retry</button>}<Link className="btn btnPrimary" href="/bulk-order">Request a quotation</Link></main><StoreFooter/></>
  return <><StoreHeader/><main className="container cvPage cvAssetBuilder">
    <div className="cvBreadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/customize">Customize</Link><span>›</span><b>{code}</b></div>
    <div className="cvHead"><div><span className="eyebrow darkEye">BUILD YOUR {code}</span><h1>{title}</h1><p>Choose your components and see them inside the New India Solar enclosure.</p></div><div><button onClick={reset}><RotateCcw size={16}/>Reset</button>{!assetPreview&&<button onClick={saveBuild} disabled={!ready||saving}><Save size={16}/>{saving?'Saving…':'Save build'}</button>}</div></div>
    {assetPreview&&<p className="cvPreviewNotice">Preview release · selections are available for quotation. No purchase is placed here.</p>}
    {message&&<div className="cvMessage" role="status"><Check size={16}/>{message}</div>}
    <div className="cvLayout">
      <aside className="cvPreviewPanel">
        <div className="cvPreviewTop"><div><span>YOUR BOX</span><b>{selectedEnclosure?.name||'Select an enclosure'}</b></div><div><button onClick={()=>setZoom(z=>Math.max(.7,z-.1))} aria-label="Zoom out"><ZoomOut size={16}/></button><button onClick={()=>setZoom(z=>Math.min(1.5,z+.1))} aria-label="Zoom in"><ZoomIn size={16}/></button><button onClick={downloadPreview} disabled={!selectedEnclosure||exporting} aria-label="Download PNG preview">{exporting?<Loader2 className="spin" size={16}/>:<Download size={16}/>}</button></div></div>
        <div className="cvCanvasWrap"><div className="cvCanvas" style={{transform:`scale(${zoom})`}}>
          {selectedEnclosure?<div className="cvEnclosure"><ComponentSprite key={selectedEnclosure.id} src={imageSource(selectedEnclosure)} alt={selectedEnclosure.name} sprite={spriteFor(selectedEnclosure.visual_settings)}/></div>:<div className="cvEmptyBox"><Settings2/><b>Choose an enclosure</b></div>}
          {layers.map(l=><div key={l.key} className="cvLayer" data-component={l.component.visual_settings?.asset_id||l.component.id} style={{left:`${l.slot.x_pct}%`,top:`${l.slot.y_pct}%`,width:`${l.slot.width_pct}%`,height:`${l.slot.height_pct}%`,zIndex:l.slot.z_index,transform:`rotate(${l.slot.rotation_deg||0}deg)`}}><ComponentSprite src={imageSource(l.component)} alt={l.component.name} sprite={spriteFor(l.component.visual_settings)} fit={l.slot.settings?.fit}/></div>)}
        </div></div>
        <div className="cvPreviewBadges"><span>{code}</span><span>1 in / 1 out layout</span>{selectedEnclosure?.dimensions_mm&&<span>{selectedEnclosure.dimensions_mm} mm</span>}</div>
        <p className="cvVisualNote">Visual layout only. Final ratings, wiring and fit are confirmed with your quotation.</p>
        <button className="cvDownload" onClick={downloadPreview} disabled={!selectedEnclosure||exporting}><Download size={16}/>{exporting?'Preparing PNG…':'Download box PNG'}</button>
      </aside>
      <section className="cvConfigPanel" aria-label="Component choices">
        <div className="cvProgress"><div><span>Required selections</span><b>{completedRequired}/{requiredGroups.length}</b></div><i><em style={{width:`${requiredGroups.length?completedRequired/requiredGroups.length*100:0}%`}}/></i></div>
        {groups.map((g:any,index:number)=><section className="cvStep" key={g.id}><div className="cvStepHead"><span>{String(index+1).padStart(2,'0')}</span><div><h2>{g.label}{g.required?' *':''}</h2><p>{g.option_type==='multi'?'Select the parts to include':g.required?'Choose one':'Optional — select again to remove'}</p></div>{(sel[g.option_key]||[]).length>0&&<CheckCircle2 size={19}/>}</div><div className="cvChoices">{g.configurator_option_values.map((v:any)=>{const chosen=(sel[g.option_key]||[]).find(x=>x.id===v.id),linked=v.component_id?components[v.component_id]:enclosures[v.enclosure_id],src=linked?imageSource(linked):'',addon=Number(v.price_adjustment||0)+Number(linked?.selling_price||0);return <article className={'cvChoice '+(chosen?'active':'')} key={v.id}><button className="cvChoiceSelect" aria-pressed={!!chosen} onClick={()=>choose(g,v)}>{src?<div className="cvChoiceImg"><ComponentSprite src={src} alt={v.label} sprite={spriteFor(linked.visual_settings)}/></div>:<div className="cvChoiceImg placeholder"><PackagePlus/></div>}<div className="cvChoiceBody"><b>{v.label}</b>{linked&&<small>{linked.category||linked.material}</small>}<span>{quoteOnly||addon<=0?'Price on quotation':money(addon)}</span></div>{chosen&&<CheckCircle2 className="cvSelected"/>}</button>{chosen&&g.allow_quantity&&<div className="cvQty"><button aria-label={`Reduce ${v.label} quantity`} disabled={chosen.qty<=g.min_quantity} onClick={()=>changeQty(g,v.id,-1)}><Minus size={13}/></button><b>{chosen.qty}</b><button aria-label={`Increase ${v.label} quantity`} disabled={chosen.qty>=g.max_quantity} onClick={()=>changeQty(g,v.id,1)}><Plus size={13}/></button></div>}</article>})}</div>{!g.configurator_option_values.length&&<p>No options are available in this category yet.</p>}</section>)}
      </section>
      <aside className="cvSummary"><div className="cvSummaryTitle"><Settings2 size={17}/><div><span>SELECTED COMPONENTS</span><b>Custom {code}</b></div></div><div className="cvBom">{groups.map(g=>{const picks=sel[g.option_key]||[];return picks.length?<div key={g.id}><span>{g.label}</span><b>{picks.map(p=>`${valueById[p.id]?.label}${p.qty>1?` ×${p.qty}`:''}`).join(', ')}</b></div>:null})}</div>
        {quoteOnly?<div className="cvQuotePrice"><b>Request your price</b><p>We’ll confirm component availability, the final specification and your quotation.</p></div>:<div className="cvPrice"><div><span>Components</span><b>{money(pricing.componentsSubtotal)}</b></div><div><span>Assembly</span><b>{money(pricing.assembly)}</b></div><div><span>GST @ {pricing.gstRate}%</span><b>{money(pricing.gst)}</b></div><div className="total"><span>Total incl. GST</span><b>{money(pricing.final)}</b></div></div>}
        <button className="cvAdd" disabled={!ready} onClick={quoteOnly?requestQuote:addBuild}>{!ready?'Complete required options':quoteOnly?'Request quotation':'Add custom build to cart'}</button><button className="cvDownload" disabled={!flatSelections.length} onClick={downloadBom}><Download size={16}/>Download component list</button>
      </aside>
    </div>
  </main><div className="cvMobileBar"><div><span>{quoteOnly?'Your configuration':'Total incl. GST'}</span><b>{quoteOnly?'Price on quotation':money(pricing.final)}</b></div><button disabled={!ready} onClick={quoteOnly?requestQuote:addBuild}>{quoteOnly?'Request quotation':'Add to cart'}</button></div><StoreFooter/></>
}

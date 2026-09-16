'use client'

import {useEffect,useMemo,useState} from 'react'
import {AlertTriangle,Check,History,IndianRupee,Layers3,Plus,RefreshCw,Save,Search,ShieldCheck,SlidersHorizontal,Trash2,X} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

type PriceItem={id:string;type:'variant'|'component'|'enclosure';label:string;sku:string;cost:number;selling:number;mrp?:number|null;gst:number;active:boolean}
type Tab='prices'|'tiers'|'configurator'|'history'
const money=(n:any)=>`₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`
const margin=(cost:number,sell:number)=>sell>0?((sell-cost)/sell)*100:null
const floor=(cost:number,min:number)=>cost>0&&min<100?cost/(1-min/100):0
const pct=(n:any)=>`${Number(n||0).toFixed(1)}%`
const segments=['retail','dealer','epc','distributor','project']

export default function PricingPage(){
 const [items,setItems]=useState<PriceItem[]>([]),[templates,setTemplates]=useState<any[]>([]),[tiers,setTiers]=useState<any[]>([]),[historyRows,setHistoryRows]=useState<any[]>([]),[settings,setSettings]=useState<any>(null)
 const [tab,setTab]=useState<Tab>('prices'),[q,setQ]=useState(''),[type,setType]=useState('all'),[selected,setSelected]=useState<any>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[msg,setMsg]=useState('')
 const [tierDraft,setTierDraft]=useState<any>({item_type:'variant',item_id:'',customer_segment:'dealer',min_qty:1,max_qty:'',price_mode:'fixed',unit_price:'',discount_percent:'',notes:''})

 async function load(){
  setLoading(true);setMsg('')
  const [vr,pr,cr,er,tr,sr,rr,hr]=await Promise.all([
   supabase.from('product_variants').select('id,product_id,sku,title,cost_price,selling_price,mrp,is_active'),
   supabase.from('products').select('id,name,gst_rate'),
   supabase.from('components').select('id,name,sku,cost_price,selling_price,gst_rate,is_active'),
   supabase.from('enclosures').select('id,name,sku,cost_price,selling_price,gst_rate,is_active'),
   supabase.from('configurator_templates').select('id,type,name,slug,base_assembly_charge,default_gst_rate,is_active').order('type'),
   supabase.from('pricing_settings').select('*').eq('id','default').maybeSingle(),
   supabase.from('price_tiers').select('*').order('customer_segment').order('min_qty'),
   supabase.from('pricing_history').select('*').order('created_at',{ascending:false}).limit(250)
  ])
  const pmap=new Map((pr.data||[]).map((p:any)=>[p.id,p]))
  const combined:PriceItem[]=[
   ...(vr.data||[]).map((v:any)=>{const p:any=pmap.get(v.product_id);return{id:v.id,type:'variant' as const,label:`${p?.name||'Product'} — ${v.title||v.sku||'Variant'}`,sku:v.sku||'',cost:Number(v.cost_price||0),selling:Number(v.selling_price||0),mrp:v.mrp==null?null:Number(v.mrp),gst:Number(p?.gst_rate||18),active:!!v.is_active}}),
   ...(cr.data||[]).map((c:any)=>({id:c.id,type:'component' as const,label:c.name||'Component',sku:c.sku||'',cost:Number(c.cost_price||0),selling:Number(c.selling_price||0),gst:Number(c.gst_rate||18),active:!!c.is_active})),
   ...(er.data||[]).map((e:any)=>({id:e.id,type:'enclosure' as const,label:e.name||'Enclosure',sku:e.sku||'',cost:Number(e.cost_price||0),selling:Number(e.selling_price||0),gst:Number(e.gst_rate||18),active:!!e.is_active}))
  ]
  setItems(combined);setTemplates(tr.data||[]);setSettings(sr.data||null);setTiers(rr.data||[]);setHistoryRows(hr.data||[]);setLoading(false)
 }
 useEffect(()=>{load()},[])

 const filtered=useMemo(()=>items.filter(i=>(type==='all'||i.type===type)&&`${i.label} ${i.sku}`.toLowerCase().includes(q.toLowerCase())),[items,type,q])
 const minMargin=Number(settings?.min_margin_percent||15),warningMargin=Number(settings?.warning_margin_percent||22)
 const below=items.filter(i=>i.cost>0&&i.selling>0&&(margin(i.cost,i.selling)??999)<minMargin)
 const warning=items.filter(i=>i.cost>0&&i.selling>0&&(margin(i.cost,i.selling)??999)>=minMargin&&(margin(i.cost,i.selling)??999)<warningMargin)
 const avgMargin=items.filter(i=>i.cost>0&&i.selling>0).reduce((a,i)=>a+(margin(i.cost,i.selling)||0),0)/Math.max(1,items.filter(i=>i.cost>0&&i.selling>0).length)

 function openItem(i:PriceItem){setSelected({...i,cost:String(i.cost||''),selling:String(i.selling||''),mrp:i.mrp==null?'':String(i.mrp),gst:String(i.gst),reason:'',override:false})}
 async function saveItem(){
  if(!selected)return;setSaving(true);setMsg('')
  const {error}=await supabase.rpc('update_pricing_item',{p_item_type:selected.type,p_item_id:selected.id,p_cost:selected.cost===''?null:Number(selected.cost),p_selling:selected.selling===''?null:Number(selected.selling),p_mrp:selected.type==='variant'?(selected.mrp===''?null:Number(selected.mrp)):null,p_gst:selected.gst===''?null:Number(selected.gst),p_reason:selected.reason||'Admin pricing update',p_override:!!selected.override})
  setSaving(false);if(error){setMsg(error.message);return}setMsg('Pricing updated and added to history.');setSelected(null);await load()
 }
 async function saveSettings(){
  if(!settings)return;setSaving(true);setMsg('')
  const {data,error}=await supabase.rpc('save_pricing_settings',{p_min_margin:Number(settings.min_margin_percent),p_warning_margin:Number(settings.warning_margin_percent),p_dealer:Number(settings.dealer_discount_percent),p_epc:Number(settings.epc_discount_percent),p_distributor:Number(settings.distributor_discount_percent),p_project:Number(settings.project_discount_percent),p_enforce:!!settings.enforce_min_margin,p_allow_override:!!settings.allow_admin_override})
  setSaving(false);if(error){setMsg(error.message);return}setSettings(data);setMsg('Global pricing policy saved.')
 }
 async function addTier(){
  if(!tierDraft.item_id){setMsg('Select an item for the price tier.');return}
  const payload={...tierDraft,min_qty:Number(tierDraft.min_qty||1),max_qty:tierDraft.max_qty===''?null:Number(tierDraft.max_qty),unit_price:tierDraft.price_mode==='fixed'?Number(tierDraft.unit_price||0):null,discount_percent:tierDraft.price_mode==='discount_percent'?Number(tierDraft.discount_percent||0):null,notes:tierDraft.notes||null}
  const {data:{user}}=await supabase.auth.getUser();(payload as any).created_by=user?.id||null
  const {error}=await supabase.from('price_tiers').insert(payload)
  if(error){setMsg(error.message);return}setMsg('Price tier added.');setTierDraft({...tierDraft,min_qty:1,max_qty:'',unit_price:'',discount_percent:'',notes:''});await load()
 }
 async function removeTier(id:string){if(!confirm('Delete this price tier?'))return;const {error}=await supabase.from('price_tiers').delete().eq('id',id);if(error)setMsg(error.message);else{setMsg('Price tier removed.');await load()}}
 async function saveTemplate(t:any){
  setSaving(true);setMsg('');const {error}=await supabase.rpc('update_pricing_item',{p_item_type:'template',p_item_id:t.id,p_cost:null,p_selling:Number(t.base_assembly_charge||0),p_mrp:null,p_gst:Number(t.default_gst_rate||18),p_reason:'Configurator pricing update',p_override:false});setSaving(false);if(error)setMsg(error.message);else{setMsg('Configurator pricing saved.');await load()}
 }

 const eligibleItems=items.filter(i=>i.type===tierDraft.item_type)
 return <div className="pricingV2">
  <div className="pricingHero"><div><span className="adminEyebrow">COMMERCIAL CONTROL</span><h1>Pricing & Margin Control</h1><p>Control cost, selling price, GST, customer-segment pricing, quantity slabs and ACDB/DCDB assembly charges from one protected workspace.</p></div><button className="adminBtn ghost" onClick={load}><RefreshCw size={16}/>Refresh</button></div>
  {msg&&<div className={`themeMessage ${msg.toLowerCase().includes('violates')?'danger':''}`}><Check size={16}/>{msg}</div>}

  <div className="pricingStats">
   <div><span>Priced Items</span><b>{items.length}</b><small>Variants + components + enclosures</small></div>
   <div><span>Average Gross Margin</span><b>{pct(avgMargin)}</b><small>Based on current cost vs sell</small></div>
   <div className={below.length?'danger':''}><span>Below Minimum</span><b>{below.length}</b><small>Minimum policy {pct(minMargin)}</small></div>
   <div className={warning.length?'warn':''}><span>Margin Watch</span><b>{warning.length}</b><small>Below warning level {pct(warningMargin)}</small></div>
   <div><span>Active Price Tiers</span><b>{tiers.filter(t=>t.is_active).length}</b><small>Dealer / EPC / distributor / project</small></div>
  </div>

  {settings&&<section className="pricingPolicy adminPanel"><div className="pricingSectionHead"><div><ShieldCheck size={18}/><div><h2>Margin Protection Policy</h2><p>These controls protect all direct selling-price updates at database level.</p></div></div><button className="adminBtn" onClick={saveSettings} disabled={saving}><Save size={16}/>Save Policy</button></div><div className="pricingPolicyGrid">
   <label><span>Minimum gross margin %</span><input type="number" min="0" max="99" value={settings.min_margin_percent} onChange={e=>setSettings({...settings,min_margin_percent:e.target.value})}/></label>
   <label><span>Warning margin %</span><input type="number" min="0" max="99" value={settings.warning_margin_percent} onChange={e=>setSettings({...settings,warning_margin_percent:e.target.value})}/></label>
   <label><span>Default Dealer discount %</span><input type="number" min="0" max="99" value={settings.dealer_discount_percent} onChange={e=>setSettings({...settings,dealer_discount_percent:e.target.value})}/></label>
   <label><span>Default EPC discount %</span><input type="number" min="0" max="99" value={settings.epc_discount_percent} onChange={e=>setSettings({...settings,epc_discount_percent:e.target.value})}/></label>
   <label><span>Default Distributor discount %</span><input type="number" min="0" max="99" value={settings.distributor_discount_percent} onChange={e=>setSettings({...settings,distributor_discount_percent:e.target.value})}/></label>
   <label><span>Default Project discount %</span><input type="number" min="0" max="99" value={settings.project_discount_percent} onChange={e=>setSettings({...settings,project_discount_percent:e.target.value})}/></label>
   <label className="pricingCheck"><input type="checkbox" checked={!!settings.enforce_min_margin} onChange={e=>setSettings({...settings,enforce_min_margin:e.target.checked})}/><span>Enforce minimum margin</span></label>
   <label className="pricingCheck"><input type="checkbox" checked={!!settings.allow_admin_override} onChange={e=>setSettings({...settings,allow_admin_override:e.target.checked})}/><span>Allow admin override with explicit confirmation</span></label>
  </div></section>}

  <div className="pricingTabs"><button className={tab==='prices'?'active':''} onClick={()=>setTab('prices')}><IndianRupee size={16}/>Master Prices</button><button className={tab==='tiers'?'active':''} onClick={()=>setTab('tiers')}><Layers3 size={16}/>Segment & Quantity Tiers</button><button className={tab==='configurator'?'active':''} onClick={()=>setTab('configurator')}><SlidersHorizontal size={16}/>Configurator Charges</button><button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><History size={16}/>Price History</button></div>

  {tab==='prices'&&<><section className="pricingToolbar"><div className="pricingSearch"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search item or SKU…"/></div><select value={type} onChange={e=>setType(e.target.value)}><option value="all">All item types</option><option value="variant">Finished goods</option><option value="component">Components</option><option value="enclosure">Enclosures</option></select></section><section className="adminPanel"><div className="adminTableWrap"><table className="adminTable pricingTable"><thead><tr><th>Item</th><th>Type</th><th>Cost</th><th>Sell ex-GST</th><th>GST</th><th>Gross Margin</th><th>Minimum Sell</th><th></th></tr></thead><tbody>{loading?<tr><td colSpan={8} className="emptyCell">Loading pricing…</td></tr>:filtered.length?filtered.map(i=>{const m=margin(i.cost,i.selling),low=m!=null&&m<minMargin,warn=m!=null&&m>=minMargin&&m<warningMargin;return <tr key={`${i.type}-${i.id}`}><td><b>{i.label}</b><span className="tableSub">{i.sku||'No SKU'} {!i.active?'• Inactive':''}</span></td><td><span className="pricingType">{i.type==='variant'?'Finished Good':i.type}</span></td><td>{money(i.cost)}</td><td><b>{money(i.selling)}</b>{i.mrp!=null&&<span className="tableSub">MRP {money(i.mrp)}</span>}</td><td>{pct(i.gst)}</td><td><span className={`marginPill ${low?'danger':warn?'warn':'good'}`}>{m==null?'—':pct(m)}</span></td><td>{i.cost>0?money(floor(i.cost,minMargin)):'—'}</td><td><button className="adminBtn tiny" onClick={()=>openItem(i)}>Edit</button></td></tr>}):<tr><td colSpan={8} className="emptyCell">No priced items match.</td></tr>}</tbody></table></div></section></>}

  {tab==='tiers'&&<div className="pricingTierLayout"><section className="adminPanel"><div className="pricingSectionHead"><div><Plus size={18}/><div><h2>Add Segment / Quantity Price</h2><p>Specific tiers override the default segment discount for the matching quantity range.</p></div></div></div><div className="tierForm">
   <label><span>Item type</span><select value={tierDraft.item_type} onChange={e=>setTierDraft({...tierDraft,item_type:e.target.value,item_id:''})}><option value="variant">Finished Good</option><option value="component">Component</option><option value="enclosure">Enclosure</option></select></label>
   <label className="wide"><span>Item</span><select value={tierDraft.item_id} onChange={e=>setTierDraft({...tierDraft,item_id:e.target.value})}><option value="">Select item</option>{eligibleItems.map(i=><option key={i.id} value={i.id}>{i.label} {i.sku?`(${i.sku})`:''}</option>)}</select></label>
   <label><span>Customer segment</span><select value={tierDraft.customer_segment} onChange={e=>setTierDraft({...tierDraft,customer_segment:e.target.value})}>{segments.map(s=><option key={s} value={s}>{s.toUpperCase()}</option>)}</select></label>
   <label><span>Min qty</span><input type="number" min="1" value={tierDraft.min_qty} onChange={e=>setTierDraft({...tierDraft,min_qty:e.target.value})}/></label><label><span>Max qty</span><input type="number" min="1" placeholder="No limit" value={tierDraft.max_qty} onChange={e=>setTierDraft({...tierDraft,max_qty:e.target.value})}/></label>
   <label><span>Price mode</span><select value={tierDraft.price_mode} onChange={e=>setTierDraft({...tierDraft,price_mode:e.target.value})}><option value="fixed">Fixed unit price</option><option value="discount_percent">Discount from base %</option></select></label>
   {tierDraft.price_mode==='fixed'?<label><span>Unit price</span><input type="number" min="0" value={tierDraft.unit_price} onChange={e=>setTierDraft({...tierDraft,unit_price:e.target.value})}/></label>:<label><span>Discount %</span><input type="number" min="0" max="99" value={tierDraft.discount_percent} onChange={e=>setTierDraft({...tierDraft,discount_percent:e.target.value})}/></label>}
   <label className="wide"><span>Notes</span><input value={tierDraft.notes} onChange={e=>setTierDraft({...tierDraft,notes:e.target.value})} placeholder="e.g. Approved Gujarat EPC slab"/></label><button className="adminBtn" onClick={addTier}><Plus size={16}/>Add Tier</button>
  </div></section><section className="adminPanel"><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Item</th><th>Segment</th><th>Qty</th><th>Rule</th><th>Status</th><th></th></tr></thead><tbody>{tiers.length?tiers.map(t=>{const item=items.find(i=>i.id===t.item_id&&i.type===t.item_type);return <tr key={t.id}><td><b>{item?.label||'Unknown item'}</b><span className="tableSub">{item?.sku||t.item_type}</span></td><td>{String(t.customer_segment).toUpperCase()}</td><td>{t.min_qty}{t.max_qty?`–${t.max_qty}`:'+'}</td><td>{t.price_mode==='fixed'?money(t.unit_price):`${t.discount_percent}% off base`}</td><td><span className={`statusPill ${t.is_active?'active':'draft'}`}>{t.is_active?'Active':'Inactive'}</span></td><td><button className="iconBtn danger" onClick={()=>removeTier(t.id)}><Trash2 size={16}/></button></td></tr>}):<tr><td colSpan={6} className="emptyCell">No special price tiers configured. Default segment discounts still apply.</td></tr>}</tbody></table></div></section></div>}

  {tab==='configurator'&&<section className="adminPanel"><div className="pricingSectionHead"><div><SlidersHorizontal size={18}/><div><h2>ACDB / DCDB Assembly Charges</h2><p>Control the base assembly/service charge and GST for each configurator template. Component and enclosure selling prices remain separate.</p></div></div></div><div className="configPriceGrid">{templates.length?templates.map(t=><div className="configPriceCard" key={t.id}><div><span className={`configType ${t.type}`}>{String(t.type).toUpperCase()}</span><h3>{t.name}</h3><small>{t.slug} • {t.is_active?'Active':'Inactive'}</small></div><label><span>Base assembly charge</span><input type="number" min="0" value={t.base_assembly_charge||0} onChange={e=>setTemplates(xs=>xs.map(x=>x.id===t.id?{...x,base_assembly_charge:e.target.value}:x))}/></label><label><span>GST %</span><input type="number" min="0" max="100" value={t.default_gst_rate||18} onChange={e=>setTemplates(xs=>xs.map(x=>x.id===t.id?{...x,default_gst_rate:e.target.value}:x))}/></label><button className="adminBtn" onClick={()=>saveTemplate(t)} disabled={saving}><Save size={15}/>Save Charge</button></div>):<div className="emptyCell">No configurator templates are currently available.</div>}</div></section>}

  {tab==='history'&&<section className="adminPanel"><div className="pricingSectionHead"><div><History size={18}/><div><h2>Pricing Audit Trail</h2><p>Cost, selling price, MRP, GST and assembly-charge changes are recorded automatically.</p></div></div></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>When</th><th>Item</th><th>Field</th><th>Old</th><th>New</th><th>Reason</th></tr></thead><tbody>{historyRows.length?historyRows.map(h=><tr key={h.id}><td>{new Date(h.created_at).toLocaleString('en-IN')}</td><td><b>{h.item_label||h.item_type}</b><span className="tableSub">{h.item_type}</span></td><td>{String(h.field_name).replaceAll('_',' ')}</td><td>{h.old_value==null?'—':h.field_name.includes('gst')?pct(h.old_value):money(h.old_value)}</td><td><b>{h.new_value==null?'—':h.field_name.includes('gst')?pct(h.new_value):money(h.new_value)}</b></td><td>{h.change_reason||'System / direct update'}</td></tr>):<tr><td colSpan={6} className="emptyCell">No pricing changes recorded yet.</td></tr>}</tbody></table></div></section>}

  {selected&&<div className="adminDrawerBackdrop" onClick={()=>setSelected(null)}><aside className="pricingDrawer" onClick={e=>e.stopPropagation()}><div className="pricingDrawerHead"><div><span className="adminEyebrow">PRICE CONTROL</span><h2>{selected.label}</h2><p>{selected.sku||selected.type}</p></div><button className="iconBtn" onClick={()=>setSelected(null)}><X size={18}/></button></div><div className="pricingDrawerMetrics"><div><span>Current Margin</span><b>{pct(margin(Number(selected.cost||0),Number(selected.selling||0))||0)}</b></div><div><span>Minimum Allowed Sell</span><b>{money(floor(Number(selected.cost||0),minMargin))}</b></div></div><div className="pricingDrawerForm"><label><span>Cost price</span><input type="number" min="0" value={selected.cost} onChange={e=>setSelected({...selected,cost:e.target.value})}/></label><label><span>Selling price ex-GST</span><input type="number" min="0" value={selected.selling} onChange={e=>setSelected({...selected,selling:e.target.value})}/></label>{selected.type==='variant'&&<label><span>MRP</span><input type="number" min="0" value={selected.mrp} onChange={e=>setSelected({...selected,mrp:e.target.value})}/></label>}<label><span>GST %</span><input type="number" min="0" max="100" value={selected.gst} onChange={e=>setSelected({...selected,gst:e.target.value})}/></label><label className="wide"><span>Reason for change</span><input value={selected.reason} onChange={e=>setSelected({...selected,reason:e.target.value})} placeholder="Required for a useful audit trail"/></label><label className="pricingCheck wide"><input type="checkbox" checked={!!selected.override} onChange={e=>setSelected({...selected,override:e.target.checked})}/><span>Admin override below minimum margin (if permitted)</span></label></div>{Number(selected.cost||0)>0&&Number(selected.selling||0)>0&&(margin(Number(selected.cost),Number(selected.selling))||0)<minMargin&&<div className="pricingWarning"><AlertTriangle size={17}/><span>This selling price is below the {pct(minMargin)} minimum-margin policy and will be blocked unless an authorized admin override is used.</span></div>}<div className="pricingDrawerActions"><button className="adminBtn ghost" onClick={()=>setSelected(null)}>Cancel</button><button className="adminBtn" onClick={saveItem} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save Pricing'}</button></div></aside></div>}
 </div>
}

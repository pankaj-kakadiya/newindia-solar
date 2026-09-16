'use client'

import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {Search,RefreshCw,Download,ChevronRight,PackageCheck,Clock3,CreditCard,Factory,Truck,CheckCircle2,Filter,FileSpreadsheet} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

type OrderRow={
  id:string
  order_number:string
  status:string
  payment_status:string
  grand_total:number|string|null
  customer_snapshot:any
  business_purchase:boolean
  company_name:string|null
  gstin:string|null
  created_at:string
  order_source:string|null
  payment_method:string|null
  po_number:string|null
}

type TabKey='all'|'pending'|'confirmed'|'processing'|'production'|'ready_to_ship'|'shipped'|'delivered'|'cancelled'|'payment_pending'

const tabs:{key:TabKey;label:string}[]=[
  {key:'all',label:'All'},
  {key:'pending',label:'Pending'},
  {key:'confirmed',label:'Confirmed'},
  {key:'processing',label:'Processing'},
  {key:'production',label:'Production'},
  {key:'ready_to_ship',label:'Ready to Ship'},
  {key:'shipped',label:'Shipped'},
  {key:'delivered',label:'Delivered'},
  {key:'cancelled',label:'Cancelled'},
  {key:'payment_pending',label:'Payment Pending'},
]

const activeProductionStatuses=new Set(['new','bom_ready','material_reserved','assembly','testing','qc_passed','packing','in_progress','pending'])

function money(v:any){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`}
function norm(v:any){return String(v||'').toLowerCase().trim()}
function customerName(o:OrderRow){return o.company_name||o.customer_snapshot?.name||o.customer_snapshot?.full_name||'Customer'}
function customerPhone(o:OrderRow){return o.customer_snapshot?.phone||o.customer_snapshot?.mobile||''}
function label(v:string){return v.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}

export default function Orders(){
  const [rows,setRows]=useState<OrderRow[]>([])
  const [productionMap,setProductionMap]=useState<Record<string,string[]>>({})
  const [customOrders,setCustomOrders]=useState<Set<string>>(new Set())
  const [itemCounts,setItemCounts]=useState<Record<string,number>>({})
  const [q,setQ]=useState('')
  const [tab,setTab]=useState<TabKey>('all')
  const [payment,setPayment]=useState('all')
  const [source,setSource]=useState('all')
  const [purchaseType,setPurchaseType]=useState('all')
  const [from,setFrom]=useState('')
  const [to,setTo]=useState('')
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [bulkStatus,setBulkStatus]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  async function load(){
    setLoading(true);setMessage('')
    const [{data:orders,error:orderError},{data:jobs},{data:items}]=await Promise.all([
      supabase.from('orders').select('id,order_number,status,payment_status,grand_total,customer_snapshot,business_purchase,company_name,gstin,created_at,order_source,payment_method,po_number').order('created_at',{ascending:false}).limit(500),
      supabase.from('production_jobs').select('order_id,status').not('order_id','is',null),
      supabase.from('order_items').select('order_id,item_type')
    ])
    if(orderError){setMessage(orderError.message);setRows([]);setLoading(false);return}
    const pm:Record<string,string[]>={}
    ;(jobs||[]).forEach((j:any)=>{if(j.order_id)(pm[j.order_id] ||= []).push(j.status||'new')})
    const custom=new Set<string>();const counts:Record<string,number>={}
    ;(items||[]).forEach((i:any)=>{counts[i.order_id]=(counts[i.order_id]||0)+1;if(i.item_type==='custom')custom.add(i.order_id)})
    setProductionMap(pm);setCustomOrders(custom);setItemCounts(counts);setRows((orders||[]) as OrderRow[]);setSelected(new Set());setLoading(false)
  }

  useEffect(()=>{load()},[])

  const sources=useMemo(()=>Array.from(new Set(rows.map(r=>r.order_source).filter(Boolean) as string[])).sort(),[rows])

  function matchesTab(o:OrderRow,key:TabKey){
    if(key==='all')return true
    if(key==='payment_pending')return o.payment_status==='pending'
    if(key==='production')return (productionMap[o.id]||[]).some(s=>activeProductionStatuses.has(norm(s)))
    return o.status===key
  }

  const filtered=useMemo(()=>rows.filter(o=>{
    const hay=norm(`${o.order_number} ${customerName(o)} ${customerPhone(o)} ${o.gstin||''} ${o.po_number||''}`)
    const date=new Date(o.created_at).getTime()
    const after=!from||date>=new Date(`${from}T00:00:00`).getTime()
    const before=!to||date<=new Date(`${to}T23:59:59`).getTime()
    return matchesTab(o,tab)&&(!q||hay.includes(norm(q)))&&(payment==='all'||o.payment_status===payment)&&(source==='all'||(o.order_source||'website')===source)&&(purchaseType==='all'||(purchaseType==='business'?o.business_purchase:purchaseType==='individual'?!o.business_purchase:purchaseType==='custom'?customOrders.has(o.id):true))&&after&&before
  }),[rows,productionMap,customOrders,q,tab,payment,source,purchaseType,from,to])

  const counts=useMemo(()=>Object.fromEntries(tabs.map(t=>[t.key,rows.filter(o=>matchesTab(o,t.key)).length])),[rows,productionMap])
  const stats=useMemo(()=>({
    total:rows.length,
    open:rows.filter(o=>!['delivered','cancelled','refunded'].includes(o.status)).length,
    paymentPending:rows.filter(o=>o.payment_status==='pending').length,
    paymentPendingValue:rows.filter(o=>o.payment_status==='pending').reduce((a,o)=>a+Number(o.grand_total||0),0),
    production:rows.filter(o=>matchesTab(o,'production')).length,
    ready:rows.filter(o=>o.status==='ready_to_ship').length,
  }),[rows,productionMap])

  function toggleOne(id:string){setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})}
  function toggleAll(){setSelected(prev=>prev.size===filtered.length&&filtered.length?new Set():new Set(filtered.map(o=>o.id)))}

  async function bulkUpdate(){
    if(!bulkStatus||!selected.size)return
    if(!window.confirm(`Change ${selected.size} selected order(s) to ${label(bulkStatus)}?`))return
    setBusy(true);setMessage('')
    const ids=Array.from(selected)
    const {data:{user}}=await supabase.auth.getUser()
    const oldById=Object.fromEntries(rows.filter(o=>selected.has(o.id)).map(o=>[o.id,o.status]))
    const patch:any={status:bulkStatus}
    if(bulkStatus==='confirmed')patch.confirmed_at=new Date().toISOString()
    if(bulkStatus==='shipped')patch.shipped_at=new Date().toISOString()
    if(bulkStatus==='delivered')patch.delivered_at=new Date().toISOString()
    const {error}=await supabase.from('orders').update(patch).in('id',ids)
    if(!error){
      const history=ids.filter(id=>oldById[id]!==bulkStatus).map(id=>({order_id:id,from_status:oldById[id]||null,to_status:bulkStatus,note:'Bulk status update from Orders V2',changed_by:user?.id||null}))
      if(history.length)await supabase.from('order_status_history').insert(history)
      setMessage(`${ids.length} order(s) updated.`);setBulkStatus('');await load()
    }else setMessage(error.message)
    setBusy(false)
  }

  function exportCsv(){
    const headers=['Order','Customer','Phone','Business','GSTIN','Status','Payment','Source','Total','Date']
    const lines=filtered.map(o=>[o.order_number,customerName(o),customerPhone(o),o.business_purchase?'Yes':'No',o.gstin||'',o.status,o.payment_status,o.order_source||'website',Number(o.grand_total||0),new Date(o.created_at).toISOString()])
    const csv=[headers,...lines].map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`new-india-solar-orders-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)
  }

  function clearFilters(){setQ('');setPayment('all');setSource('all');setPurchaseType('all');setFrom('');setTo('');setTab('all')}

  return <div className="ordersV2">
    <div className="adminPageHead ordersHead"><div><span className="adminEyebrow">SALES OPERATIONS</span><h1>Orders</h1><p>Control website, GST business and custom ACDB/DCDB orders from one workspace.</p></div><div className="ordersHeadActions"><button className="ordersGhostBtn" onClick={exportCsv}><Download size={15}/> Export CSV</button><button className="ordersGhostBtn" onClick={load} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> Refresh</button></div></div>

    <div className="ordersKpis">
      <div><span className="ordersKpiIcon"><PackageCheck size={18}/></span><p><small>Total orders</small><b>{stats.total}</b></p></div>
      <div><span className="ordersKpiIcon amber"><Clock3 size={18}/></span><p><small>Open orders</small><b>{stats.open}</b></p></div>
      <div><span className="ordersKpiIcon red"><CreditCard size={18}/></span><p><small>Payment pending</small><b>{stats.paymentPending}</b><em>{money(stats.paymentPendingValue)}</em></p></div>
      <div><span className="ordersKpiIcon blue"><Factory size={18}/></span><p><small>In production</small><b>{stats.production}</b></p></div>
      <div><span className="ordersKpiIcon green"><Truck size={18}/></span><p><small>Ready to ship</small><b>{stats.ready}</b></p></div>
    </div>

    <section className="ordersWorkspace">
      <div className="ordersTabs" role="tablist">{tabs.map(t=><button key={t.key} className={tab===t.key?'active':''} onClick={()=>{setTab(t.key);setSelected(new Set())}}>{t.label}<span>{counts[t.key]||0}</span></button>)}</div>

      <div className="ordersFilters">
        <div className="ordersSearch"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search order, customer, phone, GSTIN or PO…"/></div>
        <select value={payment} onChange={e=>setPayment(e.target.value)}><option value="all">All payments</option><option value="pending">Payment pending</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option><option value="partially_refunded">Partially refunded</option></select>
        <select value={purchaseType} onChange={e=>setPurchaseType(e.target.value)}><option value="all">All order types</option><option value="business">GST Business</option><option value="individual">Individual</option><option value="custom">Custom ACDB/DCDB</option></select>
        <select value={source} onChange={e=>setSource(e.target.value)}><option value="all">All sources</option>{sources.map(s=><option value={s} key={s}>{label(s)}</option>)}</select>
        <label className="ordersDate"><span>From</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label className="ordersDate"><span>To</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
        <button className="ordersClear" onClick={clearFilters}><Filter size={14}/> Reset</button>
      </div>

      {selected.size>0&&<div className="ordersBulkBar"><div><CheckCircle2 size={16}/><b>{selected.size}</b> selected</div><select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}><option value="">Change status…</option>{['pending','confirmed','processing','ready_to_ship','shipped','delivered','cancelled','refunded'].map(s=><option value={s} key={s}>{label(s)}</option>)}</select><button onClick={bulkUpdate} disabled={!bulkStatus||busy}>{busy?'Updating…':'Apply'}</button><button className="linkBtn" onClick={()=>setSelected(new Set())}>Clear selection</button></div>}

      {message&&<div className="ordersMessage">{message}</div>}

      <div className="ordersTableWrap"><table className="ordersTable"><thead><tr><th className="checkCol"><input type="checkbox" checked={!!filtered.length&&selected.size===filtered.length} onChange={toggleAll} aria-label="Select all visible orders"/></th><th>Order</th><th>Customer</th><th>Type</th><th>Fulfilment</th><th>Payment</th><th>Items</th><th>Total</th><th>Placed</th><th></th></tr></thead><tbody>
        {loading?<tr><td colSpan={10} className="ordersEmpty">Loading orders…</td></tr>:filtered.map(o=>{
          const prod=(productionMap[o.id]||[]);const hasProd=prod.some(s=>activeProductionStatuses.has(norm(s)));const isCustom=customOrders.has(o.id)
          return <tr key={o.id} className={selected.has(o.id)?'selected':''}><td className="checkCol"><input type="checkbox" checked={selected.has(o.id)} onChange={()=>toggleOne(o.id)} aria-label={`Select ${o.order_number}`}/></td><td><Link className="orderNumber" href={`/admin/orders/${o.id}`}>{o.order_number}</Link><span className="ordersSub">{o.order_source?label(o.order_source):'Website'}{o.po_number?` · PO ${o.po_number}`:''}</span></td><td><b>{customerName(o)}</b><span className="ordersSub">{customerPhone(o)||o.gstin||'—'}</span></td><td><div className="orderTypeTags">{o.business_purchase&&<span>GST</span>}{isCustom&&<span className="custom">Custom</span>}{!o.business_purchase&&!isCustom&&<span className="neutral">Standard</span>}</div></td><td><span className={`statusPill status-${o.status}`}>{label(o.status)}</span>{hasProd&&<span className="ordersProductionTag"><Factory size={11}/> Production</span>}</td><td><span className={`paymentBadge payment-${o.payment_status}`}>{label(o.payment_status)}</span><span className="ordersSub">{o.payment_method?label(o.payment_method):'—'}</span></td><td>{itemCounts[o.id]||0}</td><td><b>{money(o.grand_total)}</b></td><td><span>{new Date(o.created_at).toLocaleDateString('en-IN')}</span><span className="ordersSub">{new Date(o.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span></td><td><Link className="ordersOpen" href={`/admin/orders/${o.id}`} aria-label={`Open ${o.order_number}`}><ChevronRight size={17}/></Link></td></tr>
        })}
        {!loading&&!filtered.length&&<tr><td colSpan={10} className="ordersEmpty"><FileSpreadsheet size={28}/><b>No orders match these filters.</b><span>Change the filters or reset the view.</span></td></tr>}
      </tbody></table></div>
      <div className="ordersFooter"><span>Showing <b>{filtered.length}</b> of <b>{rows.length}</b> orders</span><span>Values shown in INR</span></div>
    </section>
  </div>
}

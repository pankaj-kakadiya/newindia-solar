'use client'

import {useEffect,useMemo,useState} from 'react'
import {useParams} from 'next/navigation'
import Link from 'next/link'
import {ArrowLeft,Factory,Save,Printer,MapPin,UserRound,CreditCard,Building2,History,Package,FileText,CheckCircle2,AlertTriangle,ExternalLink} from 'lucide-react'
import {supabase} from '../../../../lib/supabase'

const orderStatuses=['pending','confirmed','processing','ready_to_ship','shipped','delivered','cancelled','refunded']
const paymentStatuses=['pending','paid','failed','refunded','partially_refunded']
const normalFlow=['pending','confirmed','processing','ready_to_ship','shipped','delivered']

function money(v:any){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`}
function title(v:any){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function fmtDate(v:any){return v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'}
function addrLines(addr:any){if(!addr)return [];return [addr.address_line1||addr.address,addr.address_line2,[addr.city,addr.postal_code||addr.pincode].filter(Boolean).join(' '),addr.state,addr.country||'India'].filter(Boolean)}

export default function OrderDetail(){
  const {id}=useParams<{id:string}>()
  const [o,setO]=useState<any>(null)
  const [items,setItems]=useState<any[]>([])
  const [jobs,setJobs]=useState<any[]>([])
  const [history,setHistory]=useState<any[]>([])
  const [payments,setPayments]=useState<any[]>([])
  const [status,setStatus]=useState('')
  const [paymentStatus,setPaymentStatus]=useState('')
  const [note,setNote]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')

  async function load(){
    setLoading(true)
    const [{data:od,error},{data:it},{data:j},{data:h},{data:p}]=await Promise.all([
      supabase.from('orders').select('*').eq('id',id).single(),
      supabase.from('order_items').select('*').eq('order_id',id).order('created_at'),
      supabase.from('production_jobs').select('*').eq('order_id',id).order('created_at'),
      supabase.from('order_status_history').select('*').eq('order_id',id).order('created_at',{ascending:false}),
      supabase.from('payments').select('*').eq('order_id',id).order('created_at',{ascending:false})
    ])
    if(error){setMessage(error.message);setLoading(false);return}
    setO(od);setItems(it||[]);setJobs(j||[]);setHistory(h||[]);setPayments(p||[]);setStatus(od?.status||'');setPaymentStatus(od?.payment_status||'');setNote(od?.admin_notes||'');setLoading(false)
  }

  useEffect(()=>{load()},[id])

  const hasCustom=items.some(i=>i.item_type==='custom')
  const addr=o?.shipping_address||{}
  const bill=o?.billing_address||{}
  const progressIndex=normalFlow.indexOf(status)
  const totals=useMemo(()=>({qty:items.reduce((a,i)=>a+Number(i.quantity||0),0),tax:items.reduce((a,i)=>a+Number(i.tax_amount||0),0)}),[items])

  async function save(){
    if(!o)return
    setBusy(true);setMessage('')
    const oldStatus=o.status,oldPayment=o.payment_status
    const patch:any={status,payment_status:paymentStatus,admin_notes:note}
    const now=new Date().toISOString()
    if(status==='confirmed'&&!o.confirmed_at)patch.confirmed_at=now
    if(status==='shipped'&&!o.shipped_at)patch.shipped_at=now
    if(status==='delivered'&&!o.delivered_at)patch.delivered_at=now
    const {error}=await supabase.from('orders').update(patch).eq('id',id)
    if(error){setMessage(error.message);setBusy(false);return}
    if(oldStatus!==status){
      const {data:{user}}=await supabase.auth.getUser()
      await supabase.from('order_status_history').insert({order_id:id,from_status:oldStatus,to_status:status,note:note?`Admin update: ${note.slice(0,180)}`:'Status changed from order control center',changed_by:user?.id||null})
    }
    setMessage(oldPayment!==paymentStatus?'Order and payment status updated.':'Order updated.')
    await load();setBusy(false)
  }

  if(loading)return <div className="adminLoading">Loading order control center…</div>
  if(!o)return <div className="orderNotFound"><AlertTriangle/><h2>Order not found</h2><p>{message||'This order could not be loaded.'}</p><Link href="/admin/orders">Back to orders</Link></div>

  return <div className="orderDetailV2">
    <div className="adminPageHead orderDetailHead"><div><Link className="adminBack" href="/admin/orders"><ArrowLeft size={15}/> Orders</Link><span className="adminEyebrow">ORDER CONTROL CENTER</span><div className="orderTitleLine"><h1>{o.order_number}</h1><span className={`statusPill status-${o.status}`}>{title(o.status)}</span>{hasCustom&&<span className="orderCustomBadge">Custom Build</span>}</div><p>Placed {fmtDate(o.created_at)} · {o.order_source?title(o.order_source):'Website'} order</p></div><div className="orderDetailActions"><button className="ordersGhostBtn" onClick={()=>window.print()}><Printer size={15}/> Print</button><button className="adminPrimary" onClick={save} disabled={busy}><Save size={16}/>{busy?'Saving…':'Save Changes'}</button></div></div>

    {message&&<div className="ordersMessage">{message}</div>}

    <section className={`orderFlow ${['cancelled','refunded'].includes(status)?'exception':''}`}>
      {['cancelled','refunded'].includes(status)?<div className="orderException"><AlertTriangle size={18}/><b>{title(status)} order</b><span>The normal fulfilment flow is stopped for this order.</span></div>:normalFlow.map((s,idx)=><div key={s} className={idx<progressIndex?'done':idx===progressIndex?'current':''}><span>{idx<progressIndex?<CheckCircle2 size={16}/>:idx+1}</span><p><b>{title(s)}</b><small>{idx<progressIndex?'Completed':idx===progressIndex?'Current stage':'Upcoming'}</small></p></div>)}
    </section>

    <div className="orderControlGrid">
      <section className="orderControlCard"><div className="orderControlCardIcon"><Package size={18}/></div><div><small>Fulfilment status</small><select value={status} onChange={e=>setStatus(e.target.value)}>{orderStatuses.map(s=><option key={s} value={s}>{title(s)}</option>)}</select></div></section>
      <section className="orderControlCard"><div className="orderControlCardIcon payment"><CreditCard size={18}/></div><div><small>Payment status</small><select value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)}>{paymentStatuses.map(s=><option key={s} value={s}>{title(s)}</option>)}</select></div></section>
      <section className="orderControlCard"><div className="orderControlCardIcon business"><Building2 size={18}/></div><div><small>Purchase type</small><b>{o.business_purchase?'GST Business':'Individual'}</b><span>{o.gstin||'No GSTIN'}</span></div></section>
      <section className="orderControlCard"><div className="orderControlCardIcon factory"><Factory size={18}/></div><div><small>Production</small><b>{jobs.length?`${jobs.length} job${jobs.length===1?'':'s'}`:'Not required'}</b><span>{jobs.length?jobs.map(j=>title(j.status)).join(' · '):hasCustom?'Awaiting production job':'Standard order'}</span></div></section>
    </div>

    <div className="orderDetailGrid">
      <div className="orderDetailMain">
        <section className="adminPanel orderItemsPanel"><div className="adminPanelHead"><div><h2>Order items</h2><p>Frozen commercial and configuration snapshots from checkout.</p></div><span className="orderItemCount">{totals.qty} total qty</span></div>
          {items.length?items.map(i=><article className="orderItemV2" key={i.id}><div className="orderItemMain"><div className="orderItemTop"><span className={`itemType ${i.item_type}`}>{i.item_type==='custom'?'Custom ACDB/DCDB':'Standard Product'}</span><span>Qty {Number(i.quantity||0)}</span></div><h3>{i.name_snapshot||'Configured Solar Assembly'}</h3><p>{i.sku_snapshot||'Custom configured build'}</p><div className="orderItemMath"><span>{money(i.unit_price)} × {Number(i.quantity||0)}</span><span>GST {Number(i.gst_rate||0)}% · {money(i.tax_amount)}</span></div>{i.item_type==='custom'&&i.configuration_snapshot&&<details className="configurationDetail"><summary>View locked configuration snapshot</summary><div><pre>{JSON.stringify(i.configuration_snapshot,null,2)}</pre></div></details>}</div><div className="orderItemTotal"><small>Line total</small><b>{money(i.line_total)}</b></div></article>):<div className="ordersEmpty">No order items found.</div>}
        </section>

        {jobs.length>0&&<section className="adminPanel"><div className="adminPanelHead"><div><h2>Production jobs</h2><p>Assembly and QC workflow linked to this order.</p></div><Link href="/admin/production"><Factory size={15}/> Production board <ExternalLink size={12}/></Link></div><div className="productionJobList">{jobs.map(j=><article className="productionJobCard" key={j.id}><div className="productionJobIcon"><Factory size={18}/></div><div><b>{j.job_number}</b><span>{j.product_name||'Custom assembly'} · Qty {Number(j.quantity||0)}</span><small>{j.due_date?`Due ${new Date(j.due_date).toLocaleDateString('en-IN')}`:'No due date'} · Priority {title(j.priority||'normal')}</small></div><span className={`statusPill status-${j.status}`}>{title(j.status)}</span></article>)}</div></section>}

        <section className="adminPanel"><div className="adminPanelHead"><div><h2>Internal notes</h2><p>Private operational notes visible only to authorized admin/staff.</p></div></div><textarea className="adminTextarea orderNotes" rows={5} value={note} onChange={e=>setNote(e.target.value)} placeholder="Payment follow-up, customer commitment, dispatch instruction, production note…"/><div className="orderNotesActions"><span>Saved together with order status changes.</span><button className="adminPrimary" onClick={save} disabled={busy}><Save size={15}/> Save notes</button></div></section>

        <section className="adminPanel orderHistoryPanel"><div className="adminPanelHead"><div><h2>Status timeline</h2><p>Recorded fulfilment changes for this order.</p></div><History size={18}/></div><div className="orderTimeline"><div className="orderTimelineItem created"><span></span><div><b>Order created</b><p>Order entered New India Solar operations.</p><small>{fmtDate(o.created_at)}</small></div></div>{history.map(h=><div className="orderTimelineItem" key={h.id}><span></span><div><b>{title(h.from_status||'Created')} → {title(h.to_status)}</b>{h.note&&<p>{h.note}</p>}<small>{fmtDate(h.created_at)}</small></div></div>)}</div></section>
      </div>

      <aside className="orderDetailAside">
        <section className="adminPanel compact orderSummaryCard"><h2>Order summary</h2><div className="summaryRows"><div><span>Subtotal</span><b>{money(o.subtotal)}</b></div>{Number(o.discount_amount||0)>0&&<div><span>Discount</span><b>-{money(o.discount_amount)}</b></div>}<div><span>GST</span><b>{money(o.tax_amount)}</b></div><div><span>Shipping</span><b>{money(o.shipping_amount)}</b></div><div className="grand"><span>Grand total</span><b>{money(o.grand_total)}</b></div></div><div className={`orderPaymentState payment-${o.payment_status}`}><CreditCard size={15}/><div><small>Payment</small><b>{title(o.payment_status)}</b><span>{o.payment_method?title(o.payment_method):'Method not selected'}</span></div></div></section>

        <section className="adminPanel compact orderPersonCard"><div className="orderAsideTitle"><UserRound size={17}/><h2>Customer</h2></div><b className="orderAsidePrimary">{o.company_name||o.customer_snapshot?.name||o.customer_snapshot?.full_name||'Customer'}</b><p>{o.customer_snapshot?.phone||o.customer_snapshot?.mobile||'No phone'}<br/>{o.customer_snapshot?.email||'No email'}</p>{o.business_purchase&&<div className="businessMeta"><span>Company <b>{o.company_name||'—'}</b></span><span>GSTIN <b>{o.gstin||'—'}</b></span><span>PO number <b>{o.po_number||'—'}</b></span></div>}</section>

        <section className="adminPanel compact"><div className="orderAsideTitle"><MapPin size={17}/><h2>Shipping address</h2></div><p className="addressLines">{addrLines(addr).map((x:string,i:number)=><span key={i}>{x}</span>)}</p>{addrLines(addr).length===0&&<p className="muted">No shipping address saved.</p>}</section>

        {Object.keys(bill||{}).length>0&&<section className="adminPanel compact"><div className="orderAsideTitle"><FileText size={17}/><h2>Billing address</h2></div><p className="addressLines">{addrLines(bill).map((x:string,i:number)=><span key={i}>{x}</span>)}</p></section>}

        <section className="adminPanel compact"><div className="orderAsideTitle"><CreditCard size={17}/><h2>Payment records</h2></div>{payments.length?payments.map(p=><div className="paymentRecord" key={p.id}><div><b>{money(p.amount)}</b><span>{title(p.provider||p.payment_method||'Payment')}</span></div><span className={`paymentBadge payment-${p.status}`}>{title(p.status)}</span><small>{fmtDate(p.created_at)}</small></div>):<p className="muted">No gateway/payment ledger entries yet.</p>}</section>
      </aside>
    </div>
  </div>
}

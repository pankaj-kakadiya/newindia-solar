'use client'
import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useEffect,useState} from 'react'
import {buyerFetch} from '../../../../lib/buyer-client'
import {buyerDocument,downloadDocument,printDocument} from '../../../../lib/buyer-document'
import {useCart,type CartItem} from '../../../../components/CartProvider'
import StoreHeader from '../../../../components/StoreHeader'
import StoreFooter from '../../../../components/StoreFooter'
const money=(n:any)=>`₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const title=(s:any)=>String(s||'Pending').replaceAll('_',' ')
export default function BuyerOrder(){
 const {id}=useParams<{id:string}>(),cart=useCart(),[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<any>(null)
 async function load(){setError('');try{setData(await buyerFetch(`orders/${id}`))}catch(e:any){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[id])
 async function repeat(){
  setBusy(true);setError('')
  try{
   const r=await buyerFetch(`orders/${id}`,{method:'POST'})
   // Best-effort: one item failing a fresh stock/price check must not stop the rest from being added.
   const notAdded=[...r.notAdded],added:any[]=[]
   for(const entry of r.items){const {maxQty,...item}=entry as CartItem&{maxQty?:number}
    const outcome=cart.addChecked(item,maxQty)
    if(outcome.ok)added.push(item);else notAdded.push(`${item.name}: ${outcome.error}`)
   }
   setResult({items:added,notAdded})
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 function documentAction(invoice:any,print=false){try{const html=buyerDocument(data,invoice);if(print)printDocument(html);else downloadDocument(html,invoice?.invoice_number||data.order.order_number)}catch(e:any){setError(e.message)}}
 return <><StoreHeader/><main className="container buyerAccount"><Link href="/account">← My account</Link>{loading?<p>Loading order…</p>:<>{error&&<div role="alert" className="buyerMessage">{error} <button onClick={load}>Retry</button> <Link href={`/login?next=/account/orders/${id}`}>Sign in</Link></div>}{data&&<><header className="buyerHead"><div><span className="eyebrow darkEye">YOUR ORDER</span><h1>{data.order.order_number}</h1><p>Placed {new Date(data.order.created_at).toLocaleDateString('en-IN')}</p></div><button onClick={load}>Refresh status</button></header><section className="buyerCard"><h2>Order tracking</h2><p><strong>{title(data.order.status)}</strong> · Payment: {title(data.order.payment_status)}</p><ol className="buyerTimeline">{[['Placed',data.order.created_at],['Confirmed',data.order.confirmed_at],['Shipped',data.order.shipped_at],['Delivered',data.order.delivered_at]].map(([label,date])=><li key={label} className={date?'done':''}><b>{label}</b><span>{date?new Date(date).toLocaleString('en-IN'):'Not yet recorded'}</span></li>)}</ol>{data.shipments.length?data.shipments.map((s:any)=><article className="buyerAddress" key={s.id}><b>{s.courier_name||'Courier being assigned'}</b><p>AWB: {s.awb_code||'Awaiting dispatch'} · {title(s.status)}</p>{s.tracking_url&&<a href={s.tracking_url} target="_blank" rel="noopener noreferrer">Track with courier →</a>}</article>):<p>Courier tracking will appear after dispatch details are added.</p>}</section><section className="buyerCard"><h2>Ordered items</h2>{data.items.map((i:any)=><article className="buyerOrderRow" key={i.id}><div><b>{i.name_snapshot}</b><p>{i.sku_snapshot}</p></div><div>Qty {i.quantity}<p>{money(i.unit_price)} each · GST {i.gst_rate}%</p></div><strong>{money(i.line_total)}</strong></article>)}<p>Subtotal: {money(data.order.subtotal)} · GST: {money(data.order.tax_amount)} · Shipping: {money(data.order.shipping_amount)}</p><h3>Total {money(data.order.grand_total)}</h3><div className="buyerActions"><button disabled={busy||!!result} onClick={repeat}>{busy?'Checking current products…':result?'Added available items':'Repeat order'}</button><button onClick={()=>documentAction(null)}>Download order (.html)</button><button onClick={()=>documentAction(null,true)}>Print / Save PDF</button></div><p className="buyerHint">Repeat order adds available items to your cart at current prices. Review quantities and checkout to place a new order.</p>{result&&<div role="status"><p>{result.items.length} items added. <Link href="/cart">Review cart →</Link></p>{result.notAdded.map((s:string,i:number)=><p key={i}>{s}</p>)}</div>}</section><section className="buyerCard"><h2>Invoices</h2>{!data.invoices.length?<p>Your invoice will appear here after it is issued.</p>:data.invoices.map((i:any)=><article className="buyerOrderRow" key={i.id}><div><b>{i.invoice_number}</b><p>{title(i.document_type)} · {i.invoice_date}</p></div><strong>{money(i.grand_total)}</strong><div className="buyerActions"><button onClick={()=>documentAction(i)}>Download invoice (.html)</button><button onClick={()=>documentAction(i,true)}>View / Save PDF</button></div></article>)}</section><section className="buyerCard"><h2>Shipping & GST details</h2><p>{data.order.shipping_address?.full_name}<br/>{data.order.shipping_address?.address_line1}<br/>{data.order.shipping_address?.address_line2}<br/>{data.order.shipping_address?.city}, {data.order.shipping_address?.state} – {data.order.shipping_address?.postal_code}</p>{data.order.company_name&&<p>{data.order.company_name}<br/>GSTIN: {data.order.gstin}</p>}</section></>}</>}</main><StoreFooter/></>
}

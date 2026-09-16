'use client'

import {useEffect,useMemo,useState} from 'react'
import {BarChart3,CalendarDays,Download,FileSpreadsheet,IndianRupee,PackageSearch,RefreshCw,TrendingUp,Users,Warehouse,Factory,ReceiptText,BriefcaseBusiness,Printer} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

type Tab='overview'|'sales'|'customers'|'operations'|'finance'
const money=(n:any)=>`₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`
const num=(n:any)=>Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})
const pct=(n:any)=>`${Number(n||0).toFixed(1)}%`
const iso=(d:Date)=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
const today=()=>iso(new Date())
const daysAgo=(n:number)=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d)}

function exportCsv(filename:string,rows:any[]){
 if(!rows.length)return
 const cols=Object.keys(rows[0])
 const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`
 const csv=[cols.map(esc).join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n')
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)
}

export default function ReportsPage(){
 const [from,setFrom]=useState(daysAgo(29)),[to,setTo]=useState(today()),[tab,setTab]=useState<Tab>('overview'),[loading,setLoading]=useState(true),[msg,setMsg]=useState('')
 const [summary,setSummary]=useState<any>({}),[daily,setDaily]=useState<any[]>([]),[products,setProducts]=useState<any[]>([]),[customers,setCustomers]=useState<any[]>([]),[rfq,setRfq]=useState<any[]>([]),[production,setProduction]=useState<any[]>([]),[procurement,setProcurement]=useState<any[]>([]),[inventory,setInventory]=useState<any[]>([]),[ageing,setAgeing]=useState<any[]>([])

 async function load(){
  if(from>to){setMsg('Start date cannot be after end date.');return}
  setLoading(true);setMsg('')
  const [a,b,c,d,e,f,g,h,i]=await Promise.all([
   supabase.rpc('reporting_ceo_summary',{p_from:from,p_to:to}),
   supabase.rpc('reporting_sales_daily',{p_from:from,p_to:to}),
   supabase.rpc('reporting_product_performance',{p_from:from,p_to:to,p_limit:100}),
   supabase.rpc('reporting_customer_ltv',{p_from:from,p_to:to,p_limit:100}),
   supabase.rpc('reporting_rfq_pipeline',{p_from:from,p_to:to}),
   supabase.rpc('reporting_production',{p_from:from,p_to:to}),
   supabase.rpc('reporting_procurement',{p_from:from,p_to:to,p_limit:100}),
   supabase.rpc('reporting_inventory_snapshot'),
   supabase.rpc('reporting_receivable_ageing')
  ])
  const errs=[a,b,c,d,e,f,g,h,i].map(x=>x.error).filter(Boolean)
  if(errs.length){setMsg(errs[0]?.message||'Could not load reports.');setLoading(false);return}
  setSummary(a.data||{});setDaily(b.data||[]);setProducts(c.data||[]);setCustomers(d.data||[]);setRfq(e.data||[]);setProduction(f.data||[]);setProcurement(g.data||[]);setInventory(h.data||[]);setAgeing(i.data||[]);setLoading(false)
 }
 useEffect(()=>{load()},[])

 const maxDaily=Math.max(1,...daily.map(r=>Math.max(Number(r.booked_sales||0),Number(r.collections||0))))
 const inventoryValue=inventory.reduce((a,r)=>a+Number(r.stock_value||0),0)
 const lowInventory=inventory.filter(r=>r.status!=='healthy')
 const totalAgeing=ageing.reduce((a,r)=>a+Number(r.amount||0),0)
 const signals=useMemo(()=>{
  const s:string[]=[]
  if(Number(summary.low_stock_items||0)>0)s.push(`${summary.low_stock_items} inventory item(s) are at or below reorder level.`)
  if(Number(summary.receivables||0)>0)s.push(`${money(summary.receivables)} is currently outstanding from customers.`)
  if(Number(summary.rfq_pipeline_value||0)>0)s.push(`${money(summary.rfq_pipeline_value)} is sitting in the open RFQ pipeline.`)
  if(Number(summary.estimated_standard_margin_pct||0)>0&&Number(summary.estimated_standard_margin_pct)<15)s.push(`Estimated standard-product margin is ${pct(summary.estimated_standard_margin_pct)}, below the current pricing floor.`)
  if(!s.length)s.push('No critical management exception is visible for the selected period.')
  return s
 },[summary])

 function preset(kind:string){
  const now=new Date();let start=new Date(now)
  if(kind==='7')start.setDate(now.getDate()-6)
  if(kind==='30')start.setDate(now.getDate()-29)
  if(kind==='90')start.setDate(now.getDate()-89)
  if(kind==='mtd')start=new Date(now.getFullYear(),now.getMonth(),1)
  if(kind==='ytd')start=new Date(now.getFullYear(),0,1)
  setFrom(iso(start));setTo(iso(now));setTimeout(load,0)
 }

 function exportMis(){
  exportCsv(`NIS-MIS-${from}-to-${to}.csv`,[
   {Metric:'Booked Sales',Value:summary.booked_sales},{Metric:'Net Sales After Credits',Value:summary.net_sales_after_credits},{Metric:'Orders',Value:summary.orders},{Metric:'AOV',Value:summary.aov},{Metric:'Collections',Value:summary.collections},{Metric:'Receivables',Value:summary.receivables},{Metric:'GST Tax',Value:summary.gst_tax},{Metric:'Estimated Standard Gross Profit',Value:summary.estimated_standard_gross_profit},{Metric:'Estimated Standard Margin %',Value:summary.estimated_standard_margin_pct},{Metric:'New Customers',Value:summary.new_customers},{Metric:'RFQ Conversion %',Value:summary.rfq_conversion_pct},{Metric:'RFQ Pipeline Value',Value:summary.rfq_pipeline_value},{Metric:'Production Completed',Value:summary.production_completed},{Metric:'Average Production Hours',Value:summary.production_avg_hours},{Metric:'Inventory Value',Value:summary.inventory_value},{Metric:'Low Stock Items',Value:summary.low_stock_items},{Metric:'Purchase Commitment',Value:summary.purchase_commitment}
  ])
 }

 return <div className="reportsV2">
  <div className="reportsHero"><div><span className="adminEyebrow">MANAGEMENT INFORMATION SYSTEM</span><h1>Reports & Analytics</h1><p>CEO-level sales, margin, GST, customer, RFQ, production, inventory, procurement and cash-performance reporting from one live workspace.</p></div><div className="reportsHeroActions"><button className="adminBtn ghost" onClick={()=>window.print()}><Printer size={16}/>Print MIS</button><button className="adminBtn" onClick={exportMis}><FileSpreadsheet size={16}/>Export MIS CSV</button></div></div>

  <section className="reportsRange adminPanel"><div className="reportsRangeInputs"><label><span>From</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><span>To</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="adminBtn" onClick={load} disabled={loading}><RefreshCw size={16}/>{loading?'Loading…':'Apply'}</button></div><div className="reportsPresets"><button onClick={()=>preset('7')}>7D</button><button onClick={()=>preset('30')}>30D</button><button onClick={()=>preset('90')}>90D</button><button onClick={()=>preset('mtd')}>MTD</button><button onClick={()=>preset('ytd')}>YTD</button></div></section>
  {msg&&<div className="themeMessage danger">{msg}</div>}

  <div className="reportsStats">
   <div><span>Booked Sales</span><b>{money(summary.booked_sales)}</b><small>{num(summary.orders)} orders · AOV {money(summary.aov)}</small></div>
   <div><span>Cash Collected</span><b>{money(summary.collections)}</b><small>Paid receipts in selected period</small></div>
   <div className={Number(summary.receivables)>0?'warn':''}><span>Receivables</span><b>{money(summary.receivables)}</b><small>Outstanding across active orders</small></div>
   <div><span>Est. Gross Profit</span><b>{money(summary.estimated_standard_gross_profit)}</b><small>{pct(summary.estimated_standard_margin_pct)} on standard-product sales</small></div>
   <div><span>GST on Invoices</span><b>{money(summary.gst_tax)}</b><small>CGST + SGST + IGST issued</small></div>
   <div><span>Inventory Value</span><b>{money(summary.inventory_value||inventoryValue)}</b><small>{summary.low_stock_items||lowInventory.length} low/out-of-stock items</small></div>
  </div>

  <div className="reportsTabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><BarChart3 size={16}/>CEO MIS</button><button className={tab==='sales'?'active':''} onClick={()=>setTab('sales')}><TrendingUp size={16}/>Sales & Margin</button><button className={tab==='customers'?'active':''} onClick={()=>setTab('customers')}><Users size={16}/>Customers & RFQ</button><button className={tab==='operations'?'active':''} onClick={()=>setTab('operations')}><Factory size={16}/>Operations</button><button className={tab==='finance'?'active':''} onClick={()=>setTab('finance')}><ReceiptText size={16}/>GST & Finance</button></div>

  {tab==='overview'&&<div className="reportsOverviewGrid">
   <section className="adminPanel reportsWide"><div className="reportsSectionHead"><div><TrendingUp size={18}/><div><h2>Sales vs Collections</h2><p>Daily booked order value compared with cash actually received.</p></div></div><button className="adminBtn tiny ghost" onClick={()=>exportCsv(`sales-daily-${from}-${to}.csv`,daily)}><Download size={14}/>CSV</button></div><div className="reportsChart">{daily.length?daily.map((r,idx)=><div className="reportsBarDay" key={r.day}><div className="reportsBarPair"><span className="sales" style={{height:`${Math.max(2,Number(r.booked_sales||0)/maxDaily*100)}%`}} title={`Sales ${money(r.booked_sales)}`}/><span className="cash" style={{height:`${Math.max(2,Number(r.collections||0)/maxDaily*100)}%`}} title={`Collections ${money(r.collections)}`}/></div>{(idx===0||idx===daily.length-1||idx%Math.max(1,Math.floor(daily.length/5))===0)&&<small>{String(r.day).slice(5)}</small>}</div>):<div className="reportsEmpty">No daily sales in this period.</div>}</div><div className="reportsLegend"><span><i className="sales"/>Booked sales</span><span><i className="cash"/>Collections</span></div></section>
   <section className="adminPanel"><div className="reportsSectionHead"><div><BriefcaseBusiness size={18}/><div><h2>Management Signals</h2><p>Automatic exceptions requiring attention.</p></div></div></div><div className="reportsSignals">{signals.map((s,i)=><div key={i}><b>{i+1}</b><span>{s}</span></div>)}</div></section>
   <section className="adminPanel"><div className="reportsSectionHead"><div><BarChart3 size={18}/><div><h2>Commercial Funnel</h2><p>RFQ and customer-growth performance.</p></div></div></div><div className="reportsMiniMetrics"><div><span>New Customers</span><b>{num(summary.new_customers)}</b></div><div><span>RFQs Created</span><b>{num(summary.rfqs)}</b></div><div><span>RFQs Won</span><b>{num(summary.rfq_won)}</b></div><div><span>Conversion</span><b>{pct(summary.rfq_conversion_pct)}</b></div><div><span>Open Pipeline</span><b>{money(summary.rfq_pipeline_value)}</b></div><div><span>Won Value</span><b>{money(summary.rfq_won_value)}</b></div></div></section>
   <section className="adminPanel"><div className="reportsSectionHead"><div><Factory size={18}/><div><h2>Operations Snapshot</h2><p>Production and purchasing performance.</p></div></div></div><div className="reportsMiniMetrics"><div><span>Production Completed</span><b>{num(summary.production_completed)}</b></div><div><span>Avg TAT</span><b>{num(summary.production_avg_hours)} h</b></div><div><span>Purchase Commitment</span><b>{money(summary.purchase_commitment)}</b></div><div><span>Low Stock</span><b>{num(summary.low_stock_items)}</b></div></div></section>
  </div>}

  {tab==='sales'&&<div className="reportsStack">
   <section className="adminPanel"><div className="reportsSectionHead"><div><IndianRupee size={18}/><div><h2>Sales & Margin Summary</h2><p>Margin uses current product cost for standard product lines; custom-build BOM cost is not treated as a verified historical cost snapshot.</p></div></div></div><div className="reportsMiniMetrics six"><div><span>Booked Sales</span><b>{money(summary.booked_sales)}</b></div><div><span>Credits</span><b>{money(summary.credit_notes)}</b></div><div><span>Net After Credits</span><b>{money(summary.net_sales_after_credits)}</b></div><div><span>Std Product Revenue</span><b>{money(summary.estimated_standard_revenue)}</b></div><div><span>Est. Std Cost</span><b>{money(summary.estimated_standard_cost)}</b></div><div><span>Est. Margin</span><b>{pct(summary.estimated_standard_margin_pct)}</b></div></div></section>
   <section className="adminPanel"><div className="reportsSectionHead"><div><PackageSearch size={18}/><div><h2>Product Performance</h2><p>Ranked by ex-GST sales for the selected period.</p></div></div><button className="adminBtn tiny ghost" onClick={()=>exportCsv(`product-performance-${from}-${to}.csv`,products)}><Download size={14}/>CSV</button></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Product / SKU</th><th>Qty</th><th>Net Sales</th><th>Est. Cost</th><th>Est. Gross Profit</th><th>Est. Margin</th></tr></thead><tbody>{products.length?products.map((r,i)=><tr key={`${r.sku}-${i}`}><td><b>{r.name}</b><span className="tableSub">{r.sku}</span></td><td>{num(r.qty)}</td><td>{money(r.net_sales)}</td><td>{money(r.estimated_cost)}</td><td>{money(r.estimated_gross_profit)}</td><td>{pct(r.estimated_margin_pct)}</td></tr>):<tr><td colSpan={6} className="emptyCell">No product sales in this period.</td></tr>}</tbody></table></div></section>
  </div>}

  {tab==='customers'&&<div className="reportsStack">
   <section className="adminPanel"><div className="reportsSectionHead"><div><Users size={18}/><div><h2>Customer Lifetime Value</h2><p>Lifetime sales plus selected-period contribution for linked CRM customers.</p></div></div><button className="adminBtn tiny ghost" onClick={()=>exportCsv(`customer-ltv-${from}-${to}.csv`,customers)}><Download size={14}/>CSV</button></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Customer</th><th>Type</th><th>Period Orders</th><th>Period Sales</th><th>Lifetime Orders</th><th>Lifetime Sales</th><th>Last Order</th></tr></thead><tbody>{customers.length?customers.map(r=><tr key={r.customer_id}><td><b>{r.company_name||r.customer_name||'Customer'}</b><span className="tableSub">{r.company_name&&r.customer_name?r.customer_name:''}</span></td><td>{r.customer_type||'—'}</td><td>{num(r.period_orders)}</td><td>{money(r.period_sales)}</td><td>{num(r.lifetime_orders)}</td><td><b>{money(r.lifetime_sales)}</b></td><td>{r.last_order_at?new Date(r.last_order_at).toLocaleDateString('en-IN'):'—'}</td></tr>):<tr><td colSpan={7} className="emptyCell">No linked CRM customer sales yet.</td></tr>}</tbody></table></div></section>
   <section className="adminPanel"><div className="reportsSectionHead"><div><BriefcaseBusiness size={18}/><div><h2>RFQ Pipeline & Conversion</h2><p>RFQs created during the selected period, grouped by current stage.</p></div></div><button className="adminBtn tiny ghost" onClick={()=>exportCsv(`rfq-pipeline-${from}-${to}.csv`,rfq)}><Download size={14}/>CSV</button></div><div className="reportsPipeline">{rfq.length?rfq.map(r=><div key={r.status}><span>{String(r.status).replaceAll('_',' ')}</span><b>{r.rfqs}</b><small>{money(r.estimated_value)} est. · {money(r.quoted_value)} quoted</small></div>):<div className="reportsEmpty">No RFQs in this period.</div>}</div></section>
  </div>}

  {tab==='operations'&&<div className="reportsStack">
   <section className="reportsSplit"><div className="adminPanel"><div className="reportsSectionHead"><div><Factory size={18}/><div><h2>Production TAT</h2><p>Jobs created in the selected period by current stage.</p></div></div><button className="adminBtn tiny ghost" onClick={()=>exportCsv(`production-${from}-${to}.csv`,production)}><Download size={14}/>CSV</button></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Status</th><th>Jobs</th><th>Qty</th><th>Avg TAT</th></tr></thead><tbody>{production.length?production.map(r=><tr key={r.status}><td><b>{String(r.status).replaceAll('_',' ')}</b></td><td>{r.jobs}</td><td>{num(r.quantity)}</td><td>{num(r.avg_turnaround_hours)} h</td></tr>):<tr><td colSpan={4} className="emptyCell">No production activity.</td></tr>}</tbody></table></div></div>
   <div className="adminPanel"><div className="reportsSectionHead"><div><Warehouse size={18}/><div><h2>Inventory Health</h2><p>Current stock valuation and reorder risk.</p></div></div><button className="adminBtn tiny ghost" onClick={()=>exportCsv('inventory-snapshot.csv',inventory)}><Download size={14}/>CSV</button></div><div className="reportsMiniMetrics"><div><span>Stock Value</span><b>{money(inventoryValue)}</b></div><div><span>Active SKUs</span><b>{inventory.length}</b></div><div><span>Low / Out</span><b>{lowInventory.length}</b></div></div><div className="reportsRiskList">{lowInventory.slice(0,8).map((r,i)=><div key={`${r.item_type}-${r.sku}-${i}`}><span><b>{r.item_name}</b><small>{r.item_type} · {r.sku||'No SKU'}</small></span><strong>{num(r.stock_qty)}</strong></div>)}{!lowInventory.length&&<div className="reportsEmpty">No low-stock exception.</div>}</div></div></section>
   <section className="adminPanel"><div className="reportsSectionHead"><div><BriefcaseBusiness size={18}/><div><h2>Procurement Performance</h2><p>Purchase-order commitment and goods-receipt quality by supplier.</p></div></div><button className="adminBtn tiny ghost" onClick={()=>exportCsv(`procurement-${from}-${to}.csv`,procurement)}><Download size={14}/>CSV</button></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Supplier</th><th>POs</th><th>PO Value</th><th>Accepted Qty</th><th>Rejected Qty</th></tr></thead><tbody>{procurement.length?procurement.map((r,i)=><tr key={`${r.supplier_name}-${i}`}><td><b>{r.supplier_name}</b></td><td>{r.po_count}</td><td>{money(r.po_value)}</td><td>{num(r.received_qty)}</td><td>{num(r.rejected_qty)}</td></tr>):<tr><td colSpan={5} className="emptyCell">No procurement activity in this period.</td></tr>}</tbody></table></div></section>
  </div>}

  {tab==='finance'&&<div className="reportsStack">
   <section className="adminPanel"><div className="reportsSectionHead"><div><ReceiptText size={18}/><div><h2>GST Summary</h2><p>Issued tax invoices for the selected period.</p></div></div></div><div className="reportsMiniMetrics six"><div><span>Taxable Value</span><b>{money(summary.gst_taxable)}</b></div><div><span>CGST</span><b>{money(summary.cgst)}</b></div><div><span>SGST</span><b>{money(summary.sgst)}</b></div><div><span>IGST</span><b>{money(summary.igst)}</b></div><div><span>Total GST</span><b>{money(summary.gst_tax)}</b></div><div><span>Credit Notes</span><b>{money(summary.credit_notes)}</b></div></div></section>
   <section className="reportsSplit"><div className="adminPanel"><div className="reportsSectionHead"><div><CalendarDays size={18}/><div><h2>Receivable Ageing</h2><p>{money(totalAgeing)} currently outstanding.</p></div></div><button className="adminBtn tiny ghost" onClick={()=>exportCsv('receivable-ageing.csv',ageing)}><Download size={14}/>CSV</button></div><div className="reportsAgeing">{ageing.map(r=>{const width=totalAgeing?Number(r.amount||0)/totalAgeing*100:0;return <div key={r.bucket}><div><span>{r.bucket}</span><b>{money(r.amount)}</b><small>{r.orders} orders</small></div><i><em style={{width:`${width}%`}}/></i></div>})}</div></div><div className="adminPanel"><div className="reportsSectionHead"><div><IndianRupee size={18}/><div><h2>Cash Conversion</h2><p>Booked sales versus cash collections for the selected period.</p></div></div></div><div className="reportsCash"><div><span>Booked Sales</span><b>{money(summary.booked_sales)}</b></div><div><span>Collections</span><b>{money(summary.collections)}</b></div><div><span>Collection / Sales</span><b>{pct(Number(summary.booked_sales)>0?Number(summary.collections)*100/Number(summary.booked_sales):0)}</b></div><div><span>Current Receivables</span><b>{money(summary.receivables)}</b></div></div></div></section>
  </div>}

  <div className="reportsFootnote"><b>Reporting basis:</b> Booked sales exclude cancelled/refunded orders. Collections use paid payment records. GST uses issued non-void tax invoices. Standard-product margin is an estimate based on current variant cost because historical cost snapshots are not yet stored on legacy order lines.</div>
 </div>
}

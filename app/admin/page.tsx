'use client'

import Link from 'next/link'
import {useCallback,useEffect,useMemo,useState} from 'react'
import {
  AlertTriangle,ArrowRight,Boxes,CalendarDays,CheckCircle2,Clock3,Factory,
  FileText,IndianRupee,Package,RefreshCw,ShoppingCart,TrendingDown,TrendingUp,
  UserPlus,Users,Wrench
} from 'lucide-react'
import {supabase} from '../../lib/supabase'

type Order={id:string;order_number:string;status:string;payment_status:string;grand_total:number|string;customer_snapshot:any;created_at:string;order_source?:string|null}
type ProductionJob={id:string;job_number:string;status:string;priority:string|null;due_date:string|null;product_name:string|null;created_at:string}
type Rfq={id:string;name:string|null;company_name:string|null;status:string;quoted_amount:number|string|null;created_at:string}
type Profile={id:string;role:string;created_at:string}
type Variant={id:string;sku:string;title:string|null;stock_qty:number|string;low_stock_threshold:number|string|null}
type Component={id:string;sku:string|null;name:string;stock_qty:number|string;is_active:boolean}
type Enclosure={id:string;sku:string|null;name:string;stock_qty:number|string;is_active:boolean}
type CustomConfig={id:string;configuration_code:string|null;config_name:string|null;status:string;final_price:number|string;created_at:string}
type OrderItem={name_snapshot:string;quantity:number|string;line_total:number|string;created_at:string}
type Product={id:string;name:string;status:string}

type DashboardData={
  orders:Order[];jobs:ProductionJob[];rfqs:Rfq[];profiles:Profile[];variants:Variant[];
  components:Component[];enclosures:Enclosure[];configs:CustomConfig[];items:OrderItem[];products:Product[]
}

const money=(n:number)=>`₹${Math.round(n||0).toLocaleString('en-IN')}`
const num=(v:any)=>Number(v||0)
const dayKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const sameDay=(iso:string,d:Date)=>dayKey(new Date(iso))===dayKey(d)
const sameMonth=(iso:string,d:Date)=>{const x=new Date(iso);return x.getFullYear()===d.getFullYear()&&x.getMonth()===d.getMonth()}
const titleCase=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())

function MetricCard({label,value,sub,icon:Icon,tone='default',trend}:{label:string;value:string|number;sub:string;icon:any;tone?:string;trend?:number|null}){
  return <div className={`dashV2Metric tone-${tone}`}>
    <div className="dashV2MetricTop"><div className="dashV2MetricIcon"><Icon size={18}/></div>{typeof trend==='number'&&<span className={`dashV2Trend ${trend>=0?'up':'down'}`}>{trend>=0?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {Math.abs(trend).toFixed(1)}%</span>}</div>
    <strong>{value}</strong><span>{label}</span><small>{sub}</small>
  </div>
}

function MiniRevenueChart({orders}:{orders:Order[]}){
  const days=useMemo(()=>Array.from({length:30},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(29-i));return d}),[])
  const values=days.map(d=>orders.filter(o=>o.payment_status==='paid'&&sameDay(o.created_at,d)).reduce((s,o)=>s+num(o.grand_total),0))
  const max=Math.max(1,...values)
  const points=values.map((v,i)=>`${(i/(values.length-1))*100},${32-(v/max)*27}`).join(' ')
  const total=values.reduce((a,b)=>a+b,0)
  return <div className="dashV2ChartWrap">
    <div className="dashV2ChartHeadline"><div><small>PAID REVENUE · LAST 30 DAYS</small><strong>{money(total)}</strong></div><span>{values.filter(Boolean).length} active sales days</span></div>
    <div className="dashV2ChartArea"><svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-label="30 day paid revenue trend"><defs><linearGradient id="revFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1d9b54" stopOpacity=".24"/><stop offset="1" stopColor="#1d9b54" stopOpacity="0"/></linearGradient></defs><line x1="0" y1="32" x2="100" y2="32" className="dashV2GridLine"/><polygon points={`0,32 ${points} 100,32`} fill="url(#revFill)"/><polyline points={points} className="dashV2RevenueLine"/></svg></div>
    <div className="dashV2Axis"><span>{days[0].toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span><span>{days[14].toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span><span>Today</span></div>
  </div>
}

export default function AdminDashboard(){
  const [data,setData]=useState<DashboardData>({orders:[],jobs:[],rfqs:[],profiles:[],variants:[],components:[],enclosures:[],configs:[],items:[],products:[]})
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [refreshed,setRefreshed]=useState<Date|null>(null)

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    const [orders,jobs,rfqs,profiles,variants,components,enclosures,configs,items,products]=await Promise.all([
      supabase.from('orders').select('id,order_number,status,payment_status,grand_total,customer_snapshot,created_at,order_source').order('created_at',{ascending:false}).limit(500),
      supabase.from('production_jobs').select('id,job_number,status,priority,due_date,product_name,created_at').order('created_at',{ascending:false}).limit(300),
      supabase.from('bulk_rfqs').select('id,name,company_name,status,quoted_amount,created_at').order('created_at',{ascending:false}).limit(300),
      supabase.from('profiles').select('id,role,created_at').limit(1000),
      supabase.from('product_variants').select('id,sku,title,stock_qty,low_stock_threshold').eq('is_active',true).limit(1000),
      supabase.from('components').select('id,sku,name,stock_qty,is_active').eq('is_active',true).limit(1000),
      supabase.from('enclosures').select('id,sku,name,stock_qty,is_active').eq('is_active',true).limit(500),
      supabase.from('custom_configurations').select('id,configuration_code,config_name,status,final_price,created_at').order('created_at',{ascending:false}).limit(500),
      supabase.from('order_items').select('name_snapshot,quantity,line_total,created_at').order('created_at',{ascending:false}).limit(1500),
      supabase.from('products').select('id,name,status').limit(1000)
    ])
    const firstError=[orders,jobs,rfqs,profiles,variants,components,enclosures,configs,items,products].find(x=>x.error)?.error
    if(firstError){setError(firstError.message);setLoading(false);return}
    setData({orders:orders.data||[],jobs:jobs.data||[],rfqs:rfqs.data||[],profiles:profiles.data||[],variants:variants.data||[],components:components.data||[],enclosures:enclosures.data||[],configs:configs.data||[],items:items.data||[],products:products.data||[]})
    setRefreshed(new Date());setLoading(false)
  },[])
  useEffect(()=>{load()},[load])

  const now=new Date();const previousMonth=new Date(now.getFullYear(),now.getMonth()-1,1)
  const paid=data.orders.filter(o=>o.payment_status==='paid')
  const todayPaid=paid.filter(o=>sameDay(o.created_at,now));const monthPaid=paid.filter(o=>sameMonth(o.created_at,now));const prevMonthPaid=paid.filter(o=>sameMonth(o.created_at,previousMonth))
  const todayRevenue=todayPaid.reduce((s,o)=>s+num(o.grand_total),0);const mtdRevenue=monthPaid.reduce((s,o)=>s+num(o.grand_total),0);const prevRevenue=prevMonthPaid.reduce((s,o)=>s+num(o.grand_total),0)
  const monthTrend=prevRevenue?((mtdRevenue-prevRevenue)/prevRevenue)*100:null
  const todayOrders=data.orders.filter(o=>sameDay(o.created_at,now)).length
  const openOrders=data.orders.filter(o=>['pending','confirmed','processing'].includes(o.status)).length
  const paymentPending=data.orders.filter(o=>o.payment_status==='pending'&&!['cancelled','refunded'].includes(o.status))
  const productionQueue=data.jobs.filter(j=>!['completed','cancelled'].includes(j.status))
  const readyToShip=data.orders.filter(o=>o.status==='ready_to_ship').length
  const openRfqs=data.rfqs.filter(r=>['new','contacted','quoted'].includes(r.status))
  const rfqValue=openRfqs.reduce((s,r)=>s+num(r.quoted_amount),0)
  const customers=data.profiles.filter(p=>p.role==='customer')
  const newCustomers=customers.filter(p=>sameMonth(p.created_at,now)).length
  const configsMonth=data.configs.filter(c=>sameMonth(c.created_at,now)).length
  const avgOrder=monthPaid.length?mtdRevenue/monthPaid.length:0

  const lowVariants=data.variants.filter(v=>num(v.stock_qty)<=num(v.low_stock_threshold??5))
  const lowComponents=data.components.filter(c=>num(c.stock_qty)<=5)
  const lowEnclosures=data.enclosures.filter(e=>num(e.stock_qty)<=5)
  const lowStockCount=lowVariants.length+lowComponents.length+lowEnclosures.length
  const overdueJobs=productionQueue.filter(j=>j.due_date&&new Date(`${j.due_date}T23:59:59`)<now)
  const newRfqs=data.rfqs.filter(r=>r.status==='new')
  const draftProducts=data.products.filter(p=>p.status==='draft')

  const funnel=['pending','confirmed','processing','ready_to_ship','shipped','delivered'].map(status=>({status,count:data.orders.filter(o=>o.status===status).length}))
  const maxFunnel=Math.max(1,...funnel.map(x=>x.count))
  const topProducts=Object.entries(data.items.reduce((acc:any,it)=>{const k=it.name_snapshot||'Unnamed item';acc[k]??={qty:0,value:0};acc[k].qty+=num(it.quantity);acc[k].value+=num(it.line_total);return acc},{})).map(([name,v]:any)=>({name,...v})).sort((a,b)=>b.value-a.value).slice(0,5)
  const recent=data.orders.slice(0,6)

  if(loading)return <div className="dashV2Loading"><div/><div/><div/><div/><section/></div>
  if(error)return <div className="dashV2Error"><AlertTriangle size={26}/><div><h2>Dashboard data could not load</h2><p>{error}</p></div><button onClick={load}><RefreshCw size={15}/> Retry</button></div>

  return <div className="dashV2">
    <div className="dashV2Head"><div><span className="adminEyebrow">EXECUTIVE COMMAND CENTER</span><h1>Operations Dashboard</h1><p>Live commercial, production, stock and B2B pipeline health.</p></div><div className="dashV2HeadActions"><span><Clock3 size={14}/> {refreshed?`Updated ${refreshed.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`:'Live data'}</span><button onClick={load}><RefreshCw size={15}/> Refresh</button></div></div>

    <section className="dashV2PrimaryMetrics">
      <MetricCard label="Today's Paid Sales" value={money(todayRevenue)} sub={`${todayPaid.length} paid order${todayPaid.length===1?'':'s'} today`} icon={IndianRupee} tone="green"/>
      <MetricCard label="Month-to-Date Revenue" value={money(mtdRevenue)} sub={`${monthPaid.length} paid orders · AOV ${money(avgOrder)}`} icon={TrendingUp} tone="navy" trend={monthTrend}/>
      <MetricCard label="Orders Today" value={todayOrders} sub={`${openOrders} orders currently open`} icon={ShoppingCart} tone="blue"/>
      <MetricCard label="Payment Pending" value={paymentPending.length} sub={`${money(paymentPending.reduce((s,o)=>s+num(o.grand_total),0))} awaiting payment`} icon={Clock3} tone="amber"/>
    </section>

    <section className="dashV2SecondaryMetrics">
      <MetricCard label="Production Queue" value={productionQueue.length} sub={`${overdueJobs.length} overdue job${overdueJobs.length===1?'':'s'}`} icon={Factory} tone={overdueJobs.length?'red':'default'}/>
      <MetricCard label="Ready to Dispatch" value={readyToShip} sub="Orders awaiting shipment" icon={CheckCircle2}/>
      <MetricCard label="Low Stock" value={lowStockCount} sub={`${lowVariants.length} finished · ${lowComponents.length+lowEnclosures.length} BOM items`} icon={Boxes} tone={lowStockCount?'red':'default'}/>
      <MetricCard label="Open RFQs" value={openRfqs.length} sub={`${money(rfqValue)} quoted pipeline`} icon={FileText}/>
      <MetricCard label="Customers" value={customers.length} sub={`${newCustomers} new this month`} icon={Users}/>
      <MetricCard label="Custom Builds" value={configsMonth} sub={`${data.configs.length} configurations total`} icon={Wrench}/>
    </section>

    <div className="dashV2GridMain">
      <section className="dashV2Panel dashV2RevenuePanel"><MiniRevenueChart orders={data.orders}/></section>
      <section className="dashV2Panel">
        <div className="dashV2PanelHead"><div><small>ORDER FLOW</small><h2>Fulfilment funnel</h2></div><Link href="/admin/orders">Orders <ArrowRight size={15}/></Link></div>
        <div className="dashV2Funnel">{funnel.map(x=><div key={x.status}><span>{titleCase(x.status)}</span><div><i style={{width:`${Math.max(x.count?8:0,(x.count/maxFunnel)*100)}%`}}/></div><b>{x.count}</b></div>)}</div>
      </section>
    </div>

    <section className="dashV2Attention">
      <div className="dashV2PanelHead"><div><small>ACTION CENTER</small><h2>Needs attention</h2></div><span className="dashV2AttentionCount">{paymentPending.length+overdueJobs.length+lowStockCount+newRfqs.length+draftProducts.length} items</span></div>
      <div className="dashV2AttentionGrid">
        <Link href="/admin/orders" className={paymentPending.length?'warn':''}><Clock3 size={18}/><div><b>Pending payments</b><span>{paymentPending.length} orders · {money(paymentPending.reduce((s,o)=>s+num(o.grand_total),0))}</span></div><ArrowRight size={15}/></Link>
        <Link href="/admin/production" className={overdueJobs.length?'danger':''}><Factory size={18}/><div><b>Overdue production</b><span>{overdueJobs.length} job{overdueJobs.length===1?'':'s'} past due date</span></div><ArrowRight size={15}/></Link>
        <Link href="/admin/inventory" className={lowStockCount?'danger':''}><Package size={18}/><div><b>Stock risk</b><span>{lowStockCount} low-stock SKU{lowStockCount===1?'':'s'}</span></div><ArrowRight size={15}/></Link>
        <Link href="/admin/rfqs" className={newRfqs.length?'warn':''}><FileText size={18}/><div><b>New RFQs</b><span>{newRfqs.length} enquiry{newRfqs.length===1?'':'ies'} awaiting first action</span></div><ArrowRight size={15}/></Link>
        <Link href="/admin/products" className={draftProducts.length?'neutral':''}><Package size={18}/><div><b>Draft catalogue</b><span>{draftProducts.length} product{draftProducts.length===1?'':'s'} not published</span></div><ArrowRight size={15}/></Link>
      </div>
    </section>

    <div className="dashV2GridBottom">
      <section className="dashV2Panel">
        <div className="dashV2PanelHead"><div><small>RECENT ACTIVITY</small><h2>Latest orders</h2></div><Link href="/admin/orders">View all <ArrowRight size={15}/></Link></div>
        <div className="dashV2OrderList">{recent.length?recent.map(o=><Link href={`/admin/orders/${o.id}`} key={o.id}><div><b>{o.order_number}</b><span>{o.customer_snapshot?.name||o.customer_snapshot?.full_name||o.customer_snapshot?.company_name||'Customer'} · {new Date(o.created_at).toLocaleDateString('en-IN')}</span></div><span className={`statusPill status-${o.status}`}>{titleCase(o.status)}</span><strong>{money(num(o.grand_total))}</strong></Link>):<div className="dashV2Empty">No orders yet.</div>}</div>
      </section>
      <section className="dashV2Panel">
        <div className="dashV2PanelHead"><div><small>SALES MIX</small><h2>Top products</h2></div><Link href="/admin/products">Catalogue <ArrowRight size={15}/></Link></div>
        <div className="dashV2TopProducts">{topProducts.length?topProducts.map((p,i)=><div key={p.name}><span className="dashV2Rank">{String(i+1).padStart(2,'0')}</span><div><b>{p.name}</b><span>{p.qty.toLocaleString('en-IN')} units ordered</span></div><strong>{money(p.value)}</strong></div>):<div className="dashV2Empty">Sales ranking will appear after orders are placed.</div>}</div>
      </section>
    </div>

    <section className="dashV2QuickStrip">
      <div><CalendarDays size={19}/><span><b>Today</b><small>{now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</small></span></div>
      <Link href="/admin/products">Add / manage products <ArrowRight size={14}/></Link>
      <Link href="/admin/configurator">Configurator control <ArrowRight size={14}/></Link>
      <Link href="/admin/rfqs">Review B2B pipeline <ArrowRight size={14}/></Link>
      <Link href="/admin/customers"><UserPlus size={14}/> Customer directory</Link>
    </section>
  </div>
}

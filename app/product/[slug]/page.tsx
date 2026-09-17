'use client'

import Link from 'next/link'
import QuantityControl from '../../../components/buyer/QuantityControl'
import {useEffect,useRef,useState} from 'react'
import {useParams} from 'next/navigation'
import {
  Box, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download,
  FileText, Headphones, Heart, ImageIcon, Minus, PackageCheck, Plus, Share2,
  ShieldCheck, ShoppingCart, Tag, Truck, Users, Wrench, Zap
} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import {useCart} from '../../../components/CartProvider'
import StoreHeader from '../../../components/StoreHeader'
import StoreFooter from '../../../components/StoreFooter'

const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n)
const gstPrice=(price:number,gst=18)=>{const paise=Math.round((price+Number.EPSILON)*100);return (paise+Math.round(paise*gst/100))/100}

export default function Product(){
  const {slug}=useParams<{slug:string}>()
  const [p,setP]=useState<any>(null)
  const [related,setRelated]=useState<any[]>([])
  const [variantId,setVariantId]=useState('')
  const [activeIndex,setActiveIndex]=useState(0)
  const [qty,setQty]=useState(1)
  const [tab,setTab]=useState<'overview'|'specifications'|'box'|'downloads'>('overview')
  const [wish,setWish]=useState(false)
  const [copied,setCopied]=useState(false)
  const [loading,setLoading]=useState(true)
  const touchStart=useRef<number|null>(null)
  const {add}=useCart()

  useEffect(()=>{
    let alive=true
    ;(async()=>{
      const {data}=await supabase.from('products').select('*,categories(name,slug),product_images(*),product_variants(*)').eq('slug',slug).eq('status','active').single()
      if(!alive)return
      setP(data)
      setQty(Math.max(1,Math.ceil(Number(data?.min_order_qty)||1)))
      setVariantId(data?.product_variants?.[0]?.id||'')
      setActiveIndex(0)
      if(data){
        const {data:more}=await supabase.from('products').select('id,name,slug,category_id,gst_rate,short_description,categories(name,slug),product_images(image_url,alt_text,sort_order),product_variants(id,sku,title,selling_price,mrp,stock_qty,unit)').eq('status','active').neq('id',data.id).limit(10)
        if(!alive)return
        const sorted=[...(more||[])].sort((a:any,b:any)=>Number(b.category_id===data.category_id)-Number(a.category_id===data.category_id)).slice(0,4)
        setRelated(sorted)
      }
      setLoading(false)
    })()
    return()=>{alive=false}
  },[slug])

  const variants=p?.product_variants||[]
  const v=variants.find((x:any)=>x.id===variantId)||variants[0]
  const price=Number(v?.selling_price||0)
  const gst=Number(p?.gst_rate??18)
  const priceIncl=gstPrice(price,gst)
  const gstAmt=Math.max(0,priceIncl-price)
  const mrp=Number(v?.mrp||0)
  const mrpIncl=mrp?gstPrice(mrp,gst):0
  const stock=Number(v?.stock_qty||0)
  const minQty=Math.max(1,Math.ceil(Number(p?.min_order_qty)||1))
  const attrs=v?.attributes||{}
  const specs=p?.specifications||{}
  const imgs=[...(p?.product_images||[])].sort((a:any,b:any)=>a.sort_order-b.sort_order)
  const activeImg=imgs[activeIndex]
  const discount=mrpIncl>priceIncl&&priceIncl>0?Math.round((1-priceIncl/mrpIncl)*100):0
  const saving=mrpIncl>priceIncl?mrpIncl-priceIncl:0
  const applications=(p?.applications?.length?p.applications:['Residential rooftop solar','Commercial solar installations','String protection and combiner use']).slice(0,4)
  const features=[...(p?.product_badges||[]),...(p?.inclusions||[])].filter(Boolean).slice(0,5)

  if(loading)return <><StoreHeader/><main className="container productLoading"><div/><div/></main></>
  if(!p)return <><StoreHeader/><main className="container emptyCatalogue"><h1>Product not found.</h1><Link className="btn btnPrimary" href="/shop">Back to Products</Link></main></>

  function addToCart(){if(!v||price<=0||qty<minQty||qty>stock||!Number.isSafeInteger(qty))return;add({id:v.id,kind:'standard',productVariantId:v.id,name:p.name,variant:v.title||v.sku,price,qty,minQty})}
  function go(index:number){if(!imgs.length)return;setActiveIndex((index+imgs.length)%imgs.length)}
  function previous(){go(activeIndex-1)}
  function next(){go(activeIndex+1)}
  function keySlide(e:React.KeyboardEvent){if(e.key==='ArrowLeft'){e.preventDefault();previous()}if(e.key==='ArrowRight'){e.preventDefault();next()}if(e.key==='Home'){e.preventDefault();go(0)}if(e.key==='End'){e.preventDefault();go(imgs.length-1)}}
  function touchEnd(e:React.TouchEvent){if(touchStart.current===null)return;const delta=e.changedTouches[0].clientX-touchStart.current;touchStart.current=null;if(Math.abs(delta)<45)return;delta<0?next():previous()}
  async function share(){
    const url=window.location.href
    try{if(navigator.share){await navigator.share({title:p.name,text:p.short_description||p.name,url});return}await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{}
  }

  return <><StoreHeader/><main className="pdPage">
    <div className="container pdBreadcrumbs"><Link href="/">Home</Link><span>›</span><Link href="/shop">Products</Link><span>›</span><Link href={`/shop?q=${encodeURIComponent(p.categories?.name||'')}`}>{p.categories?.name||'Solar Component'}</Link><span>›</span><b>{p.name}</b></div>

    <section className="container pdHero">
      <div className="pdGalleryColumn">
        <div className="pdGallery" tabIndex={0} onKeyDown={keySlide} onTouchStart={e=>{touchStart.current=e.touches[0].clientX}} onTouchEnd={touchEnd} aria-label={`${p.name} image gallery`}>
          <div className="pdImageStage">
            {activeImg?<img src={activeImg.image_url} alt={activeImg.alt_text||`${p.name} image ${activeIndex+1}`}/>:<div className="pdNoImage"><ImageIcon/><span>Product image</span></div>}
            {imgs.length>1&&<><button className="pdArrow prev" onClick={previous} aria-label="Previous product image"><ChevronLeft/></button><button className="pdArrow next" onClick={next} aria-label="Next product image"><ChevronRight/></button></>}
            {imgs.length>1&&<span className="pdImageCount">{activeIndex+1}/{imgs.length}</span>}
          </div>
          {imgs.length>1&&<div className="pdThumbs">{imgs.map((img:any,i:number)=><button key={img.id||img.image_url} className={i===activeIndex?'active':''} onClick={()=>go(i)} aria-label={`Show image ${i+1}`}><img src={img.image_url} alt={img.alt_text||`${p.name} thumbnail ${i+1}`}/></button>)}</div>}
        </div>
        <div className="pdGalleryBadges">{(p.product_badges?.length?p.product_badges:['IP65','Solar Ready','EPC Ready']).slice(0,3).map((b:string,i:number)=><span key={b}>{i===0?<ShieldCheck/>:i===1?<Zap/>:<PackageCheck/>}<b>{b}</b></span>)}</div>
      </div>

      <div className="pdBuy">
        <div className="pdTopline"><span className="pdCategory">{p.categories?.name||'Solar Component'}</span><div><small>SKU: {v?.sku||'—'}</small><button onClick={share}><Share2/>{copied?'Copied':'Share'}</button></div></div>
        <h1>{p.name}</h1>
        <p className="pdLead">{p.short_description||p.description||'Reliable New India Solar component engineered for solar installation projects.'}</p>
        <div className="pdMeta"><span className={stock>0?'stock':'out'}><CheckCircle2/>{stock>0?`In stock (${stock} ${v?.unit||'pcs'})`:'Available on request'}</span><span>GST {gst}%</span>{p.warranty_months?<span>{p.warranty_months} month warranty</span>:null}<span>MOQ {p.min_order_qty||1} {v?.unit||'pcs'}</span><span>{Number(p.lead_time_days)>0?`Lead time ${p.lead_time_days} days`:'Confirm dispatch time'}</span></div>

        {variants.length>1&&<div className="pdVariants"><label>Choose Variant</label><div>{variants.map((x:any)=>{const base=Number(x.selling_price||0);return <button key={x.id} className={x.id===v?.id?'active':''} onClick={()=>{setVariantId(x.id);setQty(1)}}><b>{x.title||x.sku}</b><span>{money(gstPrice(base,gst))} incl. GST</span></button>})}</div></div>}

        <div className="pdPriceCard">
          <div className="pdPriceMain"><small>Price (including {gst}% GST)</small><strong>{price>0?money(priceIncl):'Price on request'}</strong>{price>0&&<div className="pdSaving">{saving>0&&<b>You save {money(saving)} ({discount}% off)</b>}{mrpIncl>priceIncl&&<del>{money(mrpIncl)}</del>}{discount>0&&<span>{discount}% OFF</span>}</div>}<div className="pdTaxLine"><div><small>Base Price</small><b>{money(price)}</b></div><i>+</i><div><small>GST @ {gst}%</small><b>{money(gstAmt)}</b></div><i>=</i><div><small>Total ({qty} {v?.unit||'pcs'})</small><b>{money(priceIncl*qty)}</b></div></div></div>
          <aside className="pdValue"><Tag/><div><b>Best value for solar projects</b><span><Check/> Quality components</span><span><Check/> EPC ready</span><span><Check/> Pan-India support</span></div></aside>
        </div>

        {price>0&&stock>0?<div className="pdBuyRow"><QuantityControl value={qty} min={minQty} max={stock} label="Product quantity" onChange={setQty}/><button className="pdAdd" disabled={qty<minQty||qty>stock} onClick={addToCart}><ShoppingCart/>Add to Cart</button></div>:<Link className="pdAdd full" href="/bulk-order">{price>0?'Check Availability':'Request Price'}</Link>}
        <div className="pdSecondaryActions"><Link href="/bulk-order"><FileText/>Request a Quote</Link><button onClick={()=>setWish(x=>!x)} className={wish?'active':''}><Heart fill={wish?'currentColor':'none'}/>{wish?'Saved to Wishlist':'Add to Wishlist'}</button></div>

        <div className="pdServiceGrid"><div><FileText/><b>GST-ready order</b><span>Business checkout supported</span></div><div><Truck/><b>Pan-India delivery</b><span>Reliable logistics network</span></div><div><Users/><b>Project support</b><span>Bulk RFQ available</span></div><div><Box/><b>Secure packaging</b><span>Safe & reliable</span></div></div>
      </div>
    </section>

    <section className="container pdInfo">
      <div className="pdTabs" role="tablist"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><CheckCircle2/>Overview</button><button className={tab==='specifications'?'active':''} onClick={()=>setTab('specifications')}><Wrench/>Specifications</button><button className={tab==='box'?'active':''} onClick={()=>setTab('box')}><Box/>In the Box</button><button className={tab==='downloads'?'active':''} onClick={()=>setTab('downloads')}><Download/>Downloads</button></div>
      {tab==='overview'&&<div className="pdTabContent pdOverview"><div><h2>Product Overview</h2><p>{p.description||p.short_description||'New India Solar component designed for dependable solar installation projects.'}</p></div><div className="pdMiniList"><h3>Applications</h3>{applications.map((x:string)=><span key={x}><CheckCircle2/>{x}</span>)}</div><div className="pdMiniList"><h3>Key Features</h3>{(features.length?features:['Project-ready build','Quality checked','Reliable solar application']).map((x:string)=><span key={x}><CheckCircle2/>{x}</span>)}</div></div>}
      {tab==='specifications'&&<div className="pdTabContent"><div className="pdSpecGrid">{Object.entries({...specs,...attrs}).length?Object.entries({...specs,...attrs}).map(([k,val]:any)=><div key={k}><span>{k.replaceAll('_',' ')}</span><b>{String(val)}</b></div>):<p>No structured specifications have been added yet.</p>}</div></div>}
      {tab==='box'&&<div className="pdTabContent"><div className="pdBoxList">{p.inclusions?.length?p.inclusions.map((x:string)=><span key={x}><PackageCheck/>{x}</span>):<p>Box contents will be confirmed for this product.</p>}</div></div>}
      {tab==='downloads'&&<div className="pdTabContent"><div className="pdDownloads">{p.datasheet_url?<Link href={p.datasheet_url} target="_blank"><FileText/><div><b>Product Datasheet</b><span>Open technical datasheet</span></div><Download/></Link>:null}{p.installation_guide_url?<Link href={p.installation_guide_url} target="_blank"><FileText/><div><b>Installation Guide</b><span>Open installation instructions</span></div><Download/></Link>:null}{!p.datasheet_url&&!p.installation_guide_url&&<p>No downloads have been uploaded yet.</p>}</div></div>}
    </section>

    <section className="container pdWhy"><div className="pdSectionHead"><div><h2>Why Choose New India Solar</h2><p>Built for installers, EPCs and project buyers across India.</p></div></div><div className="pdWhyGrid"><article><ShieldCheck/><b>Tested. Packed. Guaranteed.</b><span>Product-focused quality checks before dispatch.</span></article><article><Truck/><b>Pan-India Supply</b><span>Reliable project and business dispatch workflow.</span></article><article><Headphones/><b>Technical Support</b><span>Guidance for product and configuration selection.</span></article><article><Wrench/><b>Custom Build Options</b><span>ACDB and DCDB built around project needs.</span></article><article><Users/><b>Project Ready</b><span>Direct purchase, custom build and RFQ in one flow.</span></article></div></section>

    {related.length>0&&<section className="container pdRelated"><div className="pdSectionHead row"><div><h2>Related Products</h2><p>More components for your solar installation.</p></div><Link href="/shop">View All Products →</Link></div><div className="pdRelatedGrid">{related.map((r:any)=>{const rv=r.product_variants?.[0];const ri=[...(r.product_images||[])].sort((a:any,b:any)=>a.sort_order-b.sort_order)[0];const rp=Number(rv?.selling_price||0);const rtotal=gstPrice(rp,Number(r.gst_rate??18));return <article key={r.id}><Link href={`/product/${r.slug}`} className="pdRelatedImage">{ri?<img src={ri.image_url} alt={ri.alt_text||r.name}/>:<ImageIcon/>}</Link><div><small>{r.categories?.name||'Solar Component'}</small><h3><Link href={`/product/${r.slug}`}>{r.name}</Link></h3><div><strong>{rp?money(rtotal):'Request price'}</strong><span>{Number(rv?.stock_qty||0)>0?'In stock':'On request'}</span><Link href={`/product/${r.slug}`} aria-label={`View ${r.name}`}><ShoppingCart/></Link></div></div></article>})}</div></section>}

    <section className="container pdFaq"><div className="pdSectionHead row"><div><h2>Frequently Asked Questions</h2><p>Quick answers before you place an order.</p></div><Link href="/#contact">Contact our team →</Link></div><div className="pdFaqList"><details><summary><span>1.</span> What is the difference between ACDB and DCDB?<ChevronDown/></summary><p>ACDB protects and distributes the AC side of a solar installation, while DCDB provides protection and combining functions on the DC side before the inverter.</p></details><details><summary><span>2.</span> Is this product suitable for commercial solar projects?<ChevronDown/></summary><p>Suitability depends on the selected voltage, current, protection and project design. Use the listed specifications or request a project quote for confirmation.</p></details><details><summary><span>3.</span> What is the warranty period?<ChevronDown/></summary><p>{p.warranty_months?`This product currently lists a ${p.warranty_months}-month warranty.`:'Warranty terms will be confirmed with the final approved product specification.'}</p></details><details><summary><span>4.</span> Can you provide custom configurations?<ChevronDown/></summary><p>Yes. New India Solar supports configurable ACDB and DCDB builds and project-specific bulk requirements.</p></details></div></section>
  </main><StoreFooter/></>
}

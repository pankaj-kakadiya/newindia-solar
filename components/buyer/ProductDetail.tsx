'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {useRouter,useSearchParams} from 'next/navigation'
import {ArrowRight,CheckCircle2,ChevronLeft,ChevronRight,Download,FileText,ImageIcon,LoaderCircle,Minus,Plus,Share2,ShoppingCart,X,ZoomIn} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {useCart} from '../CartProvider'
import {BuyerAlert,BuyerButton,BuyerSkeleton} from './BuyerUI'
import {activeVariants,money,priceFor,productImage,safeAssetUrl} from '../../lib/catalogue'
import type {Product,Variant} from '../../lib/catalogue'
import {checkPurchase,finite,linePrice,minimum,PUBLIC_PRODUCT_SELECT,productEnquiry,quantityError,quantityStep,rounded,specEntries,strings} from '../../lib/buyer-commerce'

type Detail=Product & {description:string|null;inclusions:unknown;applications:unknown;product_badges:unknown;warranty_months:number|null;lead_time_days:number|null;hsn_code:string|null;installation_guide_url:string|null}
function Photo({src,alt,priority=false}:{src?:string;alt:string;priority?:boolean}){
  const [broken,setBroken]=useState(false);useEffect(()=>setBroken(false),[src])
  return src&&!broken?<Image src={src} alt={alt} fill unoptimized priority={priority} sizes="(max-width: 800px) 100vw, 50vw" onError={()=>setBroken(true)}/>:<div className="p28ImageEmpty"><ImageIcon size={36}/><span>Image not available</span></div>
}
export default function ProductDetail({slug}:{slug:string}){
  const params=useSearchParams(),router=useRouter(),cart=useCart()
  const [product,setProduct]=useState<Detail|null>(null),[related,setRelated]=useState<Product[]>([])
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  const [imageIndex,setImageIndex]=useState(0),[quantity,setQuantity]=useState('1'),[busy,setBusy]=useState<'cart'|'buy'|null>(null)
  const [notice,setNotice]=useState<{text:string;error:boolean}|null>(null),[tab,setTab]=useState('overview'),[zoomOpen,setZoomOpen]=useState(false)
  const zoom=useRef<HTMLDialogElement>(null),zoomButton=useRef<HTMLButtonElement>(null),variantArea=useRef<HTMLFieldSetElement>(null),touch=useRef<number|null>(null),lock=useRef(false)
  useEffect(()=>{
    let live=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000)
    setLoading(true);setError('');setProduct(null);setRelated([])
    ;(async()=>{
      const {data,error}=await supabase.from('products').select(PUBLIC_PRODUCT_SELECT).eq('slug',slug).eq('status','active').eq('product_variants.is_active',true).abortSignal(controller.signal).maybeSingle()
      if(error)throw error
      if(!live)return
      const row=data as unknown as Detail|null
      const visible=row?.categories?.is_active===false?null:row
      setProduct(visible);setLoading(false);clearTimeout(timer)
      if(visible?.category_id){
        const {data:more}=await supabase.from('products').select(PUBLIC_PRODUCT_SELECT).eq('status','active').eq('category_id',visible.category_id).neq('id',visible.id).eq('product_variants.is_active',true).order('sort_order').order('id').limit(4).abortSignal(controller.signal)
        if(live)setRelated((more||[]) as unknown as Product[])
      }
    })().catch(()=>{if(live){setError('The product could not be loaded. Please retry.');setLoading(false)}}).finally(()=>clearTimeout(timer))
    return()=>{live=false;clearTimeout(timer);controller.abort()}
  },[slug,attempt])
  const variants=useMemo(()=>product?activeVariants(product):[],[product])
  const wanted=params.get('variant')||''
  const variant=variants.find(v=>v.id===wanted)||(!wanted&&variants.length===1?variants[0]:null)
  useEffect(()=>{if(product){setQuantity(String(minimum(product)));setNotice(null)}},[product?.id,product?.min_order_qty,variant?.id])
  useEffect(()=>{if(!zoomOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[zoomOpen])
  if(loading)return <main id="main-content" className="container p28Loading" aria-busy="true"><BuyerSkeleton kind="media"/><div><BuyerSkeleton kind="title"/><BuyerSkeleton/><BuyerSkeleton kind="button"/><p role="status">Loading product…</p></div></main>
  if(error)return <main id="main-content" className="container p28State"><BuyerAlert tone="error">{error}</BuyerAlert><BuyerButton onClick={()=>setAttempt(n=>n+1)}>Retry product</BuyerButton></main>
  if(!product)return <main id="main-content" className="container p28State"><h1>Product not available</h1><p>This product is not currently published.</p><BuyerButton href="/shop">Back to catalogue</BuyerButton></main>
  const p=product,images=[...(p.product_images||[])].filter(i=>safeAssetUrl(i.image_url)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)),index=Math.min(imageIndex,Math.max(0,images.length-1)),image=images[index]
  const unit=variant?priceFor(p,variant):null,range=variants.map(v=>priceFor(p,v)).filter((x):x is NonNullable<typeof x>=>!!x).sort((a,b)=>a.total-b.total),starting=unit||(!variant?range[0]:null)
  const totals=variant?linePrice(variant.selling_price,p.gst_rate,quantity):null
  const existing=variant?cart.items.filter(i=>i.productVariantId===variant.id).reduce((s,i)=>s+i.qty,0):0
  const qtyError=variant?quantityError(quantity,p,variant,existing):null
  const stock=variant?finite(variant.stock_qty):null
  const min=minimum(p),step=variant?quantityStep(variant):1,remaining=stock===null?0:Math.max(0,stock-existing)
  const purchasable=p.product_type==='standard'&&!!variant&&!!unit&&remaining>=min
  const valid=purchasable&&!qtyError&&cart.ready
  const enquiry=productEnquiry(p,variant,quantity)
  const specifications=specEntries(p.specifications,variant?.attributes)
  const documents=[{name:'Product datasheet',url:safeAssetUrl(p.datasheet_url)},{name:'Installation guide',url:safeAssetUrl(p.installation_guide_url)}].filter(x=>x.url)
  function select(v:Variant){if(busy)return;const q=new URLSearchParams(window.location.search);q.set('variant',v.id);window.history.pushState(null,'',`${window.location.pathname}?${q}`);setNotice(null)}
  function move(delta:number){if(images.length)setImageIndex((index+delta+images.length)%images.length)}
  function alter(delta:number){const q=finite(quantity)??min;setQuantity(String(Math.max(min,rounded(q+delta*step,6))))}
  async function purchase(destination:'cart'|'buy'){
    if(lock.current||!variant)return
    lock.current=true;setBusy(destination);setNotice(null)
    try{
      const {data,error}=await supabase.from('products').select(PUBLIC_PRODUCT_SELECT).eq('id',p.id).eq('status','active').eq('product_variants.is_active',true).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
      if(error)throw new Error('Could not verify the latest price and stock. Please retry.')
      const fresh=data as unknown as Detail|null
      if(fresh?.categories?.is_active===false)throw new Error('This product category is no longer published.')
      const checked=checkPurchase(fresh,variant.id,quantity)
      if(!checked.ok)throw new Error(checked.error)
      const added=cart.addChecked({id:checked.variant.id,kind:'standard',productVariantId:checked.variant.id,name:fresh!.name,variant:checked.variant.title||checked.variant.sku,price:checked.price.unit,gstRate:checked.price.rate,minQty:minimum(fresh!),quantityStep:quantityStep(checked.variant),qty:checked.quantity},finite(checked.variant.stock_qty)??0)
      if(!added.ok)throw new Error(added.error)
      const changed=unit&&unit.base!==checked.price.unit
      setNotice({text:`Added ${checked.quantity} ${checked.variant.unit||'units'} to cart.${changed?' The latest price has been applied.':''}`,error:false})
      if(destination==='buy')router.push('/checkout')
    }catch(err){setNotice({text:err instanceof Error?err.message:'Unable to add this product.',error:true})}
    finally{lock.current=false;setBusy(null)}
  }
  async function share(){try{if(navigator.share){await navigator.share({title:p.name,url:window.location.href});return}await navigator.clipboard.writeText(window.location.href);setNotice({text:'Product link copied with the selected variant.',error:false})}catch(err){if(!(err instanceof Error&&err.name==='AbortError'))setNotice({text:'Copy the page address from your browser to share this product.',error:true})}}
  const tabs=[['overview','Overview'],['specifications','Specifications'],['contents','In the box'],['downloads','Downloads']]
  return <main id="main-content" className="p28Page"><div className="container">
    <nav className="p28Breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={13}/><Link href="/shop">Components</Link>{p.categories&&<><ChevronRight size={13}/><Link href={`/shop?category=${encodeURIComponent(p.categories.slug)}`}>{p.categories.name}</Link></>}<ChevronRight size={13}/><span aria-current="page">Product details</span></nav>
    <section className="p28Hero"><div className="p28Gallery"><div className="p28Photo" tabIndex={0} role="group" aria-label="Product gallery. Use left and right arrow keys to browse images." onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}if(e.key==='ArrowRight'){e.preventDefault();move(1)}}} onTouchStart={e=>touch.current=e.touches[0].clientX} onTouchEnd={e=>{if(touch.current!==null&&Math.abs(e.changedTouches[0].clientX-touch.current)>50)move(e.changedTouches[0].clientX<touch.current?1:-1);touch.current=null}}>
      <Photo src={safeAssetUrl(image?.image_url)} alt={image?.alt_text||p.name} priority/>
      {images.length>1&&<><button className="p28Arrow prev" onClick={()=>move(-1)} aria-label="Previous image"><ChevronLeft/></button><button className="p28Arrow next" onClick={()=>move(1)} aria-label="Next image"><ChevronRight/></button><span className="p28ImageCount" aria-live="polite">{index+1} / {images.length}</span></>}
      {images.length>0&&<button ref={zoomButton} className="p28Enlarge" onClick={()=>{zoom.current?.showModal();setZoomOpen(true)}} aria-label="Enlarge product image"><ZoomIn size={18}/> Enlarge</button>}
    </div>{images.length>1&&<div className="p28Thumbnails">{images.map((img,i)=><button key={`${img.image_url}-${i}`} aria-label={`Show product image ${i+1}`} aria-pressed={i===index} className={i===index?'active':''} onClick={()=>setImageIndex(i)}><Photo src={safeAssetUrl(img.image_url)} alt=""/></button>)}</div>}
    <p className="p28ImageNote">Product photographs are supplied from the catalogue. Confirm variant-specific contents in the specifications.</p>
    </div>
    <div className="p28Purchase"><div className="p28Eyebrow"><span>{p.categories?.name||'Solar component'}{p.brands?.is_active?` · ${p.brands.name}`:''}</span><button onClick={share}><Share2 size={15}/> Share</button></div><h1>{p.name}</h1>{p.short_description&&<p className="p28Lead">{p.short_description}</p>}
      <div className="p28PublishedBadges">{strings(p.product_badges).map((badge,i)=><span key={`${badge}-${i}`}>{badge}</span>)}</div>
      <div className="p28Meta"><span>SKU: <b>{variant?.sku||'Select an option'}</b></span><span>Min. order: <b>{min} {variant?.unit||'units'}</b></span>{p.warranty_months!==null&&p.warranty_months>0&&<span>Warranty: <b>{p.warranty_months} months</b></span>}{p.lead_time_days!==null&&p.lead_time_days>=0&&<span>Published lead time: <b>{p.lead_time_days} days</b></span>}</div>
      {variants.length>1&&<fieldset className="p28Variants" ref={variantArea} disabled={!!busy}><legend>Choose a product option <span>Required</span></legend><div>{variants.map(v=>{const price=priceFor(p,v);return <label key={v.id} className={variant?.id===v.id?'active':''}><input type="radio" name="product-variant" checked={variant?.id===v.id} onChange={()=>select(v)}/><span><b>{v.title||v.sku}</b><small>{v.sku}</small><small>{price?`${money(price.total)} incl. GST`:'Price on request'}</small></span>{variant?.id===v.id&&<CheckCircle2 size={18}/>}</label>})}</div></fieldset>}
      {wanted&&!variants.some(v=>v.id===wanted)&&<BuyerAlert tone="warning">The option in this link is unavailable. Select a currently published option.</BuyerAlert>}
      <div className="p28PriceCard"><span>{variant?'Unit price':'Starting unit price'}</span><strong>{starting?`${!variant?'From ':''}${money(starting.total)}`:'Price on request'}{starting&&variant?.unit&&<small> / {variant.unit}</small>}</strong>{starting?<p>Base {money(starting.base)} + {starting.rate}% GST {money(starting.tax)}</p>:<p>Pricing and applicable GST need confirmation from our team.</p>}
        {totals&&variant&&<div className="p28Totals"><span>Selected quantity <b>{totals.quantity} {variant.unit||'units'}</b></span><span>Base amount <b>{money(totals.base)}</b></span><span>GST <b>{money(totals.tax)}</b></span><span>Total including GST <b>{money(totals.total)}</b></span></div>}
      </div>
      {variant&&<p className={`p28Stock ${remaining>=min?'available':''}`}><CheckCircle2 size={16}/>{stock!==null&&stock>=min?`${stock} ${variant.unit||'units'} in stock`:'Supply on enquiry'}{existing>0&&` · ${existing} already in cart`}</p>}
      {purchasable?<><label className="p28QtyLabel" htmlFor="product-quantity">Quantity ({variant!.unit||'units'})</label><div className="p28BuyRow"><div className="p28Qty"><button aria-label="Decrease quantity" disabled={!!busy||(finite(quantity)??0)<=min} onClick={()=>alter(-1)}><Minus size={17}/></button><input id="product-quantity" type="number" inputMode="decimal" min={min} max={remaining} step={step} value={quantity} disabled={!!busy} aria-invalid={!!qtyError} aria-describedby={qtyError?'product-quantity-error':undefined} onChange={e=>setQuantity(e.target.value)}/><button aria-label="Increase quantity" disabled={!!busy||(finite(quantity)??0)+step>remaining} onClick={()=>alter(1)}><Plus size={17}/></button></div><BuyerButton disabled={!valid||!!busy} onClick={()=>purchase('cart')}>{busy==='cart'?<LoaderCircle size={18}/>:<ShoppingCart size={18}/>}Add to Cart</BuyerButton><BuyerButton variant="secondary" disabled={!valid||!!busy} onClick={()=>purchase('buy')}>{busy==='buy'?'Checking…':'Buy Now'}<ArrowRight size={17}/></BuyerButton></div>{qtyError&&<p id="product-quantity-error" className="p28InputError">{qtyError}</p>}<p className="p28Small">Buy Now adds this selection and opens checkout with your existing cart. It does not place an order or take payment.</p></>:!variant&&variants.length>1?<p className="p28SelectionPrompt">Select an option above to see its stock, specifications and purchase controls.</p>:<BuyerButton href={enquiry}>Request price and availability</BuyerButton>}
      <div className="p28Enquiry"><Link href={enquiry}><FileText size={17}/> Bulk / project enquiry <ArrowRight size={16}/></Link><span>The selected SKU and quantity are carried into your requirement.</span></div>
      {notice&&<BuyerAlert tone={notice.error?'error':'success'}>{notice.text}{!notice.error&&notice.text.startsWith('Added')&&<> <Link href="/cart">View cart</Link></>}</BuyerAlert>}{cart.storageWarning&&<BuyerAlert tone="warning">{cart.storageWarning}</BuyerAlert>}
    </div></section>
    <section className="p28Information"><div className="p28Tabs" role="tablist" aria-label="Product information">{tabs.map(([key,label],i)=><button key={key} id={`p28-tab-${key}`} role="tab" aria-selected={tab===key} aria-controls={`p28-panel-${key}`} tabIndex={tab===key?0:-1} onClick={()=>setTab(key)} onKeyDown={e=>{let next=i;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();setTab(tabs[next][0]);document.getElementById(`p28-tab-${tabs[next][0]}`)?.focus()}}>{label}{key==='downloads'&&documents.length>0&&` (${documents.length})`}</button>)}</div>
      <div id={`p28-panel-${tab}`} role="tabpanel" aria-labelledby={`p28-tab-${tab}`} tabIndex={0} className="p28TabPanel">
        {tab==='overview'&&<><h2>Product overview</h2><p className="p28Description">{p.description||p.short_description||'Detailed product information has not been published yet.'}</p>{strings(p.applications).length>0&&<><h3>Published applications</h3><ul>{strings(p.applications).map((value,i)=><li key={i}>{value}</li>)}</ul></>}</>}
        {tab==='specifications'&&<><h2>Technical specifications</h2>{!variant&&variants.length>1&&<p>Select an option to include variant-specific attributes.</p>}{specifications.length?<dl className="p28Specs">{specifications.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>:<p>No structured specifications have been published.</p>}{p.hsn_code&&<p>Published HSN: {p.hsn_code}</p>}</>}
        {tab==='contents'&&<><h2>Included with this product</h2>{strings(p.inclusions).length?<ul>{strings(p.inclusions).map((value,i)=><li key={i}>{value}</li>)}</ul>:<p>Package contents have not been published. Confirm them through an enquiry before ordering.</p>}</>}
        {tab==='downloads'&&<><h2>Product documents</h2>{documents.length?<div className="p28Documents">{documents.map(doc=><a key={doc.name} href={doc.url} target="_blank" rel="noopener noreferrer"><FileText size={24}/><span>{doc.name}<small>Open published document</small></span><Download size={18}/></a>)}</div>:<p>No datasheet or installation guide has been published for this product.</p>}</>}
      </div></section>
    {related.length>0&&<section className="p28Related"><header><div><span className="nisEyebrow">MORE IN THIS CATEGORY</span><h2>Related components</h2></div><Link href={`/shop?category=${encodeURIComponent(p.categories?.slug||'')}`}>Browse category <ArrowRight size={16}/></Link></header><div>{related.map(r=>{const ri=productImage(r),prices=activeVariants(r).map(v=>priceFor(r,v)).filter((x):x is NonNullable<typeof x>=>!!x).sort((a,b)=>a.total-b.total);return <article key={r.id}><Link href={`/product/${encodeURIComponent(r.slug)}`} className="p28RelatedImage" prefetch={false}><Photo src={safeAssetUrl(ri?.image_url)} alt={ri?.alt_text||r.name}/></Link><h3><Link href={`/product/${encodeURIComponent(r.slug)}`} prefetch={false}>{r.name}</Link></h3><p>{prices.length?`From ${money(prices[0].total)} incl. GST`:'Price on request'}</p></article>})}</div></section>}
    <div className="p28ProjectCta"><div><h2>Planning a complete installation?</h2><p>Send quantities, preferred ratings and delivery location for project pricing.</p></div><BuyerButton href={enquiry} variant="secondary">Send requirement <ArrowRight size={17}/></BuyerButton></div>
    </div>
    <div className="p28MobileBar"><div><small>{variant?'Unit price':'Starting price'}</small><b>{starting?money(starting.total):'Enquire'}</b></div>{purchasable?<BuyerButton disabled={!valid||!!busy} onClick={()=>purchase('cart')}><ShoppingCart size={17}/>{busy?'Checking…':'Add to Cart'}</BuyerButton>:!variant&&variants.length>1?<BuyerButton onClick={()=>{variantArea.current?.scrollIntoView({block:'center'});variantArea.current?.querySelector('input')?.focus()}}>Choose option</BuyerButton>:<BuyerButton href={enquiry}>Enquire</BuyerButton>}</div>
    <dialog ref={zoom} className="p28Zoom" aria-label="Enlarged product image" onClose={()=>{setZoomOpen(false);zoomButton.current?.focus()}} onClick={e=>{if(e.target===e.currentTarget)zoom.current?.close()}}><div><header><span>{p.name}</span><button autoFocus onClick={()=>zoom.current?.close()} aria-label="Close enlarged image"><X/></button></header><div className="p28ZoomImage"><Photo src={safeAssetUrl(image?.image_url)} alt={image?.alt_text||p.name}/></div>{images.length>1&&<footer><button onClick={()=>move(-1)} aria-label="Previous enlarged image"><ChevronLeft/>Previous</button><span>{index+1} / {images.length}</span><button onClick={()=>move(1)} aria-label="Next enlarged image">Next<ChevronRight/></button></footer>}</div></dialog>
  </main>
}

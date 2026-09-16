'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import type {KeyboardEvent,TouchEvent} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {useRouter,useSearchParams} from 'next/navigation'
import {ArrowRight,CheckCircle2,ChevronLeft,ChevronRight,Download,FileText,ImageIcon,LoaderCircle,Minus,Plus,Share2,ShoppingCart,X,ZoomIn} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {useCart} from '../CartProvider'
import {BuyerAlert,BuyerButton,BuyerSkeleton} from './BuyerUI'
import {activeVariants,money,priceFor,productImage,safeAssetUrl} from '../../lib/catalogue'
import type {Product,Variant} from '../../lib/catalogue'
import {checkPurchase,finite,linePrice,minimum,PUBLIC_PRODUCT_SELECT,productEnquiry,quantityError,quantityStep,rounded,specEntries,strings,firstQuantity,maximumQuantity,remainingQuantity,nextQuantity,resolveVariant} from '../../lib/buyer-commerce'
import {galleryKeyIndex,gallerySwipe} from '../../lib/gallery-interactions'
import type {GalleryTouch} from '../../lib/gallery-interactions'
import './product-gallery-refinements.css'

type Detail=Product & {description:string|null;inclusions:unknown;applications:unknown;product_badges:unknown;warranty_months:number|null;lead_time_days:number|null;hsn_code:string|null;installation_guide_url:string|null}
type PhotoProps={src?:string;alt:string;priority?:boolean;retryable?:boolean;sizes?:string}
function Photo(props:PhotoProps){return <PhotoImage key={props.src||'missing-image'} {...props}/>}
function PhotoImage({src,alt,priority=false,retryable=false,sizes='(max-width: 800px) 100vw, 50vw'}:PhotoProps){
  const [broken,setBroken]=useState(!src),[loaded,setLoaded]=useState(false),[attempt,setAttempt]=useState(0)
  return <>{src&&!broken&&<Image key={attempt} src={src} alt={alt} fill unoptimized priority={priority} sizes={sizes} onLoad={()=>setLoaded(true)} onError={()=>setBroken(true)}/>}
    {!broken&&!loaded&&<span className="p282ImageLoading" role={retryable?'status':undefined} aria-hidden={retryable?undefined:true}>{retryable?'Loading image…':''}</span>}
    {broken&&<div className={`p28ImageEmpty ${alt?'':'p282DecorativeMissing'}`} role={retryable?'status':undefined} aria-hidden={alt?undefined:true}><ImageIcon size={retryable?36:20}/><span>{src?'Image could not be loaded':'Image not available'}</span>{src&&retryable&&<button type="button" onClick={e=>{const stage=e.currentTarget.closest<HTMLElement>('.p28Photo,.p28ZoomImage');stage?.focus({preventScroll:true});setBroken(false);setLoaded(false);setAttempt(n=>n+1)}}>Retry image</button>}</div>}
  </>
}
export default function ProductDetail({slug}:{slug:string}){
  const params=useSearchParams(),router=useRouter(),cart=useCart()
  const [product,setProduct]=useState<Detail|null>(null),[related,setRelated]=useState<Product[]>([])
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  const [imageIndex,setImageIndex]=useState(0),[quantityDraft,setQuantityDraft]=useState<{key:string;value:string}|null>(null),[busy,setBusy]=useState<'cart'|'buy'|null>(null)
  const [notice,setNotice]=useState<{text:string;error:boolean}|null>(null),[tab,setTab]=useState('overview'),[zoomOpen,setZoomOpen]=useState(false)
  const zoom=useRef<HTMLDialogElement>(null),zoomButton=useRef<HTMLButtonElement>(null),variantArea=useRef<HTMLFieldSetElement>(null),lock=useRef(false)
  const touch=useRef<GalleryTouch|null>(null),thumbs=useRef<HTMLDivElement>(null),mobileBar=useRef<HTMLDivElement>(null),backdropPress=useRef(false)
  const mounted=useRef(true),purchaseContext=useRef(''),currentItems=useRef(cart.items)
  currentItems.current=cart.items
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;purchaseContext.current=''}},[])
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
  const variant=resolveVariant(variants,wanted)
  const selectionKey=`${product?.id||''}:${wanted}:${variant?.id||''}`
  const first=product&&variant?firstQuantity(product,variant):null
  // A draft belongs to one exact selection, so it cannot bleed into the next SKU.
  const quantity=quantityDraft?.key===selectionKey?quantityDraft.value:String(first??'')
  purchaseContext.current=`${selectionKey}:${quantity}`
  useEffect(()=>{setQuantityDraft(null);setNotice(null)},[selectionKey])
  useEffect(()=>{setImageIndex(0);touch.current=null},[product?.id])
  useEffect(()=>{if(!zoomOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[zoomOpen])
  useEffect(()=>{
    const strip=thumbs.current,selected=strip?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if(!strip||!selected)return
    const left=selected.getBoundingClientRect().left-strip.getBoundingClientRect().left+strip.scrollLeft
    if(left<strip.scrollLeft||left+selected.offsetWidth>strip.scrollLeft+strip.clientWidth)strip.scrollTo({left:Math.max(0,left-(strip.clientWidth-selected.offsetWidth)/2),behavior:'auto'})
  },[imageIndex,product?.id])
  useEffect(()=>{
    const bar=mobileBar.current;if(loading||!product||!bar)return
    const body=document.body,root=document.documentElement,oldPadding=body.style.paddingBottom,oldScrollPadding=root.style.scrollPaddingBottom
    const basePadding=parseFloat(getComputedStyle(body).paddingBottom)||0,baseScrollPadding=parseFloat(getComputedStyle(root).scrollPaddingBottom)||0
    const update=()=>{const height=Math.ceil(bar.getBoundingClientRect().height);body.style.paddingBottom=height?`${basePadding+height}px`:oldPadding;root.style.scrollPaddingBottom=height?`${baseScrollPadding+height+16}px`:oldScrollPadding}
    const observer=new ResizeObserver(update);observer.observe(bar);window.addEventListener('resize',update);update()
    return()=>{observer.disconnect();window.removeEventListener('resize',update);body.style.paddingBottom=oldPadding;root.style.scrollPaddingBottom=oldScrollPadding}
  },[loading,product?.id])
  if(loading)return <main id="main-content" className="container p28Loading" aria-busy="true"><BuyerSkeleton kind="media"/><div><BuyerSkeleton kind="title"/><BuyerSkeleton/><BuyerSkeleton kind="button"/><p role="status">Loading product…</p></div></main>
  if(error)return <main id="main-content" className="container p28State"><BuyerAlert tone="error">{error}</BuyerAlert><BuyerButton onClick={()=>setAttempt(n=>n+1)}>Retry product</BuyerButton></main>
  if(!product)return <main id="main-content" className="container p28State"><h1>Product not available</h1><p>This product is not currently published.</p><BuyerButton href="/shop">Back to catalogue</BuyerButton></main>
  const p=product,images=[...(p.product_images||[])].filter(i=>safeAssetUrl(i.image_url)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)),index=Math.min(imageIndex,Math.max(0,images.length-1)),image=images[index]
  const unit=variant?linePrice(variant.selling_price,p.gst_rate,1):null
  const range=variants.map(v=>linePrice(v.selling_price,p.gst_rate,1)).filter((x):x is NonNullable<typeof x>=>!!x).sort((a,b)=>a.total-b.total)
  const invalidLink=!!wanted&&!variant,starting=unit||(!variant&&!invalidLink?range[0]:null)
  const existing=variant?rounded(cart.items.filter(i=>i.productVariantId===variant.id).reduce((s,i)=>s+i.qty,0),3):0
  const qtyError=variant?quantityError(quantity,p,variant,existing):null
  const totals=variant&&!qtyError?linePrice(variant.selling_price,p.gst_rate,quantity):null
  const stock=variant?remainingQuantity(variant.stock_qty):null,min=minimum(p),step=variant?quantityStep(variant):1
  const remaining=variant?remainingQuantity(variant.stock_qty,existing):null,max=variant?maximumQuantity(variant,existing):null
  const purchasable=p.product_type==='standard'&&!!variant&&!!unit&&first!==null
  const valid=purchasable&&!qtyError&&!!totals&&cart.ready
  const displayError=qtyError||(purchasable&&!totals?'This quantity produces an unsupported order total. Please enquire.':null)
  const decrease=variant?nextQuantity(quantity,-1,p,variant,existing):null,increase=variant?nextQuantity(quantity,1,p,variant,existing):null
  const enquiry=productEnquiry(p,variant,quantity)
  const specifications=specEntries(p.specifications,variant?.attributes)
  const documents=[{name:'Product datasheet',url:safeAssetUrl(p.datasheet_url)},{name:'Installation guide',url:safeAssetUrl(p.installation_guide_url)}].filter(x=>x.url)
  const stockText=stock===null?'Stock needs confirmation':stock===0?'Out of stock — supply on enquiry':first===null?'Quantity rules need confirmation':stock<first?`Stock below the minimum purchasable quantity (${first} ${variant?.unit||'units'})`:remaining===0&&existing>0?`All available stock is already in your cart (${existing} ${variant?.unit||'units'})`:`${stock} ${variant?.unit||'units'} in stock${existing>0?` · ${existing} already in cart · ${max??0} available to add`:''}`
  function setQuantity(value:string){setQuantityDraft({key:selectionKey,value})}
  function select(v:Variant){if(busy||v.id===variant?.id)return;const q=new URLSearchParams(window.location.search);q.set('variant',v.id);window.history.pushState(null,'',`${window.location.pathname}?${q}${window.location.hash}`);setNotice(null)}
  function move(delta:number){if(images.length)setImageIndex(i=>(Math.min(i,images.length-1)+delta+images.length)%images.length)}
  function galleryKeys(e:KeyboardEvent<HTMLElement>){
    if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey)return
    const modal=zoom.current
    if(e.key==='Tab'&&modal?.open&&e.currentTarget===modal){
      const controls=Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]')).filter(el=>el.tabIndex>=0&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden')
      const first=controls[0],last=controls[controls.length-1],active=document.activeElement
      if(first&&last&&(!modal.contains(active)||(e.shiftKey&&active===first)||(!e.shiftKey&&active===last))){e.preventDefault();(e.shiftKey?last:first).focus({preventScroll:true})}
      return
    }
    if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))return
    const next=galleryKeyIndex(e.key,index,images.length);if(next===null)return;e.preventDefault();setImageIndex(next)
  }
  function startTouch(e:TouchEvent<HTMLElement>){
    if(e.touches.length!==1||(e.target as HTMLElement).closest('button,a,input')){touch.current=null;return}
    const point=e.touches[0];touch.current={id:point.identifier,x:point.clientX,y:point.clientY,at:e.timeStamp}
  }
  function endTouch(e:TouchEvent<HTMLElement>){
    const start=touch.current;touch.current=null;if(!start||e.touches.length)return
    const point=Array.from(e.changedTouches).find(t=>t.identifier===start.id)
    const delta=gallerySwipe(start,point?{id:point.identifier,x:point.clientX,y:point.clientY,at:e.timeStamp}:null)
    if(delta)move(delta)
  }
  const touchHandlers={onTouchStart:startTouch,onTouchMove:(e:TouchEvent<HTMLElement>)=>{if(e.touches.length!==1)touch.current=null},onTouchEnd:endTouch,onTouchCancel:()=>{touch.current=null}}
  async function purchase(destination:'cart'|'buy'){
    if(lock.current||!variant||!valid)return
    const context=purchaseContext.current,href=window.location.href
    const sameSelection=()=>mounted.current&&purchaseContext.current===context&&window.location.href===href
    lock.current=true;setBusy(destination);setNotice(null)
    try{
      const {data,error}=await supabase.from('products').select(PUBLIC_PRODUCT_SELECT).eq('id',p.id).eq('status','active').eq('product_variants.is_active',true).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
      if(!sameSelection())return
      if(error)throw new Error('Could not verify the latest price and stock. Please retry.')
      const row=data as unknown as Detail|null,fresh=row?.categories?.is_active===false?null:row
      setProduct(fresh)
      const already=rounded(currentItems.current.filter(i=>i.productVariantId===variant.id).reduce((sum,i)=>sum+i.qty,0),3)
      const checked=checkPurchase(fresh,variant.id,quantity,already)
      if(!checked.ok)throw new Error(checked.error)
      // A recheck updates the displayed facts first; changed terms need another deliberate click.
      if(!unit||unit.unit!==checked.price.unit||unit.rate!==checked.price.rate||minimum(fresh!)!==min||quantityStep(checked.variant)!==step||checked.variant.unit!==variant.unit||checked.variant.sku!==variant.sku){
        setNotice({text:'Price, GST or quantity rules changed. Review the updated details and click again. Nothing was added.',error:true});return
      }
      const added=cart.addChecked({id:checked.variant.id,kind:'standard',productVariantId:checked.variant.id,name:fresh!.name,variant:checked.variant.title||checked.variant.sku,price:checked.price.unit,gstRate:checked.price.rate,minQty:firstQuantity(fresh!,checked.variant)!,quantityStep:quantityStep(checked.variant),qty:checked.quantity},finite(checked.variant.stock_qty)??0)
      if(!added.ok)throw new Error(added.error)
      setNotice({text:`Added ${checked.quantity} ${checked.variant.unit||'units'} to cart.`,error:false})
      if(destination==='buy')router.push('/checkout')
    }catch(err){if(sameSelection())setNotice({text:err instanceof Error?err.message:'Unable to add this product.',error:true})}
    finally{lock.current=false;if(mounted.current)setBusy(null)}
  }
  async function share(){try{if(navigator.share){await navigator.share({title:p.name,url:window.location.href});return}await navigator.clipboard.writeText(window.location.href);setNotice({text:'Product link copied with the selected variant.',error:false})}catch(err){if(!(err instanceof Error&&err.name==='AbortError'))setNotice({text:'Copy the page address from your browser to share this product.',error:true})}}
  const tabs=[['overview','Overview'],['specifications','Specifications'],['contents','In the box'],['downloads','Downloads']]
  return <main id="main-content" className="p28Page p282Refined"><div className="container">
    <nav className="p28Breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={13}/><Link href="/shop">Components</Link>{p.categories&&<><ChevronRight size={13}/><Link href={`/shop?category=${encodeURIComponent(p.categories.slug)}`}>{p.categories.name}</Link></>}<ChevronRight size={13}/><span aria-current="page">Product details</span></nav>
    <section className="p28Hero"><div className="p28Gallery"><div className="p28Photo" tabIndex={0} role="group" aria-label="Product gallery. Use arrow keys, Home or End to browse images." onKeyDown={galleryKeys} {...touchHandlers}>
      <Photo src={safeAssetUrl(image?.image_url)} alt={image?.alt_text||p.name} priority retryable/>
      {images.length>1&&<><button type="button" className="p28Arrow prev" onClick={()=>move(-1)} aria-label="Previous image"><ChevronLeft/></button><button type="button" className="p28Arrow next" onClick={()=>move(1)} aria-label="Next image"><ChevronRight/></button><span className="p28ImageCount" role="status" aria-live="polite" aria-atomic="true"><span className="p282SrOnly">Image </span>{index+1} / {images.length}</span></>}
      {images.length>0&&<button type="button" ref={zoomButton} className="p28Enlarge" onClick={()=>{if(!zoom.current?.open){zoom.current?.showModal();setZoomOpen(true)}}} aria-label="Enlarge product image"><ZoomIn size={18}/> Enlarge</button>}
    </div>{images.length>1&&<div ref={thumbs} className="p28Thumbnails" role="group" aria-label="Product image thumbnails">{images.map((img,i)=><button type="button" key={`${img.image_url}-${i}`} aria-label={`Show product image ${i+1}`} aria-pressed={i===index} className={i===index?'active':''} onClick={()=>setImageIndex(i)}><Photo src={safeAssetUrl(img.image_url)} alt="" sizes="76px"/></button>)}</div>}
    <p className="p28ImageNote">Product photographs are supplied from the catalogue. Confirm variant-specific contents in the specifications.</p>
    </div>
    <div className="p28Purchase"><div className="p28Eyebrow"><span>{p.categories?.name||'Solar component'}{p.brands?.is_active?` · ${p.brands.name}`:''}</span><button onClick={share}><Share2 size={15}/> Share</button></div><h1>{p.name}</h1>{p.short_description&&<p className="p28Lead">{p.short_description}</p>}
      <div className="p28PublishedBadges">{strings(p.product_badges).map((badge,i)=><span key={`${badge}-${i}`}>{badge}</span>)}</div>
      <div className="p28Meta"><span>SKU: <b>{variant?.sku||'Select an option'}</b></span><span>Min. order: <b>{Number.isFinite(min)?`${min} ${variant?.unit||'units'}`:'Needs confirmation'}</b></span>{p.warranty_months!==null&&p.warranty_months>0&&<span>Warranty: <b>{p.warranty_months} months</b></span>}{p.lead_time_days!==null&&p.lead_time_days>=0&&<span>Published lead time: <b>{p.lead_time_days} days</b></span>}</div>
      {(variants.length>1||(invalidLink&&variants.length===1))&&<fieldset className="p28Variants" ref={variantArea} disabled={!!busy}><legend>Choose a product option <span>Required</span></legend><div>{variants.map(v=>{const price=linePrice(v.selling_price,p.gst_rate,1);return <label key={v.id} className={variant?.id===v.id?'active':''}><input type="radio" name="product-variant" checked={variant?.id===v.id} onChange={()=>select(v)}/><span><b>{v.title||v.sku}</b><small>{v.sku}</small><small>{price?`${money(price.total)} incl. GST`:'Price on request'}</small></span>{variant?.id===v.id&&<CheckCircle2 size={18}/>}</label>})}</div></fieldset>}
      {invalidLink&&<BuyerAlert tone="warning">The option in this link is unavailable. Select a currently published option.</BuyerAlert>}
      <div className="p28PriceCard"><span>{variant?'Unit price':'Starting unit price'}</span><strong>{starting?`${!variant?'From ':''}${money(starting.total)}`:'Price on request'}{starting&&variant?.unit&&<small> / {variant.unit}</small>}</strong>{starting?<p>Base {money(starting.base)} + {starting.rate}% GST {money(starting.tax)}</p>:<p>{invalidLink?'Choose an available option to see its price.':'Pricing and applicable GST need confirmation from our team.'}</p>}
        {totals&&variant&&<div className="p28Totals" aria-live="polite" aria-atomic="true"><span>Selected quantity <b>{totals.quantity} {variant.unit||'units'}</b></span><span>Base amount <b>{money(totals.base)}</b></span><span>GST <b>{money(totals.tax)}</b></span><span>Total including GST <b>{money(totals.total)}</b></span></div>}
      </div>
      {variant&&<p className={`p28Stock ${first!==null&&max!==null&&max>=first?'available':''}`} role="status"><CheckCircle2 size={16}/>{stockText}</p>}
      {purchasable?<><label className="p28QtyLabel" htmlFor="product-quantity">Quantity ({variant!.unit||'units'})</label><div className="p28BuyRow"><div className="p28Qty"><button type="button" aria-label="Decrease quantity" disabled={!!busy||decrease===null||decrease===finite(quantity)} onClick={()=>{if(decrease!==null)setQuantity(String(decrease))}}><Minus size={17}/></button><input id="product-quantity" type="number" inputMode="decimal" min={first!} max={max===null?undefined:Math.max(first!,max)} step={step} value={quantity} disabled={!!busy} aria-invalid={!!displayError} aria-describedby={`product-quantity-hint${displayError?' product-quantity-error':''}`} onChange={e=>setQuantity(e.target.value)}/><button type="button" aria-label="Increase quantity" disabled={!!busy||increase===null||increase===finite(quantity)} onClick={()=>{if(increase!==null)setQuantity(String(increase))}}><Plus size={17}/></button></div><BuyerButton disabled={!valid||!!busy} onClick={()=>purchase('cart')}>{busy==='cart'?<LoaderCircle size={18}/>:<ShoppingCart size={18}/>}Add to Cart</BuyerButton><BuyerButton variant="secondary" disabled={!valid||!!busy} onClick={()=>purchase('buy')}>{busy==='buy'?'Checking…':'Buy Now'}<ArrowRight size={17}/></BuyerButton></div><p id="product-quantity-hint" className="p28Small">Order from {first} {variant!.unit||'units'}, in increments of {step}.{first!==min?` Published minimum: ${min}; ${first} is the first valid increment.`:''}</p>{displayError&&<p id="product-quantity-error" className="p28InputError">{displayError}</p>}<p className="p28Small">Buy Now adds this selection and opens checkout with your existing cart. It does not place an order or take payment.</p></>:!variant&&variants.length>0?<p className="p28SelectionPrompt">Select an option above to see its stock, specifications and purchase controls.</p>:<><BuyerButton href={enquiry}>Request price and availability</BuyerButton>{variant&&first===null&&<p className="p28InputError">The published quantity rules need confirmation before purchase.</p>}</>}
      <div className="p28Enquiry"><Link href={enquiry}><FileText size={17}/> Bulk / project enquiry <ArrowRight size={16}/></Link><span>The selected SKU and quantity are carried into your requirement.</span>{existing>0&&<Link href="/cart">Review items already in your cart</Link>}</div>
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
    <div ref={mobileBar} className="p28MobileBar" role="region" aria-label="Mobile purchase controls"><div><small>{variant?'Unit price':'Starting price'}</small><b>{starting?money(starting.total):'Enquire'}</b></div>{purchasable?<BuyerButton disabled={!valid||!!busy} onClick={()=>purchase('cart')}><ShoppingCart size={17}/>{busy?'Checking…':'Add to Cart'}</BuyerButton>:!variant&&variants.length>0?<BuyerButton onClick={()=>{variantArea.current?.scrollIntoView({block:'center'});variantArea.current?.querySelector('input')?.focus()}}>Choose option</BuyerButton>:<BuyerButton href={enquiry}>Enquire</BuyerButton>}</div>
    <dialog ref={zoom} className="p28Zoom p282Zoom" aria-label="Enlarged product image" aria-modal="true" onKeyDown={galleryKeys} onClose={()=>{setZoomOpen(false);touch.current=null;zoomButton.current?.focus({preventScroll:true})}} onPointerDown={e=>{backdropPress.current=e.target===e.currentTarget}} onClick={e=>{if(backdropPress.current&&e.target===e.currentTarget)zoom.current?.close();backdropPress.current=false}}><div><header><span>{p.name}</span><button type="button" autoFocus onClick={()=>zoom.current?.close()} aria-label="Close enlarged image"><X/></button></header><div className="p28ZoomImage" tabIndex={0} aria-label="Enlarged photo. Use arrow keys, Home or End to browse." {...touchHandlers}><Photo src={safeAssetUrl(image?.image_url)} alt={image?.alt_text||p.name} retryable sizes="95vw"/></div>{images.length>1&&<footer><button type="button" onClick={()=>move(-1)} aria-label="Previous enlarged image"><ChevronLeft/>Previous</button><span role="status" aria-live="polite" aria-atomic="true">{index+1} / {images.length}</span><button type="button" onClick={()=>move(1)} aria-label="Next enlarged image">Next<ChevronRight/></button></footer>}</div></dialog>
  </main>
}

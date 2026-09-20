'use client'
import Link from 'next/link'
import {Minus,Package,Plus,ShoppingBag,Trash2} from 'lucide-react'
import {useEffect,useState} from 'react'
import {useCart,type CartItem} from '../../components/CartProvider'
import {linePrice,rounded} from '../../lib/buyer-commerce'
import {money,safeAssetUrl} from '../../lib/catalogue'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
import {supabase} from '../../lib/supabase'

type ProductMedia={imageUrl?:string;imageAlt?:string;productSlug?:string}

function CartMedia({item,media}:{item:CartItem;media?:ProductMedia}){
  const src=safeAssetUrl(item.imageUrl||media?.imageUrl),[failed,setFailed]=useState(false)
  useEffect(()=>setFailed(false),[src])
  const content=src&&!failed?<img src={src} alt={item.imageAlt||media?.imageAlt||item.name} loading="lazy" onError={()=>setFailed(true)}/>:<span><Package/><small>{item.kind==='custom'?'Custom build':'Product'}</small></span>
  const slug=item.productSlug||media?.productSlug
  return slug?<Link className="cartThumb" href={`/product/${encodeURIComponent(slug)}`} aria-label={`View ${item.name}`}>{content}</Link>:<div className="cartThumb">{content}</div>
}

export default function Cart(){
  const {items,total,tax,grandTotal,ready,storageWarning,remove,updateQty}=useCart()
  const [media,setMedia]=useState<Record<string,ProductMedia>>({})
  useEffect(()=>{
    const missing=items.filter(item=>item.kind==='standard'&&item.productVariantId&&!item.imageUrl)
    if(!missing.length)return
    let alive=true
    supabase.from('products').select('slug,name,product_images(image_url,alt_text,sort_order),product_variants(id)').eq('status','active').then(({data})=>{
      if(!alive)return
      const next:Record<string,ProductMedia>={}
      for(const product of (data||[]) as any[]){
        const image=[...(product.product_images||[])].sort((a:any,b:any)=>Number(a.sort_order)-Number(b.sort_order))[0]
        for(const variant of product.product_variants||[])next[variant.id]={productSlug:product.slug,imageUrl:safeAssetUrl(image?.image_url)||undefined,imageAlt:image?.alt_text||product.name}
      }
      setMedia(next)
    })
    return()=>{alive=false}
  },[items])
  return <><StoreHeader/><main id="main-content" className="container cartPage"><div className="cartPageHead"><div><span className="eyebrow darkEye">YOUR ORDER</span><h1>Shopping Cart</h1><p>{!ready?'Loading saved cart…':items.length?`${items.length} line item${items.length>1?'s':''} ready for review.`:'Your cart is currently empty.'}</p></div><Link className="nisTextLink" href="/shop">Continue shopping →</Link></div>
    {storageWarning&&<p role="status">{storageWarning}</p>}
    {!ready?<p role="status">Loading…</p>:!items.length?<div className="emptyCart premiumEmpty"><ShoppingBag size={38}/><h2>Your cart is empty.</h2><p>Browse solar components or request a custom ACDB/DCDB.</p><div className="btnRow"><Link className="btn btnPrimary" href="/shop">Shop Products</Link><Link className="btn" href="/customize">Custom boxes</Link></div></div>:<div className="cartLayout"><section className="cartItemsPanel">{items.map(i=>{const price=linePrice(i.price,i.gstRate,i.qty),step=i.quantityStep||1,min=i.minQty||1;return <article className="cartRow" key={i.id}><div className="cartProduct"><CartMedia item={i} media={i.productVariantId?media[i.productVariantId]:undefined}/><div className="cartInfo"><span className="cartKind">{i.kind==='custom'?'Custom configuration':'Product'}</span><b>{i.name}</b><span>{i.variant}</span><small>Base {money(i.price)}{i.gstRate!=null?` + ${i.gstRate}% GST per unit`:' · Tax needs refresh at checkout'}</small></div></div><div className="cartCommerce"><div className="cartQty qtyModern"><button aria-label={`Decrease quantity of ${i.name}`} disabled={i.qty-step<min} onClick={()=>updateQty(i.id,rounded(i.qty-step,6))}><Minus size={14}/></button><span>{i.qty}</span><button aria-label={`Increase quantity of ${i.name}`} onClick={()=>updateQty(i.id,rounded(i.qty+step,6))}><Plus size={14}/></button></div><strong className="cartLineTotal">{money(price?.total??i.price*i.qty)}<small>{price?'incl. GST':'before GST'}</small></strong><button className="cartRemove" onClick={()=>remove(i.id)}><Trash2 size={15}/> Remove</button></div></article>})}</section><aside className="summary"><h2>Order Summary</h2><div><span>Subtotal before GST</span><b>{money(total)}</b></div><div><span>GST</span><b>{tax===null?'Needs confirmation':money(tax)}</b></div><div><span>Shipping</span><span>Confirmed at checkout</span></div><div className="grand"><span>{grandTotal===null?'Before tax':'Total incl. GST'}</span><b>{money(grandTotal??total)}</b></div><p className="summaryNote">These are saved estimates. Final price, quantity and tax require confirmation before ordering.</p><Link className="btn btnPrimary fullBtn" href="/checkout">Proceed to Checkout</Link><Link className="bulkLink" href="/bulk-order">Request project pricing →</Link></aside></div>}
  </main><StoreFooter/></>
}

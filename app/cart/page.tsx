'use client'

import Link from 'next/link'
import QuantityControl from '../../components/buyer/QuantityControl'
import {Package, ShoppingBag, Trash2} from 'lucide-react'
import {useEffect, useState} from 'react'
import {useCart, type CartItem} from '../../components/CartProvider'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
import {supabase} from '../../lib/supabase'
import {safeAssetUrl} from '../../lib/catalogue'

const GST_RATE=18
const money=(n:number)=>`₹${Math.round(n).toLocaleString('en-IN')}`
const gst=(n:number)=>Math.round(n*GST_RATE/100)
type ProductMedia={imageUrl?:string;imageAlt?:string;productSlug?:string}

function CartMedia({item,media}:{item:CartItem;media?:ProductMedia}){
  const src=safeAssetUrl(item.imageUrl||media?.imageUrl),[failed,setFailed]=useState(false)
  useEffect(()=>setFailed(false),[src])
  const content=src&&!failed?<img src={src} alt={item.imageAlt||media?.imageAlt||item.name} loading="lazy" onError={()=>setFailed(true)}/>:<span><Package/><small>{item.kind==='custom'?'Custom build':'Product'}</small></span>
  const slug=item.productSlug||media?.productSlug
  return slug?<Link className="cartThumb" href={`/product/${encodeURIComponent(slug)}`} aria-label={`View ${item.name}`}>{content}</Link>:<div className="cartThumb">{content}</div>
}

export default function Cart(){
  const {items,total,remove,updateQty}=useCart()
  const [media,setMedia]=useState<Record<string,ProductMedia>>({})
  useEffect(()=>{const missing=items.filter(item=>item.kind==='standard'&&item.productVariantId&&!item.imageUrl);if(!missing.length)return;let alive=true;supabase.from('products').select('slug,name,product_images(image_url,alt_text,sort_order),product_variants(id)').eq('status','active').then(({data})=>{if(!alive)return;const next:Record<string,ProductMedia>={};for(const product of (data||[]) as any[]){const image=[...(product.product_images||[])].sort((a:any,b:any)=>Number(a.sort_order)-Number(b.sort_order))[0];for(const variant of product.product_variants||[])next[variant.id]={productSlug:product.slug,imageUrl:safeAssetUrl(image?.image_url)||undefined,imageAlt:image?.alt_text||product.name}}setMedia(next)});return()=>{alive=false}},[items])
  const gstAmount=gst(total),grand=total+gstAmount
  return <><StoreHeader/><main className="container cartPage"><div className="cartPageHead"><div><span className="eyebrow darkEye">YOUR ORDER</span><h1>Shopping Cart</h1><p>{items.length?`${items.length} line item${items.length>1?'s':''} ready for review with +18% GST.`:'Your cart is currently empty.'}</p></div><Link className="nisTextLink" href="/shop">Continue shopping →</Link></div>{!items.length?<div className="emptyCart premiumEmpty"><ShoppingBag size={38}/><h2>Your cart is empty.</h2><p>Browse solar components or configure your own ACDB/DCDB.</p><div className="btnRow"><Link className="btn btnPrimary" href="/shop">Shop Products</Link><Link className="btn" href="/customize/dcdb">Build DCDB</Link></div></div>:<div className="cartLayout"><section className="cartItemsPanel">{items.map(i=>{const base=i.price*i.qty,tax=gst(base),incl=base+tax;return <article className="cartRow" key={i.id}><div className="cartProduct"><CartMedia item={i} media={i.productVariantId?media[i.productVariantId]:undefined}/><div className="cartInfo"><span className="cartKind">{i.kind==='custom'?'Custom configuration':'Product'}</span><b>{i.name}</b><span>{i.variant}</span><small>Base {money(i.price)} + {GST_RATE}% GST per unit</small></div></div><div className="cartCommerce"><div className="cartQty"><span>Quantity</span><QuantityControl value={i.qty} min={i.minQty||1} label={`Quantity of ${i.name}`} onChange={q=>updateQty(i.id,q)}/></div><strong className="cartLineTotal">{money(incl)}<small>incl. GST</small></strong><button className="cartRemove" onClick={()=>remove(i.id)}><Trash2 size={15}/> Remove</button></div></article>})}</section><aside className="summary"><h2>Order Summary</h2><div><span>Subtotal before GST</span><b>{money(total)}</b></div><div><span>GST @ {GST_RATE}%</span><b>{money(gstAmount)}</b></div><div><span>Shipping</span><span>Calculated at checkout</span></div><div className="grand"><span>Total incl. GST</span><b>{money(grand)}</b></div><p className="summaryNote">Final price and tax are verified against Supabase during secure order creation.</p><Link className="btn btnPrimary fullBtn" href="/checkout">Proceed to Secure Checkout</Link><Link className="bulkLink" href="/bulk-order">Buying for a project? Request bulk price →</Link></aside></div>}</main><StoreFooter/></>
}

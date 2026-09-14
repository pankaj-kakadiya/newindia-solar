'use client'

import Link from 'next/link'
import {Minus, Plus, ShoppingBag, Trash2} from 'lucide-react'
import {useCart} from '../../components/CartProvider'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'

const GST_RATE=18
const money=(n:number)=>`₹${Math.round(n).toLocaleString('en-IN')}`
const gst=(n:number)=>Math.round(n*GST_RATE/100)

export default function Cart(){
  const {items,total,remove,updateQty}=useCart()
  const gstAmount=gst(total),grand=total+gstAmount
  return <><StoreHeader/><main className="container cartPage"><div className="cartPageHead"><div><span className="eyebrow darkEye">YOUR ORDER</span><h1>Shopping Cart</h1><p>{items.length?`${items.length} line item${items.length>1?'s':''} ready for review with +18% GST.`:'Your cart is currently empty.'}</p></div><Link className="nisTextLink" href="/shop">Continue shopping →</Link></div>{!items.length?<div className="emptyCart premiumEmpty"><ShoppingBag size={38}/><h2>Your cart is empty.</h2><p>Browse solar components or configure your own ACDB/DCDB.</p><div className="btnRow"><Link className="btn btnPrimary" href="/shop">Shop Products</Link><Link className="btn" href="/customize/dcdb">Build DCDB</Link></div></div>:<div className="cartLayout"><section className="cartItemsPanel">{items.map(i=>{const base=i.price*i.qty,tax=gst(base),incl=base+tax;return <div className="cartRow" key={i.id}><div className="cartThumb">{i.kind==='custom'?'BUILD':'ITEM'}</div><div className="cartInfo"><span className="cartKind">{i.kind==='custom'?'Custom configuration':'Product'}</span><b>{i.name}</b><span>{i.variant}</span><small>Base {money(i.price)} + {GST_RATE}% GST per unit</small><button onClick={()=>remove(i.id)}><Trash2 size={13}/> Remove</button></div><div className="qty qtyModern"><button aria-label="Decrease quantity" onClick={()=>updateQty(i.id,i.qty-1)}><Minus size={14}/></button><span>{i.qty}</span><button aria-label="Increase quantity" onClick={()=>updateQty(i.id,i.qty+1)}><Plus size={14}/></button></div><strong>{money(incl)}<small>incl. GST</small></strong></div>})}</section><aside className="summary"><h2>Order Summary</h2><div><span>Subtotal before GST</span><b>{money(total)}</b></div><div><span>GST @ {GST_RATE}%</span><b>{money(gstAmount)}</b></div><div><span>Shipping</span><span>Calculated at checkout</span></div><div className="grand"><span>Total incl. GST</span><b>{money(grand)}</b></div><p className="summaryNote">Final price and tax are verified against Supabase during secure order creation.</p><Link className="btn btnPrimary fullBtn" href="/checkout">Proceed to Secure Checkout</Link><Link className="bulkLink" href="/bulk-order">Buying for a project? Request bulk price →</Link></aside></div>}</main><StoreFooter/></>
}

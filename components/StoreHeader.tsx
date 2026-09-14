'use client'

import Link from 'next/link'
import { Menu, Search, ShoppingCart, User, X, ChevronDown } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { useCart } from './CartProvider'
import {useStoreTheme} from './ThemeProvider'

export default function StoreHeader(){
  const {count}=useCart()
  const {theme}=useStoreTheme()
  const [open,setOpen]=useState(false)
  const [searchOpen,setSearchOpen]=useState(false)
  const [q,setQ]=useState('')
  const b=theme.branding
  function submit(e:FormEvent){e.preventDefault();if(q.trim())window.location.href=`/shop?q=${encodeURIComponent(q.trim())}`}
  return <>
    <div className="nisTopbar"><div className="container nisTopbarInner"><span>{b.tagline}</span><div>{theme.header.topbarItems.map(item=><span key={item}>{item}</span>)}</div></div></div>
    <header className="nisHeader"><div className="container nisNav">
      <button className="nisMobileBtn" aria-label="Open menu" onClick={()=>setOpen(true)}><Menu size={22}/></button>
      <Link href="/" className="nisBrand"><img src={b.logoUrl} alt={b.logoAlt}/></Link>
      <nav className="nisDesktopNav">
        <Link href="/shop">Products</Link>
        <div className="nisNavDrop"><button>Customize <ChevronDown size={14}/></button><div className="nisDropMenu"><Link href="/customize/acdb">Build ACDB</Link><Link href="/customize/dcdb">Build DCDB</Link></div></div>
        <Link href="/bulk-order">Bulk Order</Link>
        <Link href="/#why-us">Why New India</Link>
        <Link href="/#contact">Contact</Link>
      </nav>
      <div className="nisNavActions">
        <button aria-label="Search" onClick={()=>setSearchOpen(true)}><Search size={20}/></button>
        <Link href="/account" aria-label="Account"><User size={20}/></Link>
        <Link href="/cart" aria-label="Cart" className="nisCartAction"><ShoppingCart size={20}/>{count>0&&<span>{count>99?'99+':count}</span>}</Link>
      </div>
    </div></header>
    {open&&<div className="nisDrawerWrap" onClick={()=>setOpen(false)}><aside className="nisDrawer" onClick={e=>e.stopPropagation()}><div className="nisDrawerHead"><img src={b.logoUrl} alt={b.logoAlt}/><button onClick={()=>setOpen(false)} aria-label="Close menu"><X/></button></div><nav><Link href="/shop">Shop All Products</Link><Link href="/customize/acdb">Build ACDB</Link><Link href="/customize/dcdb">Build DCDB</Link><Link href="/bulk-order">Bulk / Project Requirement</Link><Link href="/account">My Account</Link><Link href="/cart">Cart ({count})</Link></nav><div className="nisDrawerFoot">ACDB • DCDB • BOS Components<br/><small>{b.companyName}</small></div></aside></div>}
    {searchOpen&&<div className="nisSearchOverlay"><div className="nisSearchModal"><button className="nisSearchClose" onClick={()=>setSearchOpen(false)}><X/></button><span>SEARCH NEW INDIA SOLAR</span><h2>What component are you looking for?</h2><form onSubmit={submit}><Search size={21}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search ACDB, DCDB, SPD, cable, MCB..."/><button>Search</button></form><div className="nisQuickSearch"><Link href="/shop">All Products</Link><Link href="/customize/acdb">ACDB Builder</Link><Link href="/customize/dcdb">DCDB Builder</Link></div></div></div>}
  </>
}

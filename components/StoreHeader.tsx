'use client'

import Link from 'next/link'
import { Menu, Search, ShoppingCart, User, X, ChevronDown, ArrowUpRight } from 'lucide-react'
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { useCart } from './CartProvider'
import {useStoreTheme} from './ThemeProvider'
import {supabase} from '../lib/supabase'

export default function StoreHeader(){
  const {count}=useCart()
  const {theme}=useStoreTheme()
  const [open,setOpen]=useState(false)
  const [searchOpen,setSearchOpen]=useState(false)
  const [q,setQ]=useState('')
  const [items,setItems]=useState<any[]>([])
  const [active,setActive]=useState(0)
  const b=theme.branding
  const headerLogo=b.headerLogoUrl||b.logoUrl
  const mobileLogo=b.mobileLogoUrl||headerLogo
  const smartTerms=['ACDB','DCDB','SPD','MCB','MCCB','Solar Cable','MC4 Connector','Earthing Kit','2 In 2 Out DCDB','1000V DC SPD']
  useEffect(()=>{if(!searchOpen)return;supabase.from('products').select('name,slug,short_description,categories(name,slug),product_variants(selling_price)').eq('status','active').limit(60).then(({data})=>setItems(data||[]));function esc(e:globalThis.KeyboardEvent){if(e.key==='Escape')setSearchOpen(false)}window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[searchOpen])
  const suggestions=useMemo(()=>{const term=q.toLowerCase().trim();const productHits=items.filter((p:any)=>!term||`${p.name} ${p.short_description||''} ${p.categories?.name||''}`.toLowerCase().includes(term)).slice(0,7);const termHits=smartTerms.filter(x=>!term||x.toLowerCase().includes(term)).slice(0,5).map(x=>({term:x}));return [...productHits,...termHits].slice(0,9)},[q,items])
  useEffect(()=>setActive(0),[q,searchOpen])
  function go(value?:any){const picked=value||suggestions[active];if(picked?.slug){window.location.href=`/product/${picked.slug}`;return}const term=picked?.term||q.trim();if(term)window.location.href=`/shop?q=${encodeURIComponent(term)}`;else window.location.href='/shop'}
  function submit(e:FormEvent){e.preventDefault();go()}
  function keys(e:KeyboardEvent<HTMLInputElement>){if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,Math.max(0,suggestions.length-1)))}if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1))}if(e.key==='Enter'){e.preventDefault();go()}if(e.key==='Escape'){e.preventDefault();setSearchOpen(false)}}
  return <>
    <div className="nisTopbar"><div className="container nisTopbarInner"><span>{b.tagline}</span><div>{theme.header.topbarItems.map(item=><span key={item}>{item}</span>)}</div></div></div>
    <header className="nisHeader"><div className="container nisNav">
      <button className="nisMobileBtn" aria-label="Open menu" onClick={()=>setOpen(true)}><Menu size={22}/></button>
      <Link href="/" className="nisBrand"><img src={headerLogo} alt={b.logoAlt}/></Link>
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
    {open&&<div className="nisDrawerWrap" onClick={()=>setOpen(false)}><aside className="nisDrawer" onClick={e=>e.stopPropagation()}><div className="nisDrawerHead"><img src={mobileLogo} alt={b.logoAlt}/><button onClick={()=>setOpen(false)} aria-label="Close menu"><X/></button></div><nav><Link href="/shop">Shop All Products</Link><Link href="/customize/acdb">Build ACDB</Link><Link href="/customize/dcdb">Build DCDB</Link><Link href="/bulk-order">Bulk / Project Requirement</Link><Link href="/account">My Account</Link><Link href="/cart">Cart ({count})</Link></nav><div className="nisDrawerFoot">ACDB • DCDB • BOS Components<br/><small>{b.companyName}</small></div></aside></div>}
    {searchOpen&&<div className="nisSearchOverlay"><div className="nisSearchModal smartSearch"><button className="nisSearchClose" onClick={()=>setSearchOpen(false)}><X/></button><span>SMART SEARCH</span><h2>Search products, categories or ratings.</h2><form onSubmit={submit} role="search"><Search size={21}/><input autoFocus value={q} onKeyDown={keys} onChange={e=>setQ(e.target.value)} placeholder="Try: 2 In 2 Out DCDB, SPD, cable, MCB..." aria-label="Search products"/><button>Search</button></form><div className="smartHint">Use ↑ ↓ to select • Enter to open • Esc to close</div><div className="suggestionList" role="listbox">{suggestions.map((s:any,i:number)=><button key={s.slug||s.term} className={i===active?'active':''} onMouseEnter={()=>setActive(i)} onClick={()=>go(s)} role="option" aria-selected={i===active}><div><b>{s.name||s.term}</b><small>{s.categories?.name||s.short_description||'Search suggestion'}</small></div><span>{s.product_variants?.[0]?.selling_price?`₹${Number(s.product_variants[0].selling_price).toLocaleString('en-IN')}`:<ArrowUpRight size={15}/>}</span></button>)}</div><div className="nisQuickSearch">{smartTerms.slice(0,6).map(t=><button key={t} onClick={()=>go({term:t})}>{t}</button>)}<Link href="/customize/acdb">ACDB Builder</Link><Link href="/customize/dcdb">DCDB Builder</Link></div></div></div>}
  </>
}

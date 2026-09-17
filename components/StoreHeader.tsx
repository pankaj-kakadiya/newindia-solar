'use client'

import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import {ArrowRight,ArrowUpRight,Boxes,Building2,Cable,ChevronDown,CircleGauge,FileText,Headphones,Layers,Menu,PackageCheck,PlugZap,Search,Settings2,ShieldCheck,ShoppingCart,Sparkles,User,Wrench,X,Zap} from 'lucide-react'
import {FormEvent,KeyboardEvent,useEffect,useMemo,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useCart} from './CartProvider'
import {useSiteContent} from './SiteContentProvider'
import {useStoreTheme} from './ThemeProvider'

type MenuName='products'|'customize'
type SearchProduct={name:string;slug:string;short_description?:string|null;categories?:{name?:string|null;slug?:string|null}|null;product_variants?:Array<{selling_price?:number|string|null}>|null}
type SearchSuggestion=SearchProduct|{term:string}

const productGroups=[
 {name:'ACDB',desc:'AC protection & distribution',href:'/categories/acdb',icon:Zap},
 {name:'DCDB',desc:'DC combiner & protection',href:'/categories/dcdb',icon:ShieldCheck},
 {name:'MCB / MCCB',desc:'Circuit protection devices',href:'/categories/mcb-mccb',icon:CircleGauge},
 {name:'SPD',desc:'AC & DC surge protection',href:'/categories/spd',icon:PlugZap},
 {name:'Solar Cable',desc:'DC cable & internal wiring',href:'/categories/solar-cable',icon:Cable},
 {name:'Earthing Kit',desc:'Project earthing solutions',href:'/categories/earthing-kits',icon:Layers},
 {name:'MC4 Connectors',desc:'PV connectors & accessories',href:'/categories/mc4-connectors',icon:Settings2},
 {name:'DC Fuse',desc:'Fuse links & holders',href:'/categories/dc-fuses',icon:CircleGauge},
 {name:'Enclosures',desc:'IP-rated industrial boxes',href:'/categories/enclosures',icon:Boxes},
 {name:'Terminal Blocks',desc:'Internal connection systems',href:'/categories/terminal-blocks',icon:Wrench},
 {name:'Cable Glands',desc:'Sealed cable entry',href:'/categories/cable-glands',icon:PackageCheck},
 {name:'BOS Accessories',desc:'Balance-of-system parts',href:'/categories/bos-accessories',icon:Sparkles},
]
const smartTerms=['ACDB','DCDB','SPD','MCB','MCCB','Solar Cable','MC4 Connector','Earthing Kit','2 In 2 Out DCDB','1000V DC SPD']
const hiddenCmsLabels=new Set(['products','customize','bulk order','project rfq'])
function isProductSuggestion(value:SearchSuggestion):value is SearchProduct{return 'slug' in value}

export default function StoreHeader(){
 const pathname=usePathname(),router=useRouter(),{count}=useCart(),{theme}=useStoreTheme(),{site,navigation}=useSiteContent(),branding=theme.branding
 const [mobileOpen,setMobileOpen]=useState(false),[mobileSection,setMobileSection]=useState<MenuName|null>('products'),[mega,setMega]=useState<MenuName|null>(null),[searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState(''),[items,setItems]=useState<SearchProduct[]>([]),[active,setActive]=useState(0)
 const headerRef=useRef<HTMLElement|null>(null),headerLogo=branding.headerLogoUrl||branding.logoUrl,mobileLogo=branding.mobileLogoUrl||headerLogo
 const headerLinks=navigation.filter(item=>item.area==='header'&&!hiddenCmsLabels.has(item.label.toLowerCase().trim())).sort((a,b)=>a.sort_order-b.sort_order)

 useEffect(()=>{if(!searchOpen||items.length)return;let alive=true;supabase.from('products').select('name,slug,short_description,categories(name,slug),product_variants(selling_price)').eq('status','active').limit(60).then(({data})=>{if(alive)setItems((data||[]) as unknown as SearchProduct[])});return()=>{alive=false}},[searchOpen,items.length])
 useEffect(()=>{function onKeyDown(event:globalThis.KeyboardEvent){if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setMega(null);setSearchOpen(true)}if(event.key==='Escape'){setMega(null);setMobileOpen(false);setSearchOpen(false)}}function onOutsideClick(event:MouseEvent){if(mega&&headerRef.current&&!headerRef.current.contains(event.target as Node))setMega(null)}window.addEventListener('keydown',onKeyDown);window.addEventListener('mousedown',onOutsideClick);return()=>{window.removeEventListener('keydown',onKeyDown);window.removeEventListener('mousedown',onOutsideClick)}},[mega])
 useEffect(()=>{setMega(null);setMobileOpen(false);setSearchOpen(false);const main=document.querySelector('main');if(main&&!main.id)main.id='main-content'},[pathname])
 useEffect(()=>{if(!mobileOpen&&!searchOpen)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previousOverflow}},[mobileOpen,searchOpen])
 useEffect(()=>setActive(0),[query,searchOpen])

 const suggestions=useMemo<SearchSuggestion[]>(()=>{const term=query.toLowerCase().trim();const productHits=items.filter(product=>!term||`${product.name} ${product.short_description||''} ${product.categories?.name||''}`.toLowerCase().includes(term)).slice(0,7);const termHits=smartTerms.filter(value=>!term||value.toLowerCase().includes(term)).slice(0,5).map(value=>({term:value}));return[...productHits,...termHits].slice(0,9)},[query,items])
 function closeAll(){setMega(null);setMobileOpen(false)}
 function toggleMega(next:MenuName){setMega(current=>current===next?null:next)}
 function go(value?:SearchSuggestion){const picked=value||suggestions[active];setSearchOpen(false);if(picked&&isProductSuggestion(picked)){router.push(`/product/${picked.slug}`);return}const term=picked&&'term' in picked?picked.term:query.trim();router.push(term?`/shop?q=${encodeURIComponent(term)}`:'/shop')}
 function submit(event:FormEvent){event.preventDefault();go()}
 function searchKeys(event:KeyboardEvent<HTMLInputElement>){if(event.key==='ArrowDown'){event.preventDefault();setActive(index=>Math.min(index+1,Math.max(0,suggestions.length-1)))}if(event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(0,index-1))}if(event.key==='Enter'){event.preventDefault();go()}if(event.key==='Escape'){event.preventDefault();setSearchOpen(false)}}
 function navigationLink(item:(typeof navigation)[number],className=''){const label=item.label.toLowerCase().trim(),href=label==='why new india'?'/why-new-india':label==='contact'||label==='contact us'?'/contact':item.href;return item.is_external?<a className={className} href={href} target="_blank" rel="noreferrer" onClick={closeAll}>{item.label}<ArrowUpRight size={13}/></a>:<Link className={className} href={href} onClick={closeAll}>{item.label}</Link>}

 return <>
  <a className="nhSkipLink" href="#main-content">Skip to content</a>
  {site.announcement_enabled&&site.announcement_text&&<div className="cmsAnnouncement"><div className="container"><span>{site.announcement_text}</span>{site.announcement_href&&<Link href={site.announcement_href}>{site.announcement_label||'Learn more'} <ArrowRight size={13}/></Link>}</div></div>}
  {site.topbar_enabled!==false&&<div className="nhTopbar"><div className="container nhTopbarInner"><span>{site.topbar_message||branding.tagline}</span><div>{(site.topbar_items||[]).map((item:string)=><span key={item}>{item}</span>)}</div></div></div>}
  <header className="nhHeader" ref={headerRef}>
   <div className="container nhNav">
    <button className="nhMobileBtn" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="buyer-mobile-navigation" onClick={()=>setMobileOpen(true)}><Menu size={22}/></button>
    <Link href="/" className="nhBrand" aria-label="New India Solar home"><img src={headerLogo} alt={branding.logoAlt}/></Link>
    <nav className="nhDesktopNav" aria-label="Primary navigation">
     <button className={mega==='products'?'active':''} aria-expanded={mega==='products'} aria-controls="products-mega-menu" onClick={()=>toggleMega('products')}>Products <ChevronDown size={14}/></button>
     <Link href="/categories">Categories</Link><Link href="/categories/acdb">ACDB</Link><Link href="/categories/dcdb">DCDB</Link>
     <button className={mega==='customize'?'active':''} aria-expanded={mega==='customize'} aria-controls="customize-mega-menu" onClick={()=>toggleMega('customize')}>Build a Box <ChevronDown size={14}/></button>
     {headerLinks.map(item=><span className="nhCmsNavItem" key={item.id}>{navigationLink(item)}</span>)}
    </nav>
    <div className="nhActions">
     <button className="nhSearchAction" aria-label="Search products" onClick={()=>{setMega(null);setSearchOpen(true)}}><Search size={19}/><span>Search</span><kbd>⌘K</kbd></button>
     <Link href="/bulk-order" className="nhQuoteAction"><FileText size={16}/><span>Project RFQ</span></Link>
     <Link href="/account" aria-label="My account"><User size={19}/></Link>
     <Link href="/cart" className="nhCart" aria-label={`Cart with ${count} items`}><ShoppingCart size={19}/>{count>0&&<b>{count>99?'99+':count}</b>}</Link>
    </div>
   </div>
   {mega==='products'&&<div className="nhMega" id="products-mega-menu"><div className="container nhMegaProducts"><div className="nhMegaMain"><div className="nhMegaTitle"><div><span>PRODUCT CATALOGUE</span><h2>Solar protection & BOS components</h2></div><Link href="/shop" onClick={closeAll}>View all products <ArrowRight size={15}/></Link></div><div className="nhMegaGrid">{productGroups.map(({name,desc,href,icon:Icon})=><Link key={name} href={href} onClick={closeAll}><i><Icon size={18}/></i><span><b>{name}</b><small>{desc}</small></span><ArrowRight size={14}/></Link>)}</div></div><aside className="nhMegaAside"><span>PROJECT BUYING</span><h3>Need a complete box or project quote?</h3><p>Move from individual components to a configured ACDB/DCDB or submit your complete project requirement.</p><Link href="/customize" onClick={closeAll}><Settings2 size={17}/> Configure ACDB / DCDB</Link><Link href="/bulk-order" onClick={closeAll}><FileText size={17}/> Submit project RFQ</Link><div><ShieldCheck size={16}/><span><b>Tested. Packed. Guaranteed.</b><small>Built for installation workflows.</small></span></div></aside></div></div>}
   {mega==='customize'&&<div className="nhMega" id="customize-mega-menu"><div className="container nhMegaCustom nhMegaCustomV3"><div className="nhCustomIntro"><span>PROJECT CONFIGURATION</span><h2>Get the protection setup your site needs.</h2><p>Buy a published ACDB + DCDB pair or prepare a custom box requirement for engineering review.</p><Link href="/shop" onClick={closeAll}>Or shop ready products <ArrowRight size={15}/></Link></div><Link className="nhBuildCard combo" href="/combo" onClick={closeAll}><div><span>DIRECT PURCHASE</span><i>AC+DC</i></div><h3>ACDB + DCDB Combo</h3><p>Choose two published boxes • Set quantities • Add both to cart</p><strong>Create combo <ArrowRight size={16}/></strong></Link><Link className="nhBuildCard dark" href="/customize/acdb" onClick={closeAll}><div><span>CUSTOM QUOTE</span><i>AC</i></div><h3>Build Your ACDB</h3><p>System size • Phase • MCB/MCCB • SPD • Busbar • Wiring</p><strong>Start builder <ArrowRight size={16}/></strong></Link><Link className="nhBuildCard green" href="/customize/dcdb" onClick={closeAll}><div><span>CUSTOM QUOTE</span><i>DC</i></div><h3>Build Your DCDB</h3><p>Strings • Voltage • DC MCB • SPD • Fuse • Cable • Glands</p><strong>Start builder <ArrowRight size={16}/></strong></Link></div></div>}
  </header>
  {mobileOpen&&<div className="nhMobileOverlay" role="presentation" onClick={()=>setMobileOpen(false)}><aside className="nhMobileDrawer" id="buyer-mobile-navigation" role="dialog" aria-modal="true" aria-label="Buyer navigation" onClick={event=>event.stopPropagation()}><div className="nhMobileHead"><img src={mobileLogo} alt={branding.logoAlt}/><button aria-label="Close navigation" onClick={()=>setMobileOpen(false)}><X size={21}/></button></div><button className="nhMobileSearch" onClick={()=>{setMobileOpen(false);setSearchOpen(true)}}><Search size={18}/> Search products <span>⌘K</span></button><div className="nhMobileJourneys" aria-label="Quick buying actions"><Link href="/shop" onClick={closeAll}><ShoppingCart size={17}/><span><b>Buy Products</b><small>Browse catalogue</small></span></Link><Link href="/combo" onClick={closeAll}><Layers size={17}/><span><b>ACDB + DCDB</b><small>Create combo</small></span></Link><Link href="/bulk-order" onClick={closeAll}><FileText size={17}/><span><b>Project RFQ</b><small>Bulk pricing</small></span></Link></div><nav className="nhMobileNav" aria-label="Mobile navigation"><Link href="/categories" onClick={closeAll}>All Categories <Boxes size={16}/></Link><button aria-expanded={mobileSection==='products'} onClick={()=>setMobileSection(mobileSection==='products'?null:'products')}>Products <ChevronDown size={16}/></button>{mobileSection==='products'&&<div className="nhMobileSub">{productGroups.map(({name,href})=><Link key={name} href={href} onClick={closeAll}>{name}<ArrowRight size={13}/></Link>)}<Link className="all" href="/shop" onClick={closeAll}>View all products <ArrowRight size={13}/></Link></div>}<button aria-expanded={mobileSection==='customize'} onClick={()=>setMobileSection(mobileSection==='customize'?null:'customize')}>ACDB / DCDB Solutions <ChevronDown size={16}/></button>{mobileSection==='customize'&&<div className="nhMobileSub nhMobileBuilders"><Link href="/combo" onClick={closeAll}>Buy ACDB + DCDB combo <ArrowRight size={13}/></Link><Link href="/customize/acdb" onClick={closeAll}>Build custom ACDB <ArrowRight size={13}/></Link><Link href="/customize/dcdb" onClick={closeAll}>Build custom DCDB <ArrowRight size={13}/></Link></div>}{headerLinks.map(item=><span className="nhMobileCmsItem" key={item.id}>{navigationLink(item)}</span>)}<Link href="/account" onClick={closeAll}>My Account <User size={16}/></Link><Link href="/cart" onClick={closeAll}>Cart <span>{count}</span></Link></nav><div className="nhMobileSupport"><Headphones size={18}/><span><b>Need help selecting components?</b><small>Send your requirement through Project RFQ.</small></span><Link href="/bulk-order" onClick={closeAll}>Ask</Link></div><div className="nhMobileFoot"><Building2 size={18}/><div><b>New India Solar Components Pvt Ltd</b><span>{branding.tagline}</span></div></div></aside></div>}
  {searchOpen&&<div className="nisSearchOverlay" onMouseDown={event=>{if(event.target===event.currentTarget)setSearchOpen(false)}}><div className="nisSearchModal smartSearch" role="dialog" aria-modal="true" aria-labelledby="buyer-search-title"><button className="nisSearchClose" aria-label="Close search" onClick={()=>setSearchOpen(false)}><X/></button><span>SMART SEARCH</span><h2 id="buyer-search-title">Search products, categories or ratings.</h2><form onSubmit={submit}><Search size={21}/><input autoFocus value={query} onKeyDown={searchKeys} onChange={event=>setQuery(event.target.value)} placeholder="Try: 2 In 2 Out DCDB, SPD, cable, MCB..." aria-label="Search products" aria-autocomplete="list"/><button>Search</button></form><div className="smartHint">Use ↑ ↓ to select • Enter to open • Esc to close</div><div className="suggestionList" role="listbox">{suggestions.map((suggestion,index)=>{const product=isProductSuggestion(suggestion)?suggestion:null,price=product?.product_variants?.[0]?.selling_price;return <button key={product?.slug||('term' in suggestion?suggestion.term:index)} className={index===active?'active':''} role="option" aria-selected={index===active} onMouseEnter={()=>setActive(index)} onClick={()=>go(suggestion)}><div><b>{product?.name||('term' in suggestion?suggestion.term:'')}</b><small>{product?.categories?.name||product?.short_description||'Search suggestion'}</small></div><span>{price?`₹${Number(price).toLocaleString('en-IN')}`:<ArrowUpRight size={15}/>}</span></button>})}</div></div></div>}
 </>
}

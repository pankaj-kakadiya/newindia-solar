'use client'
import Link from 'next/link'
import {ArrowRight,ExternalLink,Mail,MapPin,Phone,ShieldCheck} from 'lucide-react'
import {useStoreTheme} from './ThemeProvider'
import {useSiteContent} from './SiteContentProvider'

export default function StoreFooter(){
 const {theme}=useStoreTheme(),{footer,navigation,footerPages}=useSiteContent();const b=theme.branding;const footerLogo=b.footerLogoUrl||b.logoUrl
 const products=navigation.filter(n=>n.area==='footer_products').sort((a,b)=>a.sort_order-b.sort_order),buy=navigation.filter(n=>n.area==='footer_buy').sort((a,b)=>a.sort_order-b.sort_order),company=navigation.filter(n=>n.area==='footer_company').sort((a,b)=>a.sort_order-b.sort_order)
 const render=(n:any)=>n.is_external?<a key={n.id} href={n.href} target="_blank" rel="noreferrer">{n.label}<ExternalLink size={12}/></a>:<Link key={n.id} href={n.href}>{n.label}</Link>
 return <footer className="nisFooter" id="contact"><div className="container">
  <div className="nisFooterCta"><div><span>{footer.cta_eyebrow}</span><h2>{footer.cta_title}</h2><p>{footer.cta_body}</p></div><Link className="nisPrimaryBtn" href={footer.cta_href||'/bulk-order'}>{footer.cta_label||'Request Project Pricing'} <ArrowRight size={18}/></Link></div>
  <div className="nisFooterGrid"><div className="nisFooterBrand"><Link href="/" className="nisFooterLogo"><img src={footerLogo} alt={b.logoAlt}/></Link><p>{footer.about}</p><div className="nisFooterTrust"><ShieldCheck size={18}/> {b.promise}</div></div>
   <div><h4>Products</h4>{products.map(render)}</div><div><h4>Build & Buy</h4>{buy.map(render)}<Link href="/downloads">Downloads</Link></div>
   <div><h4>Company</h4>{company.map(render)}{footerPages.map(p=><Link key={p.id} href={`/pages/${p.slug}`}>{p.title}</Link>)}{footer.city&&<span><MapPin size={15}/> {footer.city}</span>}{footer.email&&<a href={`mailto:${footer.email}`}><Mail size={15}/> {footer.email}</a>}{footer.phone&&<a href={`tel:${footer.phone}`}><Phone size={15}/> {footer.phone}</a>}{footer.website&&<span><Mail size={15}/> {footer.website}</span>}<p className="nisFooterSmall">{footer.small_note}</p></div>
  </div><div className="nisFooterBottom"><span>© {new Date().getFullYear()} {b.companyName}.</span><span>{b.tagline}</span></div>
 </div></footer>
}

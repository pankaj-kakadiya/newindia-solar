'use client'
import Link from 'next/link'
import {ArrowRight,ExternalLink,Globe2,MapPin,ShieldCheck} from 'lucide-react'
import {useStoreTheme} from './ThemeProvider'
import {useSiteContent} from './SiteContentProvider'
import {COMPANY} from '../lib/company'

export default function StoreFooter(){
 const {theme}=useStoreTheme(),{footer,navigation,footerPages}=useSiteContent();const b=theme.branding;const footerLogo=b.footerLogoUrl||b.logoUrl
 const products=navigation.filter(n=>n.area==='footer_products').sort((a,b)=>a.sort_order-b.sort_order),buy=navigation.filter(n=>n.area==='footer_buy').sort((a,b)=>a.sort_order-b.sort_order),company=navigation.filter(n=>n.area==='footer_company').sort((a,b)=>a.sort_order-b.sort_order)
 const render=(n:any)=>n.is_external?<a key={n.id} href={n.href} target="_blank" rel="noreferrer">{n.label}<ExternalLink size={12}/></a>:<Link key={n.id} href={n.href}>{n.label}</Link>
 return <footer className="nisFooter" id="contact"><div className="container">
  <div className="nisFooterCta"><div><span>{footer.cta_eyebrow}</span><h2>{footer.cta_title}</h2><p>{footer.cta_body}</p></div><Link className="nisPrimaryBtn" href={footer.cta_href||'/bulk-order'}>{footer.cta_label||'Request Project Pricing'} <ArrowRight size={18}/></Link></div>
  <div className="nisFooterGrid nisFooterGridV3"><div className="nisFooterBrand"><Link href="/" className="nisFooterLogo"><img src={footerLogo} alt={b.logoAlt}/></Link><p>{footer.about}</p><div className="nisFooterTrust"><ShieldCheck size={18}/> {b.promise}</div><div className="nisCompanyCard"><b>{COMPANY.legalName}</b><span>GSTIN: {COMPANY.gstin}</span><span><MapPin size={15}/>{COMPANY.addressLine1}, {COMPANY.addressLine2}, {COMPANY.city}, {COMPANY.state} {COMPANY.postalCode}, {COMPANY.country}</span><span><Globe2 size={15}/>{COMPANY.website}</span></div></div>
   <div><h4>Shop</h4><Link href="/categories">All categories</Link><Link href="/shop?q=ACDB">ACDB</Link><Link href="/shop?q=DCDB">DCDB</Link><Link href="/shop?q=SPD">Surge protection</Link><Link href="/shop?q=Solar%20Cable">Solar cable</Link>{products.map(render)}</div><div><h4>Build & Buy</h4><Link href="/combo">ACDB + DCDB combo</Link><Link href="/customize">Custom box builders</Link><Link href="/bulk-order">Project RFQ</Link><Link href="/account">Orders & account</Link><Link href="/downloads">Downloads</Link>{buy.map(render)}</div>
   <div><h4>Support & Policies</h4><Link href="/policies/shipping">Shipping & delivery</Link><Link href="/policies/returns">Returns & cancellation</Link><Link href="/policies/warranty">Warranty & support</Link><Link href="/policies/privacy">Privacy policy</Link><Link href="/policies/terms">Terms of use & sale</Link>{company.map(render)}{footerPages.map(p=><Link key={p.id} href={`/pages/${p.slug}`}>{p.title}</Link>)}<p className="nisFooterSmall">{footer.small_note}</p></div>
  </div><div className="nisFooterBottom"><span>© {new Date().getFullYear()} {COMPANY.legalName}.</span><span>{b.tagline}</span></div>
 </div></footer>
}

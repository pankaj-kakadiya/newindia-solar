'use client'
import Link from 'next/link'
import Image from 'next/image'
import {ArrowRight,ExternalLink,Globe2,MapPin,ShieldCheck} from 'lucide-react'
import {useStoreTheme} from './ThemeProvider'
import {useSiteContent} from './SiteContentProvider'
import {COMPANY} from '../lib/company'

export default function StoreFooter(){
 const {theme}=useStoreTheme(),{footer,navigation,footerPages}=useSiteContent();const b=theme.branding;const footerLogo=b.footerLogoUrl||b.logoUrl
 const normalizeHref=(href:string)=>href.replace(/\/$/,'').toLowerCase()
 const productHrefs=new Set(['/shop','/shop?q=acdb','/shop?q=dcdb','/shop?q=spd','/shop?q=solar%20cable','/categories/acdb','/categories/dcdb','/categories/spd','/categories/solar-cable'])
 const buyHrefs=new Set(['/combo','/customize','/bulk-order','/account','/login','/cart','/downloads'])
 const products=navigation.filter(n=>n.area==='footer_products'&&!productHrefs.has(normalizeHref(n.href))).sort((a,b)=>a.sort_order-b.sort_order),buy=navigation.filter(n=>n.area==='footer_buy'&&!buyHrefs.has(normalizeHref(n.href))).sort((a,b)=>a.sort_order-b.sort_order),company=navigation.filter(n=>n.area==='footer_company'&&!['why new india','contact','contact us'].includes(n.label.toLowerCase().trim())).sort((a,b)=>a.sort_order-b.sort_order)
 const render=(n:any)=>{const label=String(n.label||'').toLowerCase().trim(),href=label==='why new india'?'/why-new-india':label==='contact'||label==='contact us'?'/contact':n.href;return n.is_external?<a key={n.id} href={href} target="_blank" rel="noreferrer">{n.label}<ExternalLink size={12}/></a>:<Link prefetch={false} key={n.id} href={href}>{n.label}</Link>}
 return <footer className="nisFooter" id="contact"><div className="container">
  <div className="nisFooterCta"><div><span>{footer.cta_eyebrow}</span><h2>{footer.cta_title}</h2><p>{footer.cta_body}</p></div><Link prefetch={false} className="nisPrimaryBtn" href={footer.cta_href||'/bulk-order'}>{footer.cta_label||'Request Project Pricing'} <ArrowRight size={18}/></Link></div>
  <div className="nisFooterGrid nisFooterGridV3"><div className="nisFooterBrand"><Link prefetch={false} href="/" className="nisFooterLogo"><Image width={700} height={304} loading="lazy" decoding="async" src={footerLogo} sizes="(max-width: 760px) 160px, 300px" unoptimized={footerLogo.startsWith('https://')&&!footerLogo.startsWith('https://cdtbwuagqxkknkccpkcr.supabase.co/storage/v1/object/public/')} alt={b.logoAlt}/></Link><p>{footer.about}</p><div className="nisFooterTrust"><ShieldCheck size={18}/> {b.promise}</div><div className="nisCompanyCard"><b>{COMPANY.legalName}</b><span>GSTIN: {COMPANY.gstin}</span><span><MapPin size={15}/>{COMPANY.addressLine1}, {COMPANY.addressLine2}, {COMPANY.city}, {COMPANY.state} {COMPANY.postalCode}, {COMPANY.country}</span><span><Globe2 size={15}/>{COMPANY.website}</span></div></div>
   <div><h3 className="nisFooterHeading">Shop</h3><Link prefetch={false} href="/categories">All categories</Link><Link prefetch={false} href="/categories/acdb">ACDB</Link><Link prefetch={false} href="/categories/dcdb">DCDB</Link><Link prefetch={false} href="/categories/spd">Surge protection</Link><Link prefetch={false} href="/categories/solar-cable">Solar cable</Link>{products.map(render)}</div><div><h3 className="nisFooterHeading">Build & Buy</h3><Link prefetch={false} href="/combo">ACDB + DCDB combo</Link><Link prefetch={false} href="/customize">Custom box builders</Link><Link prefetch={false} href="/bulk-order">Project RFQ</Link><Link prefetch={false} href="/account">Orders & account</Link><Link prefetch={false} href="/downloads">Downloads</Link>{buy.map(render)}</div>
   <div><h3 className="nisFooterHeading">Company & Support</h3><Link prefetch={false} href="/account/support">Secure chat support</Link><Link prefetch={false} href="/why-new-india">Why New India</Link><Link prefetch={false} href="/contact">Contact us</Link><Link prefetch={false} href="/policies/shipping">Shipping & delivery</Link><Link prefetch={false} href="/policies/returns">Returns & cancellation</Link><Link prefetch={false} href="/policies/warranty">Warranty & support</Link><Link prefetch={false} href="/policies/privacy">Privacy policy</Link><Link prefetch={false} href="/policies/terms">Terms of use & sale</Link>{company.map(render)}{footerPages.map(p=><Link prefetch={false} key={p.id} href={`/pages/${p.slug}`}>{p.title}</Link>)}<p className="nisFooterSmall">{footer.small_note}</p></div>
  </div><div className="nisFooterBottom"><span>© {new Date().getFullYear()} {COMPANY.legalName}.</span><span>{b.tagline}</span></div>
 </div></footer>
}

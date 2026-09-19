'use client'

import Link from 'next/link'
import {
  ArrowRight, BadgeCheck, Boxes, Cable, CheckCircle2, CircleGauge, Download,
  FileText, Headphones, Layers3, PackageCheck, PlugZap, SearchCheck,
  Settings2, ShieldCheck, ShoppingCart, Sparkles, Truck, Wrench, Zap,
  Factory, MapPinned, UsersRound, SunMedium, Gauge, Leaf, CircuitBoard,
} from 'lucide-react'
import StoreHeader from './StoreHeader'
import StoreFooter from './StoreFooter'
import {useSiteContent} from './SiteContentProvider'
import {HomeFeaturedProducts, HomeResources, HomeProductImage} from './HomeHighlights'
import {normalizeHomeSections, publicAssetUrl, type HomeProduct, type HomeDownload} from '../lib/homepage-sections'

const iconMap:any={zap:Zap,shield:ShieldCheck,gauge:CircleGauge,plug:PlugZap,cable:Cable,layers:Layers3,settings:Settings2,boxes:Boxes,wrench:Wrench,package:PackageCheck,sparkles:Sparkles,file:FileText,truck:Truck}

const fallbackCollections=[
 {name:'ACDB',desc:'Single & three-phase AC protection',href:'/categories/acdb',icon:'zap',image:'/acdb-demo.svg',tag:'AC PROTECTION'},
 {name:'DCDB',desc:'PV string protection & combining',href:'/categories/dcdb',icon:'shield',image:'/dcdb-demo.svg',tag:'DC PROTECTION'},
 {name:'MCB / MCCB',desc:'AC & DC circuit protection',href:'/categories/mcb-mccb',icon:'gauge',image:'/mcb-demo.svg',tag:'SWITCHGEAR'},
 {name:'SPD',desc:'Surge protection devices',href:'/categories/spd',icon:'plug',image:'/spd-demo.svg',tag:'SURGE PROTECTION'},
 {name:'Solar Cable',desc:'DC cable & internal wiring',href:'/categories/solar-cable',icon:'cable',image:'/cable-demo.svg',tag:'CABLE & WIRE'},
 {name:'Earthing Kit',desc:'Rods, lugs, clamps & accessories',href:'/categories/earthing-kits',icon:'layers',image:'/earthing-demo.svg',tag:'EARTHING'},
 {name:'MC4',desc:'PV connectors & accessories',href:'/categories/mc4-connectors',icon:'settings',image:'/mc4-demo.svg',tag:'CONNECTORS'},
 {name:'DC Fuse',desc:'Fuse links & fuse holders',href:'/categories/dc-fuses',icon:'gauge',image:'/fuse-demo.svg',tag:'FUSE SYSTEMS'},
 {name:'Enclosures',desc:'IP-rated industrial enclosures',href:'/categories/enclosures',icon:'boxes',tag:'ENCLOSURES'},
 {name:'Terminal Blocks',desc:'Internal connection systems',href:'/categories/terminal-blocks',icon:'wrench',tag:'INTERNAL PARTS'},
 {name:'Cable Glands',desc:'Sealed cable-entry systems',href:'/categories/cable-glands',icon:'package',image:'/gland-demo.svg',tag:'ACCESSORIES'},
 {name:'BOS Accessories',desc:'Project-ready BOS range',href:'/categories/bos-accessories',icon:'sparkles',tag:'COMPLETE BOS'},
]

const imageByName:Record<string,string>={acdb:'/acdb-demo.svg',dcdb:'/dcdb-demo.svg',mcb:'/mcb-demo.svg',mccb:'/mcb-demo.svg',spd:'/spd-demo.svg',cable:'/cable-demo.svg',earthing:'/earthing-demo.svg',mc4:'/mc4-demo.svg',fuse:'/fuse-demo.svg'}
const getCollectionImage=(item:any)=>publicAssetUrl(item.image)||(/gland/i.test(item.name||'')?'/gland-demo.svg':undefined)||Object.entries(imageByName).find(([key])=>String(item.name||'').toLowerCase().includes(key))?.[1]

function HeroTitle({title,highlight}:{title:string;highlight:string}){
 if(!highlight||!title.includes(highlight))return <>{title}</>
 const index=title.indexOf(highlight)
 return <>{title.slice(0,index)}<em>{highlight}</em>{title.slice(index+highlight.length)}</>
}

export default function HomePageContent({products=[],downloads=[],productsUnavailable=false}:{products?:HomeProduct[];downloads?:HomeDownload[];productsUnavailable?:boolean}){
 const {home}=useSiteContent()
 const hero=home?.hero||{}
 const collections=(home?.featured_collections?.length?home.featured_collections:fallbackCollections)
 const visibility=home?.visibility||{}
 const order=normalizeHomeSections(home?.section_order)
 const title=String(hero.title||"India's solar infrastructure, built component by component.")
 const highlight=String(hero.highlight||'built component by component.')

 const sections:any={
  trust:<section className="ns4Trust" aria-label="New India Solar strengths"><div className="container ns4TrustGrid">
    <div><ShieldCheck/><span><b>Protection focused</b><small>AC & DC solar components</small></span></div>
    <div><Factory/><span><b>Assembly ready</b><small>Built around real project BOMs</small></span></div>
    <div><Truck/><span><b>Pan-India supply</b><small>Direct & project procurement</small></span></div>
    <div><Headphones/><span><b>Technical support</b><small>Structured buying assistance</small></span></div>
  </div></section>,

  collections:<section className="ns4Section ns4Categories" aria-labelledby="ns4-categories"><div className="container">
    <div className="ns4SectionHead"><div><span>COMPLETE SOLAR BOS RANGE</span><h2 id="ns4-categories">{home.collections_heading||'Everything around solar protection & BOS.'}</h2><p>{home.collections_body||'Browse the core component families used across residential, commercial and industrial solar installations.'}</p></div><Link href="/shop">Explore full catalogue <ArrowRight size={17}/></Link></div>
    <div className="ns4CategoryGrid">{collections.map((c:any,i:number)=>{const Icon=iconMap[c.icon]||Sparkles;return <Link key={`${c.name}-${i}`} href={c.href||'/shop'} className="ns4CategoryCard"><div className="ns4CategoryMedia"><HomeProductImage src={getCollectionImage(c)} alt={`${c.name} category`}/><span>{c.tag||'SOLAR BOS'}</span></div><div className="ns4CategoryBody"><i><Icon/></i><div><h3>{c.name}</h3><p>{c.desc}</p></div><ArrowRight/></div></Link>})}</div>
  </div></section>,

  builder:<section className="ns4Section ns4Builder" aria-labelledby="ns4-builder"><div className="container">
    <div className="ns4SectionHead inverse"><div><span>CONFIGURE • REVIEW • ORDER</span><h2 id="ns4-builder">{home.builder_heading||'Build the ACDB or DCDB your project actually needs.'}</h2><p>{home.builder_body||'Choose protection devices, ratings, enclosure and accessories instead of being limited to a fixed box.'}</p></div><Link href="/customize">Open builders <ArrowRight size={17}/></Link></div>
    <div className="ns4BuilderGrid">
      <article className="ns4BuilderCard ac"><div className="ns4BuilderCopy"><div className="ns4BuilderLabel"><span>AC DISTRIBUTION BOX</span><b>AC</b></div><h3>Build Your ACDB</h3><p>Configure system size, phase, MCB/MCCB, SPD, indicators, busbar, terminals, wire and glands.</p><div className="ns4Pills"><span>1P / 3P</span><span>MCB / MCCB</span><span>SPD</span><span>IP enclosure</span></div><Link href="/customize/acdb">Start ACDB Builder <ArrowRight size={16}/></Link></div><div className="ns4BuilderImage"><HomeProductImage src="/acdb-demo.svg" alt="ACDB box"/></div></article>
      <article className="ns4BuilderCard dc"><div className="ns4BuilderCopy"><div className="ns4BuilderLabel"><span>DC COMBINER BOX</span><b>DC</b></div><h3>Build Your DCDB</h3><p>Configure string count, voltage, DC MCB, SPD, fuse system, terminals, cable, glands and enclosure.</p><div className="ns4Pills"><span>String count</span><span>600V / 1000V</span><span>Fuse / MCB</span><span>SPD</span></div><Link href="/customize/dcdb">Start DCDB Builder <ArrowRight size={16}/></Link></div><div className="ns4BuilderImage"><HomeProductImage src="/dcdb-demo.svg" alt="DCDB box"/></div></article>
    </div>
    <div className="ns4BuilderSteps"><div><b>01</b><span>Choose system</span></div><ArrowRight/><div><b>02</b><span>Configure components</span></div><ArrowRight/><div><b>03</b><span>Review BOM</span></div><ArrowRight/><div><b>04</b><span>Order / RFQ</span></div></div>
  </div></section>,

  buyways:<section className="ns4Section ns4Journeys" aria-labelledby="ns4-journeys"><div className="container">
    <div className="ns4SectionHead"><div><span>CHOOSE YOUR BUYING FLOW</span><h2 id="ns4-journeys">{home.buyways_heading||'From one component to a complete project requirement.'}</h2><p>{home.buyways_body||'Use the route that matches the way your team actually buys.'}</p></div></div>
    <div className="ns4JourneyGrid">
      <Link href="/shop"><ShoppingCart/><small>READY CATALOGUE</small><h3>Buy Components</h3><p>Browse specifications, stock and GST-ready pricing.</p><strong>Shop now <ArrowRight/></strong></Link>
      <Link href="/combo" className="featured"><Layers3/><small>AC + DC</small><h3>Create ACDB + DCDB Combo</h3><p>Select published boxes and add both to cart together.</p><strong>Create combo <ArrowRight/></strong></Link>
      <Link href="/bulk-order"><FileText/><small>PROJECT PROCUREMENT</small><h3>Send a Bulk RFQ</h3><p>Share ratings, quantity, project city and purchase timeline.</p><strong>Request pricing <ArrowRight/></strong></Link>
    </div>
  </div></section>,

  why:<section className="ns4Section ns4Why" id="why-us" aria-labelledby="ns4-why"><div className="container ns4WhyGrid">
    <div className="ns4WhyVisual"><div className="ns4Sun"><SunMedium/></div><div className="ns4WhyTag">POWERING INDIA'S SOLAR INSTALLATIONS.</div></div>
    <div className="ns4WhyCopy"><span>WHY NEW INDIA SOLAR</span><h2 id="ns4-why">{home.why_heading||"Built around the installer's actual workflow."}</h2><p>{home.why_body||'Products, custom configurations, bulk RFQs and order records work together from selection to production.'}</p><div className="ns4WhyCards">
      <article><SearchCheck/><div><b>Clear specifications</b><small>Structured ratings and attributes</small></div></article>
      <article><CircuitBoard/><div><b>Dynamic configuration</b><small>ACDB & DCDB requirements</small></div></article>
      <article><BadgeCheck/><div><b>Quality focused</b><small>Tested. Packed. Guaranteed.</small></div></article>
      <article><MapPinned/><div><b>Project support</b><small>For EPCs, dealers & installers</small></div></article>
    </div><div className="ns4WhyActions"><Link href="/why-new-india">Why New India <ArrowRight size={16}/></Link><Link href="/downloads"><Download size={16}/> Downloads</Link></div></div>
  </div></section>,

  project:<section className="ns4Section ns4Project" aria-labelledby="ns4-project"><div className="container ns4ProjectGrid"><div><span>PROJECT & BULK SUPPLY</span><h2 id="ns4-project">Need a custom BOM or volume quote?</h2><p>Share quantities, ratings and dispatch location. Your requirement goes directly into our project RFQ flow.</p><Link href="/bulk-order">Request Project Pricing <ArrowRight size={17}/></Link></div><div className="ns4ProjectFeatures"><span><CheckCircle2/> Bulk pricing</span><span><CheckCircle2/> BOM review</span><span><CheckCircle2/> Technical support</span><span><CheckCircle2/> Dispatch coordination</span></div></div></section>,

  final:<section className="ns4Final"><div className="container"><div className="ns4FinalInner"><div><span>{home.final_eyebrow||'READY FOR YOUR NEXT INSTALLATION?'}</span><h2>{home.final_heading||'Start with a component, a custom box, or a complete project requirement.'}</h2></div><div><Link href="/shop">Shop Components</Link><Link className="primary" href="/bulk-order">Get Project Pricing <ArrowRight size={16}/></Link></div></div></div></section>,

  products:<HomeFeaturedProducts products={products} unavailable={productsUnavailable}/>,
  downloads:<HomeResources downloads={downloads}/>,
 }

 return <><StoreHeader/><main id="main-content" className="homeV4">
  <section className="ns4Hero" aria-labelledby="ns4-hero-title"><div className="container ns4HeroGrid">
    <div className="ns4HeroCopy"><span className="ns4Eyebrow"><i/> {hero.eyebrow||'Solar BOS infrastructure for EPCs & installers'}</span><h1 id="ns4-hero-title"><HeroTitle title={title} highlight={highlight}/></h1><p>{hero.body||'Source ACDB, DCDB and BOS components, configure project-specific boxes, or send a bulk requirement from one procurement-ready platform.'}</p>
      <div className="ns4HeroActions"><Link className="primary" href={hero.primary_href||'/shop'}>{hero.primary_label||'Explore Products'} <ArrowRight size={18}/></Link><Link href={hero.secondary_href||'/customize'}>{hero.secondary_label||'Build ACDB / DCDB'}</Link><Link className="ghost" href={hero.tertiary_href||'/bulk-order'}>{hero.tertiary_label||'Project RFQ'}</Link></div>
      <div className="ns4HeroProof"><span><ShieldCheck/>Protection focused</span><span><Truck/>Pan-India supply</span><span><PackageCheck/>Project-ready procurement</span></div>
    </div>
    <div className="ns4HeroVisual" aria-label="New India Solar product preview">{publicAssetUrl(hero.banner_image_url)?<div className="ns4HeroBanner"><HomeProductImage src={hero.banner_image_url} alt="New India Solar" priority/></div>:<div className="ns4HeroStage"><div className="ns4HeroStageTop"><span>COMPLETE AC / DC PROTECTION</span><b>Built for installers & EPCs</b></div><div className="ns4HeroStageProducts"><Link href="/categories/dcdb"><HomeProductImage src="/dcdb-demo.svg" alt="DCDB box" priority/><span>DCDB</span></Link><Link href="/categories/acdb"><HomeProductImage src="/acdb-demo.svg" alt="ACDB box" priority/><span>ACDB</span></Link></div><div className="ns4HeroStageRail"><span><Cable/> Cable</span><span><PlugZap/> SPD</span><span><Settings2/> MC4</span><span><Layers3/> Earthing</span></div></div>}</div>
  </div></section>

  <section className="ns4Metrics"><div className="container ns4MetricGrid"><div><Boxes/><span><b>Complete range</b><small>ACDB, DCDB & BOS</small></span></div><div><UsersRound/><span><b>Built for B2B</b><small>EPCs, dealers & installers</small></span></div><div><Gauge/><span><b>Custom build</b><small>Project-specific configurations</small></span></div><div><Leaf/><span><b>Solar focused</b><small>One specialist platform</small></span></div></div></section>

  <section className="ns4Bos"><div className="container"><div className="ns4BosHead"><span>FROM GENERATION TO GRID</span><h2>Complete Solar BOS Ecosystem</h2><p>Everything around a safe, reliable and installation-ready solar system.</p></div><div className="ns4BosFlow">
    <div><SunMedium/><b>Solar Panel</b><small>Generation</small></div><ArrowRight/>
    <div><Cable/><b>DC Cable</b><small>Transmission</small></div><ArrowRight/>
    <div><ShieldCheck/><b>DCDB</b><small>DC Protection</small></div><ArrowRight/>
    <div><Zap/><b>Inverter</b><small>Conversion</small></div><ArrowRight/>
    <div><PackageCheck/><b>ACDB</b><small>AC Protection</small></div><ArrowRight/>
    <div><CircleGauge/><b>Meter / Grid</b><small>Connection</small></div><ArrowRight/>
    <div><Layers3/><b>Earthing</b><small>Safety</small></div>
  </div></div></section>

  {order.map((key:string)=>visibility[key]===false?null:<div key={key}>{sections[key]}</div>)}
 </main><StoreFooter/></>
}

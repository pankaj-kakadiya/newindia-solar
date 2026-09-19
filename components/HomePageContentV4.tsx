'use client'

import Link from 'next/link'
import {
  ArrowRight, BadgeCheck, Boxes, Cable, Check, CheckCircle2, CircleGauge,
  Factory, FileText, Gauge, Headphones, Layers3, Leaf,
  PackageCheck, PlugZap, SearchCheck, Settings2, ShieldCheck, ShoppingCart,
  Sparkles, Truck, Users, Wrench, Zap
} from 'lucide-react'
import StoreHeader from './StoreHeader'
import StoreFooter from './StoreFooter'
import {useSiteContent} from './SiteContentProvider'
import {HomeFeaturedProducts, HomeResources, HomeProductImage} from './HomeHighlights'
import {type HomeProduct, type HomeDownload} from '../lib/homepage-sections'

const categories=[
  {name:'ACDB',desc:'AC protection & distribution',href:'/categories/acdb',image:'/acdb-demo.svg',icon:Zap},
  {name:'DCDB',desc:'DC string protection & combining',href:'/categories/dcdb',image:'/dcdb-demo.svg',icon:ShieldCheck},
  {name:'MCB / MCCB',desc:'Circuit protection devices',href:'/categories/mcb-mccb',image:'/mcb-demo.svg',icon:CircleGauge},
  {name:'SPD',desc:'AC & DC surge protection',href:'/categories/spd',image:'/spd-demo.svg',icon:PlugZap},
  {name:'Solar Cable',desc:'PV cable & internal wiring',href:'/categories/solar-cable',image:'/cable-demo.svg',icon:Cable},
  {name:'Earthing',desc:'Earthing kits & accessories',href:'/categories/earthing-kits',image:'/earthing-demo.svg',icon:Layers3},
  {name:'MC4',desc:'PV connectors & tools',href:'/categories/mc4-connectors',image:'/mc4-demo.svg',icon:Settings2},
  {name:'Fuse System',desc:'DC fuse links & holders',href:'/categories/dc-fuses',image:'/fuse-demo.svg',icon:Gauge},
  {name:'Enclosures',desc:'IP-rated industrial boxes',href:'/categories/enclosures',icon:Boxes},
  {name:'Terminal Blocks',desc:'Internal connection systems',href:'/categories/terminal-blocks',icon:Wrench},
  {name:'Cable Glands',desc:'Sealed cable entry systems',href:'/categories/cable-glands',image:'/gland-demo.svg',icon:PackageCheck},
  {name:'BOS Accessories',desc:'Project-ready solar accessories',href:'/categories/bos-accessories',icon:Sparkles},
]

const bosFlow=[
  {label:'Solar Panel',sub:'Generation',icon:'☀'},
  {label:'DC Cable',sub:'Power transfer',icon:'↯'},
  {label:'DCDB',sub:'DC protection',image:'/dcdb-demo.svg'},
  {label:'Inverter',sub:'DC to AC',icon:'↔'},
  {label:'ACDB',sub:'AC protection',image:'/acdb-demo.svg'},
  {label:'Meter / Grid',sub:'Distribution',icon:'▦'},
  {label:'Earthing',sub:'Safety',image:'/earthing-demo.svg'},
]

const process=[
  ['01','Material selection','Approved components for the required configuration.'],
  ['02','Assembly','Structured wiring, mounting and component placement.'],
  ['03','Testing','Electrical and visual checks before packing.'],
  ['04','QC approval','Configuration and workmanship review.'],
  ['05','Packaging','Protected packing with product identification.'],
  ['06','Dispatch','Order hand-off for project delivery.'],
]

function HeroTitle({title,highlight}:{title:string;highlight:string}){
  if(!highlight||!title.includes(highlight)) return <>{title}</>
  const at=title.indexOf(highlight)
  return <>{title.slice(0,at)}<em>{highlight}</em>{title.slice(at+highlight.length)}</>
}

export default function HomePageContentV4({products=[],downloads=[],productsUnavailable=false}:{products?:HomeProduct[];downloads?:HomeDownload[];productsUnavailable?:boolean}){
  const {home}=useSiteContent()
  const hero=home?.hero||{}
  const title=String(hero.title||"Powering India's solar infrastructure with reliable components.")
  const highlight=String(hero.highlight||'reliable components')

  return <>
    <StoreHeader/>
    <main id="main-content" className="homeV4">
      <section className="v4Hero">
        <div className="v4HeroBackdrop" aria-hidden="true"/>
        <div className="container v4HeroGrid">
          <div className="v4HeroCopy">
            <span className="v4Kicker"><i/> SOLAR BOS • ACDB • DCDB • PROJECT SUPPLY</span>
            <h1><HeroTitle title={title} highlight={highlight}/></h1>
            <p>{hero.body||'Source solar protection components, build project-specific ACDB and DCDB boxes, or submit a complete BOM requirement from one procurement-ready platform.'}</p>
            <div className="v4HeroActions">
              <Link className="v4Btn v4BtnGreen" href={hero.primary_href||'/shop'}>{hero.primary_label||'Explore Products'} <ArrowRight size={17}/></Link>
              <Link className="v4Btn v4BtnWhite" href="/customize"><Settings2 size={17}/> Build ACDB / DCDB</Link>
              <Link className="v4Btn v4BtnGhost" href="/bulk-order"><FileText size={17}/> Project RFQ</Link>
            </div>
            <div className="v4HeroProof">
              <span><ShieldCheck/> Protection focused</span>
              <span><PackageCheck/> Custom assembly</span>
              <span><Truck/> Project supply</span>
            </div>
          </div>

          <div className="v4HeroVisual" aria-label="New India Solar product range">
            <div className="v4SolarGrid" aria-hidden="true"/>
            <div className="v4HeroBadge"><Leaf/><span><b>Built for solar projects</b><small>Residential • Commercial • Industrial</small></span></div>
            <Link className="v4HeroProduct v4Dcdb" href="/categories/dcdb">
              <HomeProductImage src="/dcdb-demo.svg" alt="DCDB category"/>
              <span><small>DC PROTECTION</small><b>DCDB</b></span>
            </Link>
            <Link className="v4HeroProduct v4Acdb" href="/categories/acdb">
              <HomeProductImage src="/acdb-demo.svg" alt="ACDB category"/>
              <span><small>AC PROTECTION</small><b>ACDB</b></span>
            </Link>
            <div className="v4HeroParts">
              <HomeProductImage src="/cable-demo.svg" alt="Solar cable"/>
              <HomeProductImage src="/mc4-demo.svg" alt="MC4 connectors"/>
              <HomeProductImage src="/spd-demo.svg" alt="Surge protection"/>
            </div>
            <div className="v4HeroMini"><BadgeCheck/><span><b>Tested. Packed. Guaranteed.</b><small>New India Solar brand promise</small></span></div>
          </div>
        </div>
      </section>

      <section className="v4SignalStrip" aria-label="Buying advantages">
        <div className="container v4SignalGrid">
          <div><ShieldCheck/><span><b>Protection focused</b><small>AC/DC solar component range</small></span></div>
          <div><Settings2/><span><b>Custom box workflow</b><small>Configure ACDB & DCDB</small></span></div>
          <div><FileText/><span><b>Project RFQ</b><small>Bulk BOM & requirement flow</small></span></div>
          <div><Truck/><span><b>Pan-India project supply</b><small>Structured procurement support</small></span></div>
        </div>
      </section>

      <section className="v4Section v4Bos">
        <div className="container">
          <div className="v4SectionHead">
            <div><span>COMPLETE SOLAR BOS ECOSYSTEM</span><h2>From generation to protection, one connected system.</h2><p>Explore the component path used across a complete solar installation.</p></div>
            <Link href="/shop">Explore full catalogue <ArrowRight size={16}/></Link>
          </div>
          <div className="v4BosFlow">
            {bosFlow.map((item,index)=><div className="v4BosStep" key={item.label}>
              <div className="v4BosIcon">{item.image?<HomeProductImage src={item.image} alt={item.label}/>:<b>{item.icon}</b>}</div>
              <span><b>{item.label}</b><small>{item.sub}</small></span>
              {index<bosFlow.length-1&&<ArrowRight className="v4BosArrow" aria-hidden="true"/>}
            </div>)}
          </div>
        </div>
      </section>

      <section className="v4Section v4Categories">
        <div className="container">
          <div className="v4SectionHead">
            <div><span>PRODUCT RANGE</span><h2>Everything around solar AC/DC protection & BOS.</h2><p>Technical categories for residential, commercial and project-scale installations.</p></div>
            <Link href="/categories">View all categories <ArrowRight size={16}/></Link>
          </div>
          <div className="v4CategoryGrid">
            {categories.map(({name,desc,href,image,icon:Icon},index)=><Link href={href} className="v4Category" key={name}>
              <span className="v4CatIndex">{String(index+1).padStart(2,'0')}</span>
              <div className="v4CatMedia">{image?<HomeProductImage src={image} alt={name}/>:<Icon/>}</div>
              <div className="v4CatCopy"><div><h3>{name}</h3><p>{desc}</p></div><ArrowRight/></div>
            </Link>)}
          </div>
        </div>
      </section>

      <section className="v4Build">
        <div className="container">
          <div className="v4BuildIntro">
            <span>CUSTOM CONFIGURATION</span>
            <h2>Build the protection box your site actually needs.</h2>
            <p>Choose the system details, protection devices, enclosure and accessories. Move from requirement to structured quotation without starting from scratch.</p>
            <div className="v4BuildProof"><span><Check/> Guided configuration</span><span><Check/> Component-level selection</span><span><Check/> Project RFQ hand-off</span></div>
          </div>
          <div className="v4BuildCards">
            <article className="v4BuildCard v4BuildAc">
              <div className="v4BuildCopy"><span>AC PROTECTION</span><h3>Build Your ACDB</h3><p>Phase, capacity, MCB/MCCB, SPD, indicators, terminals, internal wiring and enclosure.</p><div className="v4Pills"><i>1Φ / 3Φ</i><i>MCB / MCCB</i><i>SPD</i></div><Link href="/customize/acdb">Start ACDB Builder <ArrowRight/></Link></div>
              <div className="v4BuildImage"><HomeProductImage src="/acdb-demo.svg" alt="ACDB builder"/></div>
            </article>
            <article className="v4BuildCard v4BuildDc">
              <div className="v4BuildCopy"><span>DC PROTECTION</span><h3>Build Your DCDB</h3><p>String count, voltage, DC MCB, SPD, fuse system, terminals, cable, glands and enclosure.</p><div className="v4Pills"><i>String count</i><i>1000V DC</i><i>Fuse / SPD</i></div><Link href="/customize/dcdb">Start DCDB Builder <ArrowRight/></Link></div>
              <div className="v4BuildImage"><HomeProductImage src="/dcdb-demo.svg" alt="DCDB builder"/></div>
            </article>
          </div>
        </div>
      </section>

      <section className="v4Section v4Journey">
        <div className="container">
          <div className="v4SectionHead compact"><div><span>HOW IT WORKS</span><h2>From requirement to order in four clear steps.</h2></div></div>
          <div className="v4JourneyGrid">
            <div><b>01</b><ShoppingCart/><span><strong>Choose</strong><small>Start with a product, custom box or project requirement.</small></span></div>
            <div><b>02</b><Settings2/><span><strong>Configure</strong><small>Select ratings, variants, enclosure and accessories.</small></span></div>
            <div><b>03</b><SearchCheck/><span><strong>Review</strong><small>Review specifications, availability, price or quotation.</small></span></div>
            <div><b>04</b><Truck/><span><strong>Order / RFQ</strong><small>Place a direct order or submit your project requirement.</small></span></div>
          </div>
        </div>
      </section>

      <HomeFeaturedProducts products={products} unavailable={productsUnavailable}/>

      <section className="v4Section v4Why" id="why-us">
        <div className="container v4WhyGrid">
          <div className="v4WhyVisual">
            <div className="v4WhySun"/>
            <div className="v4WhyPanel">
              <span>NEW INDIA SOLAR</span>
              <h2>Built around the installer's real workflow.</h2>
              <p>Products, custom assemblies, project RFQs and technical resources work together instead of living in disconnected buying flows.</p>
              <Link className="v4Btn v4BtnGreen" href="/why-new-india">Why New India <ArrowRight size={17}/></Link>
            </div>
          </div>
          <div className="v4WhyList">
            <article><ShieldCheck/><div><h3>Reliable protection range</h3><p>ACDB, DCDB, switchgear and BOS categories organized for technical selection.</p></div></article>
            <article><Settings2/><div><h3>Custom configuration</h3><p>Capture project-specific ratings, components and enclosure requirements.</p></div></article>
            <article><FileText/><div><h3>Structured BOM & RFQ flow</h3><p>Move project requirements into a clearer quotation process.</p></div></article>
            <article><Headphones/><div><h3>Technical buying support</h3><p>Give buyers a direct path to product and project assistance.</p></div></article>
          </div>
        </div>
      </section>

      <section className="v4Quality">
        <div className="container">
          <div className="v4QualityHead"><div><span>ASSEMBLY & QUALITY WORKFLOW</span><h2>From components to dispatch.</h2><p>A clear production journey for configured protection boxes.</p></div><Factory/></div>
          <div className="v4Process">{process.map(([number,title,body],index)=><div key={number} className="v4ProcessStep"><span>{number}</span><div><b>{title}</b><small>{body}</small></div>{index<process.length-1&&<ArrowRight/>}</div>)}</div>
        </div>
      </section>

      <section className="v4Section v4Partners">
        <div className="container v4PartnerGrid">
          <article className="v4PartnerCard dealer">
            <span>DEALER NETWORK</span><h2>Grow with New India Solar.</h2><p>Build a repeatable supply relationship for solar protection and BOS products.</p>
            <ul><li><CheckCircle2/> Product range access</li><li><CheckCircle2/> Project requirement support</li><li><CheckCircle2/> Technical catalogue access</li></ul>
            <Link href="/bulk-order">Start a dealer enquiry <ArrowRight/></Link>
          </article>
          <article className="v4PartnerCard epc">
            <span>EPC & PROJECT SUPPLY</span><h2>One buying path for larger solar projects.</h2><p>Share your BOM, quantities, ratings, preferred brands and delivery location.</p>
            <ul><li><CheckCircle2/> Bulk project RFQ</li><li><CheckCircle2/> Custom ACDB / DCDB requirements</li><li><CheckCircle2/> Technical documentation flow</li></ul>
            <Link href="/bulk-order">Submit project requirement <ArrowRight/></Link>
          </article>
        </div>
      </section>

      <section className="v4IndiaVision">
        <div className="container v4VisionGrid">
          <div className="v4VisionCopy"><span>INDIA'S CLEAN ENERGY JOURNEY</span><h2>Components that support a larger renewable-energy transition.</h2><p>India has set a national goal of reaching 500 GW of renewable-energy capacity by 2030. New India Solar's role is commercial: supplying and configuring solar BOS and protection components for installers, EPCs and project buyers.</p><a href="https://www.pmindia.gov.in/en/news_updates/pms-remarks-at-india-energy-week-2025/" target="_blank" rel="noreferrer">Read the official 2030 energy-goal statement <ArrowRight size={16}/></a></div>
          <div className="v4VisionArt" aria-hidden="true"><div className="v4FlagLine"/><div className="v4VisionSun"/><div className="v4VisionPanels"><i/><i/><i/><i/><i/><i/></div><Leaf/></div>
        </div>
      </section>

      <HomeResources downloads={downloads}/>

      <section className="v4Final">
        <div className="container">
          <div className="v4FinalCard">
            <div><span>PROJECT & BULK SUPPLY</span><h2>Need a custom BOM or volume quote?</h2><p>Share quantities, ratings, preferred brands and dispatch location. Your requirement goes directly into the project RFQ flow.</p></div>
            <div><Link className="v4Btn v4BtnGreen" href="/bulk-order">Request Project Pricing <ArrowRight size={17}/></Link><Link className="v4Btn v4BtnGhost" href="/shop">Browse Products</Link></div>
          </div>
        </div>
      </section>
    </main>
    <StoreFooter/>
  </>
}

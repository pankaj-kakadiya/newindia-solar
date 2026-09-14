import type {Metadata} from 'next'
import Link from 'next/link'
import {ArrowRight, Boxes, Cable, CheckCircle2, CircleGauge, FileText, Gauge, Layers3, PackageCheck, PlugZap, SearchCheck, Settings2, ShieldCheck, ShoppingCart, Sparkles, Truck, Wrench, Zap} from 'lucide-react'
import StoreHeader from '../components/StoreHeader'
import StoreFooter from '../components/StoreFooter'

export const metadata:Metadata={
  title:'New India Solar | ACDB, DCDB & Solar BOS Components',
  description:'Buy ACDB, DCDB and solar BOS components, configure custom distribution boxes, and submit project RFQs for EPC and installer requirements across India.',
  alternates:{canonical:'/'},
  openGraph:{title:'New India Solar Components Pvt Ltd',description:'Solar components built for reliable installations.',type:'website'}
}

const categories=[
  {name:'ACDB',desc:'AC protection & distribution',q:'ACDB',Icon:Zap},
  {name:'DCDB',desc:'DC combiner & protection',q:'DCDB',Icon:ShieldCheck},
  {name:'MCB / MCCB',desc:'AC & DC circuit protection',q:'MCB',Icon:CircleGauge},
  {name:'SPD',desc:'Surge protection devices',q:'SPD',Icon:PlugZap},
  {name:'Solar Cable',desc:'DC cable & internal wiring',q:'Solar Cable',Icon:Cable},
  {name:'Earthing Kit',desc:'Solar earthing solutions',q:'Earthing',Icon:Layers3},
  {name:'MC4',desc:'PV connectors & accessories',q:'MC4',Icon:Settings2},
  {name:'DC Fuse',desc:'Fuse links & fuse holders',q:'Fuse',Icon:Gauge},
  {name:'Enclosures',desc:'IP-rated industrial boxes',q:'Enclosure',Icon:Boxes},
  {name:'Terminal Blocks',desc:'Internal connection systems',q:'Terminal',Icon:Wrench},
  {name:'Cable Glands',desc:'Sealed cable entry systems',q:'Cable Gland',Icon:PackageCheck},
  {name:'BOS Accessories',desc:'Project-ready solar BOS',q:'BOS',Icon:Sparkles}
]

export default function Home(){
  return <>
    <StoreHeader/>
    <main id="main-content" className="homeV2">
      <section className="hvHero" aria-labelledby="home-hero-title">
        <div className="container hvHeroGrid">
          <div className="hvHeroCopy">
            <span className="hvEyebrow"><i/> Solar BOS infrastructure for EPCs & installers</span>
            <h1 id="home-hero-title">Solar components built to <em>move projects faster.</em></h1>
            <p>Source ACDB, DCDB and BOS components, configure project-specific boxes, or send a bulk requirement from one procurement-ready platform.</p>
            <div className="hvActions">
              <Link className="hvBtn hvBtnPrimary" href="/shop">Shop Components <ArrowRight size={18}/></Link>
              <Link className="hvBtn hvBtnLight" href="/customize/dcdb">Build ACDB / DCDB</Link>
              <Link className="hvBtn hvBtnGhost" href="/bulk-order">Project RFQ</Link>
            </div>
            <div className="hvProof" aria-label="Ordering benefits">
              <span><CheckCircle2/> GST-ready ordering</span>
              <span><CheckCircle2/> Configurable ACDB / DCDB</span>
              <span><CheckCircle2/> Direct + bulk buying</span>
            </div>
          </div>

          <div className="hvHeroVisual" aria-label="New India Solar procurement workflow preview">
            <div className="hvVisualHead"><div><small>NEW INDIA SOLAR</small><b>Project Procurement</b></div><span>LIVE</span></div>
            <div className="hvVisualMetric"><div><small>Choose your flow</small><strong>Product → Configure → Order</strong></div><CircleGauge/></div>
            <div className="hvVisualCards">
              <Link href="/shop?q=ACDB" prefetch={false}><span><Zap/></span><div><b>ACDB</b><small>Ready products</small></div><ArrowRight/></Link>
              <Link href="/customize/dcdb" prefetch={false}><span><Settings2/></span><div><b>Custom DCDB</b><small>Build your BOM</small></div><ArrowRight/></Link>
              <Link href="/bulk-order" prefetch={false}><span><FileText/></span><div><b>Bulk RFQ</b><small>Project pricing</small></div><ArrowRight/></Link>
            </div>
            <div className="hvVisualBottom"><span><ShieldCheck/> Tested. Packed. Guaranteed.</span><span>newindiasolar.com</span></div>
          </div>
        </div>
      </section>

      <section className="hvTrust" aria-label="Business capabilities"><div className="container hvTrustGrid">
        <div><ShieldCheck/><span><b>Protection Focused</b><small>AC & DC solar components</small></span></div>
        <div><Settings2/><span><b>Custom Configuration</b><small>Component-based box builder</small></span></div>
        <div><PackageCheck/><span><b>Project Supply</b><small>Direct and bulk requirements</small></span></div>
        <div><Truck/><span><b>Pan-India Dispatch</b><small>Business ordering workflow</small></span></div>
      </div></section>

      <section className="hvSection hvCategories" aria-labelledby="categories-title"><div className="container">
        <div className="hvSectionHead"><div><span>PRODUCT RANGE</span><h2 id="categories-title">Everything around solar protection & BOS.</h2><p>Browse the core component families used across residential, commercial and industrial solar installations.</p></div><Link href="/shop">View all products <ArrowRight size={17}/></Link></div>
        <div className="hvCategoryGrid">{categories.map(({name,desc,q,Icon})=><Link key={name} prefetch={false} href={`/shop?q=${encodeURIComponent(q)}`} className="hvCategoryCard"><span className="hvCategoryIcon"><Icon/></span><div><h3>{name}</h3><p>{desc}</p></div><ArrowRight className="hvCategoryArrow"/></Link>)}</div>
      </div></section>

      <section className="hvSection hvBuildSection" aria-labelledby="builder-title"><div className="container">
        <div className="hvSectionHead compact"><div><span>CUSTOM CONFIGURATION</span><h2 id="builder-title">Build the box your site actually needs.</h2><p>Select the protection, enclosure and accessories required for the installation instead of working around a fixed catalogue box.</p></div></div>
        <div className="hvBuilderGrid">
          <article className="hvBuilderCard hvBuilderDark"><div className="hvBuilderTop"><span>ACDB BUILDER</span><i>AC</i></div><h3>Configure your ACDB.</h3><p>Choose system size, phase, MCB/MCCB, SPD, indicators, busbar, terminals, internal wiring and enclosure.</p><div className="hvStepRow"><span>01 System</span><span>02 Protection</span><span>03 Accessories</span><span>04 Review</span></div><Link className="hvBtn hvBtnPrimary" href="/customize/acdb">Start ACDB Builder <ArrowRight size={17}/></Link></article>
          <article className="hvBuilderCard hvBuilderGreen"><div className="hvBuilderTop"><span>DCDB BUILDER</span><i>DC</i></div><h3>Configure your DCDB.</h3><p>Choose string count, voltage, DC MCB, SPD, fuse system, terminals, solar cable, glands and enclosure.</p><div className="hvStepRow"><span>01 Strings</span><span>02 Protection</span><span>03 Wiring</span><span>04 Review</span></div><Link className="hvBtn hvBtnPrimary" href="/customize/dcdb">Start DCDB Builder <ArrowRight size={17}/></Link></article>
        </div>
      </div></section>

      <section className="hvSection hvBuyWays" aria-labelledby="buyways-title"><div className="container">
        <div className="hvSectionHead"><div><span>BUY THE WAY YOUR PROJECT NEEDS</span><h2 id="buyways-title">One platform. Three buying flows.</h2><p>Move from a single component requirement to a configured assembly or a complete project enquiry without changing systems.</p></div></div>
        <div className="hvBuyGrid">
          <article><span>01</span><ShoppingCart/><h3>Direct Purchase</h3><p>Choose ready catalogue products, select quantity and place a GST-ready order.</p><Link href="/shop">Shop products <ArrowRight/></Link></article>
          <article><span>02</span><Settings2/><h3>Custom Build</h3><p>Configure ACDB/DCDB component by component and save the final BOM with your order.</p><Link href="/customize/dcdb">Open builder <ArrowRight/></Link></article>
          <article><span>03</span><FileText/><h3>Bulk / Project RFQ</h3><p>Share quantity, location and project requirement for volume and project-specific pricing.</p><Link href="/bulk-order">Send requirement <ArrowRight/></Link></article>
        </div>
      </div></section>

      <section className="hvSection hvWhy" id="why-us" aria-labelledby="why-title"><div className="container hvWhyGrid">
        <div className="hvWhyIntro"><span>WHY NEW INDIA SOLAR</span><h2 id="why-title">Built around the installer’s real procurement workflow.</h2><p>Products, custom configurations, bulk RFQs and order records work together, reducing the gaps between selection, pricing and production.</p><Link className="hvBtn hvBtnDark" href="/shop">Explore the catalogue <ArrowRight size={17}/></Link></div>
        <div className="hvWhyCards">
          <article className="wide"><SearchCheck/><div><h3>Clear component selection</h3><p>Choose protection and BOS components with structured specifications instead of relying on unstructured messages.</p></div></article>
          <article><Settings2/><div><h3>Dynamic configuration</h3><p>Build ACDB/DCDB from enclosure and component options.</p></div></article>
          <article><FileText/><div><h3>BOM snapshots</h3><p>Custom orders retain selected component and pricing data.</p></div></article>
          <article><ShieldCheck/><div><h3>Business-ready ordering</h3><p>GST details, project buying and bulk enquiry flows in one place.</p></div></article>
          <article><Truck/><div><h3>Operations connected</h3><p>Orders, RFQs, stock and production views use the same backend.</p></div></article>
        </div>
      </div></section>

      <section className="hvFinal"><div className="container hvFinalInner"><div><span>READY FOR YOUR NEXT INSTALLATION?</span><h2>Start with a component, a custom box, or a complete project requirement.</h2></div><div><Link className="hvBtn hvBtnLight" href="/shop">Shop Components</Link><Link className="hvBtn hvBtnPrimary" href="/bulk-order">Request Project Pricing <ArrowRight size={17}/></Link></div></div></section>
    </main>
    <StoreFooter/>
  </>
}

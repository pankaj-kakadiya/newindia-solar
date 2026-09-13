'use client'
import { Search, ShoppingCart, User, ArrowRight, ShieldCheck, Truck, PackageCheck, Wrench } from 'lucide-react'
import Link from 'next/link'

const categories = [
  ['ACDB','AC distribution boxes'],['DCDB','DC combiner boxes'],['MCB / MCCB','Protection devices'],['SPD','Surge protection'],['Solar Cable','DC wire & cable'],['Earthing Kit','Complete earthing kits'],['MC4','Connectors'],['Fuse','Fuse & holders'],['Enclosures','IP-rated boxes'],['Terminal Blocks','Connection systems'],['Cable Glands','Cable entry'],['BOS','Solar accessories']
]
const products = [
  ['ACDB','Solar ACDB Box','Single / Three Phase • configurable','Price after configuration'],
  ['DCDB','Solar DCDB Box','1–12 String • 600V / 1000V','Price after configuration'],
  ['SPD','DC SPD Type 2','Solar surge protection','Price on selection'],
  ['Solar Cable','Solar DC Cable','Multiple sq.mm • Red / Black','Price by length']
]

export default function Home(){
  return <>
    <div className="topbar"><div className="container"><span>Powering India’s Solar Installations.</span><span>Bulk Orders • GST Billing • Project Supply</span></div></div>
    <header className="header"><div className="container nav">
      <a className="logo" href="#"><div className="logoMark"><span>NI</span></div><div className="logoText"><b>NEW INDIA SOLAR</b><small>COMPONENTS PVT LTD</small></div></a>
      <nav className="navlinks"><a href="#products">Products</a><a href="#customize">Customize ACDB/DCDB</a><a href="#bulk">Bulk Order</a><a href="#">Downloads</a><a href="#">About</a><a href="#">Contact</a></nav>
      <div className="navActions"><button className="iconBtn" aria-label="Search"><Search size={18}/></button><button className="iconBtn" aria-label="Account"><User size={18}/></button><button className="iconBtn" aria-label="Cart"><ShoppingCart size={18}/></button></div>
    </div></header>

    <main>
      <section className="hero"><div className="container heroGrid">
        <div><span className="eyebrow">ACDB • DCDB • MCB • SPD • Solar Cable • BOS</span><h1>Solar components built for reliable installations.</h1><p>Buy ready products or configure your ACDB and DCDB with the enclosure, MCB/MCCB, SPD, fuse, cable and accessories your project requires.</p><div className="btnRow"><Link className="btn btnPrimary" href="/shop">Shop Solar Components <ArrowRight size={17}/></Link><Link className="btn btnSecondary" href="/customize/dcdb">Build ACDB / DCDB</Link><Link className="btn btnOutline" href="/bulk-order">Bulk Requirement</Link></div></div>
        <div className="heroCard"><b>Build Your Distribution Box</b><p style={{margin:'6px 0 16px',color:'#6B7280',fontSize:13}}>Choose components. See your configuration. Add directly to cart.</p><div className="builderVisual"><div className="boxMock"><b>ACDB</b><div className="components"><div className="comp green">MCB</div><div className="comp orange">SPD</div><div className="comp">RYB</div><div className="comp">N / E</div></div></div><div className="boxMock"><b>DCDB</b><div className="components"><div className="comp green">DC MCB</div><div className="comp orange">SPD</div><div className="comp">FUSE</div><div className="comp">TERM</div></div></div></div></div>
      </div></section>

      <div className="trustStrip"><div className="container trustGrid"><div className="trustItem"><ShieldCheck size={21}/><b>Industrial Protection</b><span>AC & DC solar protection components</span></div><div className="trustItem"><Wrench size={21}/><b>Custom Assembly</b><span>Configure box components project-wise</span></div><div className="trustItem"><PackageCheck size={21}/><b>Bulk & Project Supply</b><span>Suitable for EPCs, installers and dealers</span></div><div className="trustItem"><Truck size={21}/><b>Pan-India Dispatch</b><span>Direct order and business billing</span></div></div></div>

      <section className="section" id="products"><div className="container"><div className="sectionHead"><div><h2>Shop by category</h2><p>Everything required around solar AC/DC protection, connection and balance-of-system supply.</p></div><Link href="/shop">View all products →</Link></div><div className="categories">{categories.map(([name,sub],i)=><a className="cat" href="#" key={name}><div className="catIcon">{String(i+1).padStart(2,'0')}</div><b>{name}</b><span>{sub}</span></a>)}</div></div></section>

      <section className="section light" id="customize"><div className="container"><div className="sectionHead"><div><h2>Build exactly what your project needs.</h2><p>ACDB and DCDB builders are designed around selectable components instead of fixed one-size-fits-all boxes.</p></div></div><div className="builders"><div className="buildCard dark"><span className="eyebrow">CUSTOM ACDB</span><h3>Build Your ACDB</h3><p>Select system kW, phase, enclosure, MCB/MCCB, SPD, busbar, indicators, terminals, internal wire and cable glands.</p><div className="steps"><span className="step">1. System</span><span className="step">2. Protection</span><span className="step">3. Accessories</span><span className="step">4. Price</span></div><Link className="btn btnPrimary" href="/customize/acdb">Start ACDB Builder →</Link></div><div className="buildCard green"><span style={{fontWeight:800,color:'#1D9B54'}}>CUSTOM DCDB</span><h3>Build Your DCDB</h3><p>Select strings, voltage, enclosure, DC MCB/isolator, SPD, fuse system, terminals, cable and glands.</p><div className="steps"><span className="step">1. Strings</span><span className="step">2. Protection</span><span className="step">3. Wiring</span><span className="step">4. Price</span></div><Link className="btn btnPrimary" href="/customize/dcdb">Start DCDB Builder →</Link></div></div></div></section>

      <section className="section"><div className="container"><div className="sectionHead"><div><h2>Popular product families</h2><p>Product cards will load live price, stock and variant data from the New India Solar Supabase product master.</p></div></div><div className="productGrid">{products.map(([cat,name,spec,price])=><article className="product" key={name}><div className="productImg"><div className="miniBox"/></div><div className="productBody"><small>{cat}</small><h3>{name}</h3><div className="specs">{spec}</div><div className="price muted">{price}</div><div className="productActions"><button>Bulk Price</button><button className="buy">View / Buy</button></div></div></article>)}</div></div></section>

      <section className="section" id="bulk"><div className="container"><div className="bulk"><div><h2>Buying for an EPC project or in bulk?</h2><p>Upload your BOM or submit quantities for ACDB, DCDB, MCB, SPD, cable, earthing and other BOS components. We’ll keep the direct store simple while supporting larger project requirements.</p></div><Link className="btn btnPrimary" href="/bulk-order">Submit Bulk Requirement →</Link></div></div></section>
    </main>

    <footer className="footer"><div className="container"><div className="footerGrid"><div><div className="logo"><div className="logoMark" style={{borderColor:'#fff'}}><span>NI</span></div><div className="logoText"><b style={{color:'#fff'}}>NEW INDIA SOLAR</b><small>COMPONENTS PVT LTD</small></div></div><p style={{maxWidth:420,lineHeight:1.6}}>ACDB, DCDB and solar BOS components for installers, EPC companies, dealers and solar projects across India.</p></div><div><h4>Shop</h4><a>ACDB</a><a>DCDB</a><a>MCB / MCCB</a><a>SPD</a><a>Solar Cable</a></div><div><h4>Customize</h4><a>Build ACDB</a><a>Build DCDB</a><a>Bulk Order</a><a>Downloads</a></div><div><h4>Company</h4><a>About Us</a><a>Contact</a><a>Terms</a><a>Privacy</a></div></div><div className="copyright">© 2026 New India Solar Components Pvt Ltd. All rights reserved.</div></div></footer>
  </>
}

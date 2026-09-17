import type {Metadata} from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {ArrowRight, Boxes, Cable, CircuitBoard, PlugZap, ShieldCheck, Sparkles} from 'lucide-react'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'

export const metadata:Metadata={title:'Solar Component Categories | New India Solar',description:'Explore ACDB, DCDB, switchgear, surge protection, solar cable, connectors, earthing and solar BOS categories.',alternates:{canonical:'/categories'}}

const groups=[
 {title:'Boxes & protection',copy:'Ready protection boxes and enclosure systems for the AC and DC side of solar installations.',icon:ShieldCheck,items:[
  {name:'ACDB',desc:'AC distribution and protection boxes',slug:'acdb',img:'/acdb-demo.svg'},
  {name:'DCDB',desc:'DC combiner and protection boxes',slug:'dcdb',img:'/dcdb-demo.svg'},
  {name:'Enclosures',desc:'IP-rated boxes and cabinets',slug:'enclosures',icon:Boxes},
 ]},
 {title:'Switchgear & surge',copy:'Core protection devices for isolation, overcurrent protection and surge management.',icon:CircuitBoard,items:[
  {name:'MCB / MCCB',desc:'AC and DC circuit protection devices',slug:'mcb-mccb',img:'/mcb-demo.svg'},
  {name:'SPD',desc:'AC and DC surge protection',slug:'spd',img:'/spd-demo.svg'},
  {name:'DC fuses',desc:'Fuse links, holders and protection',slug:'dc-fuses',img:'/fuse-demo.svg'},
 ]},
 {title:'Wiring & connections',copy:'PV wiring, connectors, terminals and sealed cable-entry components.',icon:Cable,items:[
  {name:'Solar cable',desc:'PV cable and internal wiring',slug:'solar-cable',img:'/cable-demo.svg'},
  {name:'MC4 connectors',desc:'PV connectors and accessories',slug:'mc4-connectors',img:'/mc4-demo.svg'},
  {name:'Cable glands',desc:'Sealed and secure cable entry',slug:'cable-glands',img:'/gland-demo.svg'},
  {name:'Terminal blocks',desc:'Organised internal connections',slug:'terminal-blocks',icon:PlugZap},
 ]},
 {title:'Earthing & BOS',copy:'Installation essentials that complete the system around protection and distribution equipment.',icon:Sparkles,items:[
  {name:'Earthing kits',desc:'Project earthing solutions',slug:'earthing-kits',img:'/earthing-demo.svg'},
  {name:'BOS accessories',desc:'Balance-of-system components',slug:'bos-accessories',icon:Sparkles},
 ]},
]

export default function CategoriesPage(){return <><StoreHeader/><main id="main-content" className="sxPage"><section className="sxHero"><div className="container"><span>PRODUCT DIRECTORY</span><h1>Every component. One clear buying path.</h1><p>Move from protection boxes to switchgear, wiring and BOS essentials without losing time between disconnected catalogues.</p><div><Link href="/shop" className="nisBtn nisBtnPrimary">Shop all components <ArrowRight size={17}/></Link><Link href="/combo" className="nisBtn nisBtnOutline">Build an ACDB + DCDB combo</Link></div></div></section><section className="container sxGroups" aria-label="Solar component categories">{groups.map(({title,copy,icon:GroupIcon,items},index)=><article className="sxGroup" key={title}><header><i><GroupIcon size={22}/></i><div><span>0{index+1}</span><h2>{title}</h2><p>{copy}</p></div></header><div className="sxCategoryGrid">{items.map(item=>{const Icon=item.icon;return <Link href={`/categories/${item.slug}`} key={item.name}><div className="sxCategoryMedia">{item.img?<Image src={item.img} alt="" width={150} height={120}/>:Icon?<Icon size={48}/>:null}</div><span>{item.name}</span><p>{item.desc}</p><strong>Explore products <ArrowRight size={15}/></strong></Link>})}</div></article>)}</section><section className="container sxJourney"><div><span>COMPLETE PROTECTION PAIR</span><h2>Buying ACDB and DCDB for the same project?</h2><p>Select one published product from each side, set quantities and add the pair to your cart together.</p></div><Link href="/combo">Create your combo <ArrowRight size={18}/></Link></section></main><StoreFooter/></>}

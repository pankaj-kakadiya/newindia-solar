import type {Metadata} from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {ArrowRight, Layers, ShieldCheck} from 'lucide-react'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'

export const metadata:Metadata={title:'Solar Component Categories | New India Solar',description:'Explore solar ACDB, DCDB and matched ACDB + DCDB combo boxes for 1–6 kW single phase rooftop solar.',alternates:{canonical:'/categories'}}

const groups=[
 {title:'ACDB & DCDB boxes',copy:'Ready-wired 1–6 kW single phase protection boxes for the AC and DC side of rooftop solar, sold separately or as matched sets.',icon:ShieldCheck,items:[
  {name:'ACDB + DCDB Combo',desc:'Matched 1–6 kW ACDB + DCDB box sets',slug:'acdb-dcdb-combo',icon:Layers},
  {name:'ACDB',desc:'AC distribution and protection boxes',slug:'acdb',img:'/acdb-demo.svg'},
  {name:'DCDB',desc:'DC combiner and protection boxes',slug:'dcdb',img:'/dcdb-demo.svg'},
 ]},
]

export default function CategoriesPage(){return <><StoreHeader/><main id="main-content" className="sxPage"><section className="sxHero"><div className="container"><span>PRODUCT DIRECTORY</span><h1>ACDB, DCDB and matched combos.</h1><p>Ready-wired solar protection boxes for 1–6 kW single phase rooftop systems — buy the AC side, the DC side, or both together as a combo.</p><div><Link href="/shop" className="nisBtn nisBtnPrimary">Shop all components <ArrowRight size={17}/></Link><Link href="/categories/acdb-dcdb-combo" className="nisBtn nisBtnOutline">Shop ACDB + DCDB combos</Link></div></div></section><section className="container sxGroups" aria-label="Solar component categories">{groups.map(({title,copy,icon:GroupIcon,items},index)=><article className="sxGroup" key={title}><header><i><GroupIcon size={22}/></i><div><span>0{index+1}</span><h2>{title}</h2><p>{copy}</p></div></header><div className="sxCategoryGrid">{items.map(item=>{const Icon=item.icon;return <Link href={`/categories/${item.slug}`} key={item.name}><div className="sxCategoryMedia">{item.img?<Image src={item.img} alt="" width={150} height={120}/>:Icon?<Icon size={48}/>:null}</div><span>{item.name}</span><p>{item.desc}</p><strong>Explore products <ArrowRight size={15}/></strong></Link>})}</div></article>)}</section><section className="container sxJourney"><div><span>COMPLETE PROTECTION PAIR</span><h2>Buying ACDB and DCDB for the same project?</h2><p>Pick a ready-matched ACDB + DCDB combo set for 1–6 kW single phase systems and order both boxes together.</p></div><Link href="/categories/acdb-dcdb-combo">Shop combos <ArrowRight size={18}/></Link></section></main><StoreFooter/></>}

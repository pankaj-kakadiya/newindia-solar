'use client'

import {createContext,useContext,useEffect,useMemo,useState} from 'react'
import {supabase} from '../lib/supabase'
import {normalizeHomeSections} from '../lib/homepage-sections'

export type CmsNavItem={id:string;area:string;label:string;href:string;sort_order:number;is_active:boolean;is_external:boolean}
export type CmsFooterPage={id:string;slug:string;title:string;sort_order:number}

const defaults:any={
 site:{topbar_enabled:true,topbar_message:"Powering India's Solar Installations.",topbar_items:['GST Billing','Custom ACDB / DCDB','Pan-India Project Supply'],announcement_enabled:false,announcement_text:'',announcement_href:'',announcement_label:'Learn more'},
 home:{hero:{eyebrow:'Solar BOS infrastructure for EPCs & installers',title:'Solar components built to move projects faster.',highlight:'move projects faster.',body:'Source ACDB, DCDB and BOS components, configure project-specific boxes, or send a bulk requirement from one procurement-ready platform.',primary_label:'Shop Components',primary_href:'/shop',secondary_label:'Build ACDB / DCDB',secondary_href:'/customize/dcdb',tertiary_label:'Project RFQ',tertiary_href:'/bulk-order',proof:['GST-ready ordering','Configurable ACDB / DCDB','Direct + bulk buying'],banner_image_url:''},section_order:['trust','collections','builder','buyways','why','final'],visibility:{trust:true,collections:true,builder:true,buyways:true,why:true,final:true},collections_heading:'Everything around solar protection & BOS.',collections_body:'Browse the core component families used across residential, commercial and industrial solar installations.',featured_collections:[],builder_heading:'Build the box your site actually needs.',builder_body:'Select the protection, enclosure and accessories required for the installation instead of working around a fixed catalogue box.',buyways_heading:'One platform. Three buying flows.',buyways_body:'Move from a single component requirement to a configured assembly or a complete project enquiry without changing systems.',why_heading:"Built around the installer's real procurement workflow.",why_body:'Products, custom configurations, bulk RFQs and order records work together, reducing the gaps between selection, pricing and production.',final_eyebrow:'READY FOR YOUR NEXT INSTALLATION?',final_heading:'Start with a component, a custom box, or a complete project requirement.'},
 footer:{cta_eyebrow:'PROJECT & BULK SUPPLY',cta_title:'Need a custom BOM or volume quote?',cta_body:'Share quantities, ratings and dispatch location. Your requirement goes directly into our RFQ pipeline.',cta_label:'Request Project Pricing',cta_href:'/bulk-order',about:'ACDB, DCDB and solar BOS components for EPCs, installers, dealers and project buyers across India.',city:'Surat, Gujarat, India',email:'',phone:'',website:'newindiasolar.com',small_note:'For project quantities, technical selection or custom box requirements, contact our team through the Bulk Order form.'},
 seo:{home_title:'New India Solar | ACDB, DCDB & Solar BOS Components',home_description:'Buy ACDB, DCDB and solar BOS components, configure custom distribution boxes, and submit project RFQs for EPC and installer requirements across India.',og_title:'New India Solar Components Pvt Ltd',og_description:'Solar components built for reliable installations.'}
}

const fallbackNav:CmsNavItem[]=[
 {id:'h1',area:'header',label:'Bulk Order',href:'/bulk-order',sort_order:10,is_active:true,is_external:false},{id:'h2',area:'header',label:'Why New India',href:'/#why-us',sort_order:20,is_active:true,is_external:false},{id:'h3',area:'header',label:'Contact',href:'/#contact',sort_order:30,is_active:true,is_external:false},
 {id:'fp1',area:'footer_products',label:'All Products',href:'/shop',sort_order:10,is_active:true,is_external:false},{id:'fp2',area:'footer_products',label:'ACDB',href:'/shop?q=ACDB',sort_order:20,is_active:true,is_external:false},{id:'fp3',area:'footer_products',label:'DCDB',href:'/shop?q=DCDB',sort_order:30,is_active:true,is_external:false},{id:'fp4',area:'footer_products',label:'SPD',href:'/shop?q=SPD',sort_order:40,is_active:true,is_external:false},{id:'fp5',area:'footer_products',label:'Solar Cable',href:'/shop?q=Solar%20Cable',sort_order:50,is_active:true,is_external:false},
 {id:'fb1',area:'footer_buy',label:'Custom ACDB / DCDB',href:'/customize',sort_order:10,is_active:true,is_external:false},{id:'fb2',area:'footer_buy',label:'Bulk Order',href:'/bulk-order',sort_order:20,is_active:true,is_external:false},{id:'fb3',area:'footer_buy',label:'Cart',href:'/cart',sort_order:30,is_active:true,is_external:false},{id:'fb4',area:'footer_buy',label:'Account',href:'/login',sort_order:40,is_active:true,is_external:false}
]

type Ctx={site:any;home:any;footer:any;seo:any;navigation:CmsNavItem[];footerPages:CmsFooterPage[];loading:boolean;reload:()=>Promise<void>}
const SiteContentContext=createContext<Ctx>({...defaults,navigation:fallbackNav,footerPages:[],loading:false,reload:async()=>{}})

export function SiteContentProvider({children}:{children:React.ReactNode}){
 const [content,setContent]=useState<any>(defaults),[navigation,setNavigation]=useState<CmsNavItem[]>(fallbackNav),[footerPages,setFooterPages]=useState<CmsFooterPage[]>([]),[loading,setLoading]=useState(true)
 async function load(){
  const [s,n,p]=await Promise.all([
   supabase.from('cms_settings').select('key,value'),
   supabase.from('cms_navigation_items').select('id,area,label,href,sort_order,is_active,is_external').eq('is_active',true).order('sort_order'),
   supabase.from('cms_pages').select('id,slug,title,sort_order').eq('status','published').eq('show_in_footer',true).order('sort_order')
  ])
  const next:any={...defaults};for(const r of s.data||[])next[r.key]={...(defaults as any)[r.key],...(r.value||{})}
  next.home={...defaults.home,...next.home,hero:{...defaults.home.hero,...next.home.hero},visibility:{...defaults.home.visibility,...next.home.visibility},section_order:normalizeHomeSections(next.home.section_order)}
  setContent(next);if((n.data||[]).length)setNavigation(n.data as CmsNavItem[]);setFooterPages((p.data||[]) as CmsFooterPage[]);setLoading(false)
 }
 useEffect(()=>{load()},[])
 const value=useMemo(()=>({site:content.site,home:content.home,footer:content.footer,seo:content.seo,navigation,footerPages,loading,reload:load}),[content,navigation,footerPages,loading])
 return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
}
export const useSiteContent=()=>useContext(SiteContentContext)

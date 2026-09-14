'use client'

import {createContext,useContext,useEffect,useMemo,useState} from 'react'
import {usePathname} from 'next/navigation'
import {supabase} from '../lib/supabase'

export type StoreTheme={
  branding:{companyName:string;tagline:string;promise:string;logoUrl:string;logoAlt:string}
  colors:{navy:string;navy2:string;primary:string;primary2:string;gold:string;orange:string;text:string;muted:string;border:string;surface:string;background:string;topbarBg:string;topbarText:string;headerBg:string;heroStart:string;heroEnd:string;footerBg:string;footerText:string;success:string;danger:string}
  typography:{bodyFont:string;headingFont:string;baseSize:number;bodyWeight:number;headingWeight:number;letterSpacing:number}
  layout:{containerWidth:number;sectionSpacing:number;cardRadius:number;buttonRadius:number;inputRadius:number;headerHeight:number;logoWidth:number;shadowOpacity:number}
  header:{showTopbar:boolean;sticky:boolean;topbarItems:string[]}
  customCss:string
}

export const defaultTheme:StoreTheme={
  branding:{companyName:'New India Solar Components Pvt Ltd',tagline:'Powering India’s Solar Installations.',promise:'Tested. Packed. Guaranteed.',logoUrl:'/new-india-solar-logo.webp',logoAlt:'New India Solar Components Pvt Ltd'},
  colors:{navy:'#0D1B2A',navy2:'#10283D',primary:'#1D9B54',primary2:'#2EAA4F',gold:'#FFB703',orange:'#F77F00',text:'#10202F',muted:'#687684',border:'#E2E8ED',surface:'#F5F8F6',background:'#FFFFFF',topbarBg:'#07131F',topbarText:'#D5E1EA',headerBg:'#FFFFFF',heroStart:'#091522',heroEnd:'#123223',footerBg:'#08131E',footerText:'#AEBBC5',success:'#1D9B54',danger:'#B54747'},
  typography:{bodyFont:'Inter, Arial, sans-serif',headingFont:'Poppins, Inter, Arial, sans-serif',baseSize:16,bodyWeight:400,headingWeight:800,letterSpacing:0},
  layout:{containerWidth:1280,sectionSpacing:74,cardRadius:16,buttonRadius:10,inputRadius:9,headerHeight:78,logoWidth:178,shadowOpacity:.11},
  header:{showTopbar:true,sticky:true,topbarItems:['GST Billing','Project Supply','Pan-India Dispatch']},
  customCss:''
}

function mergeTheme(raw:any):StoreTheme{
  return {
    ...defaultTheme,
    ...raw,
    branding:{...defaultTheme.branding,...raw?.branding},
    colors:{...defaultTheme.colors,...raw?.colors},
    typography:{...defaultTheme.typography,...raw?.typography},
    layout:{...defaultTheme.layout,...raw?.layout},
    header:{...defaultTheme.header,...raw?.header},
    customCss:typeof raw?.customCss==='string'?raw.customCss:''
  }
}

function css(theme:StoreTheme){
  const c=theme.colors,t=theme.typography,l=theme.layout,h=theme.header
  return `
:root{
--navy:${c.navy};--green:${c.primary};--green2:${c.primary2};--gold:${c.gold};--orange:${c.orange};--gray:${c.muted};--light:${c.surface};--border:${c.border};--white:${c.background};--ink:${c.text};
--nis-navy:${c.navy};--nis-navy2:${c.navy2};--nis-green:${c.primary};--nis-green2:${c.primary2};--nis-gold:${c.gold};--nis-orange:${c.orange};--nis-text:${c.text};--nis-muted:${c.muted};--nis-border:${c.border};--nis-soft:${c.surface};
--theme-bg:${c.background};--theme-surface:${c.surface};--theme-text:${c.text};--theme-muted:${c.muted};--theme-topbar-bg:${c.topbarBg};--theme-topbar-text:${c.topbarText};--theme-header-bg:${c.headerBg};--theme-footer-bg:${c.footerBg};--theme-footer-text:${c.footerText};
--theme-card-radius:${l.cardRadius}px;--theme-button-radius:${l.buttonRadius}px;--theme-input-radius:${l.inputRadius}px;--theme-container-width:${l.containerWidth}px;--theme-section-space:${l.sectionSpacing}px;--theme-header-height:${l.headerHeight}px;--theme-logo-width:${l.logoWidth}px;--theme-shadow:0 20px 55px rgba(13,27,42,${l.shadowOpacity});
}
body{font-family:${t.bodyFont}!important;background:${c.background}!important;color:${c.text}!important;font-size:${t.baseSize}px;letter-spacing:${t.letterSpacing}px}
h1,h2,h3,h4,h5,h6{font-family:${t.headingFont}!important;font-weight:${t.headingWeight}!important}
.container{max-width:${l.containerWidth}px!important}
.nisTopbar{background:${c.topbarBg}!important;color:${c.topbarText}!important;${h.showTopbar?'':'display:none!important;'}}
.nisHeader{background:${c.headerBg}!important;${h.sticky?'position:sticky!important;top:0!important;':'position:relative!important;top:auto!important;'}}
.nisNav{height:${l.headerHeight}px!important}.nisBrand img{width:${l.logoWidth}px!important}
.nisHero,.hero{background:linear-gradient(120deg,${c.heroStart} 0%,${c.navy} 55%,${c.heroEnd} 100%)!important}
.nisSection,.section{padding-top:${l.sectionSpacing}px!important;padding-bottom:${l.sectionSpacing}px!important}
.nisFooter,.footer{background:${c.footerBg}!important;color:${c.footerText}!important}
.nisPrimaryBtn,.btn,.btnPrimary,.productCard button,.checkoutForm button,.rfqForm button{border-radius:${l.buttonRadius}px!important}
input,select,textarea,.searchBox,.nisSearchModal form{border-radius:${l.inputRadius}px!important}
.productCard,.product,.nisCategoryCard,.nisTrustCard,.nisHowCard,.nisBuilderCard,.accountCard,.accountSide,.summary,.configSummary,.authCard,.adminCard,.statCard{border-radius:${l.cardRadius}px!important}
.nisDropMenu,.nisSearchModal{box-shadow:var(--theme-shadow)!important}
${theme.customCss||''}
  `
}

const ThemeContext=createContext<{theme:StoreTheme;loaded:boolean}>({theme:defaultTheme,loaded:false})
export const useStoreTheme=()=>useContext(ThemeContext)

export default function ThemeProvider({children}:{children:React.ReactNode}){
  const path=usePathname();const [theme,setTheme]=useState(defaultTheme);const [loaded,setLoaded]=useState(false)
  useEffect(()=>{let alive=true;(async()=>{const {data}=await supabase.from('theme_settings').select('settings').eq('key','storefront').maybeSingle();if(!alive)return;setTheme(mergeTheme(data?.settings));setLoaded(true)})();return()=>{alive=false}},[])
  useEffect(()=>{if(path.startsWith('/admin')){document.getElementById('nis-dynamic-theme')?.remove();return}let tag=document.getElementById('nis-dynamic-theme') as HTMLStyleElement|null;if(!tag){tag=document.createElement('style');tag.id='nis-dynamic-theme';document.head.appendChild(tag)}tag.textContent=css(theme);return()=>{}},[theme,path])
  const value=useMemo(()=>({theme,loaded}),[theme,loaded])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

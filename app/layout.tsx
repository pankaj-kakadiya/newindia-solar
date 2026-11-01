import './globals.css'
import './buyer-account.css'
import './brand.css'
import './upgrade.css'
import './upgrade2.css'
import './upgrade3.css'
import './upgrade4.css'
import './upgrade5.css'
import './theme-admin.css'
import './upgrade6.css'
import './product-admin.css'
import './product-detail-flow.css'
import './upgrade7.css'
import './product-admin-pro.css'
import './homepage-v2.css'
import './header-v2.css'
import './product-page-v3.css'
import './product-image-fit.css'
import './configurator-v2.css'
import './configurator-admin.css'
import './configurator-editor-v2.css'
import './production-fixes.css'
import './responsive-final.css'
import './responsive-hotfix.css'
import './buyer-design-system-v2.css'
import './admin-shell-v2.css'
import './admin-dashboard-v2.css'
import './orders-v2.css'
import './admin-catalogue-v2.css'
import './inventory-v2.css'
import './production-v2.css'
import './rfq-v2.css'
import './customers-v2.css'
import './procurement-v2.css'
import './pricing-v2.css'
import './finance-v2.css'
import './accounting-v2.css'
import './reports-v2.css'
import './cms-v2.css'
import './access-v2.css'
import './notifications-v2.css'
import './workflows-v2.css'
import './global-search-v2.css'
import './configurator-assets-v3.css'
import './manufacturing-v2.css'
import './product-cost-v2.css'
import './storefront-v3.css'
import './storefront-polish-v4.css'
import './admin-login-v2.css'
import './admin-panel-v3.css'
import './storefront-visual-v5.css'
import './product-responsive-v6.css'
import './storefront-fixes-v7.css'
import './support-chat-v8.css'
import './support-chat-controls-v8.css'
import './launch-v9.css'
import './campaigns-v1.css'
import type {Metadata,Viewport} from 'next'
import {CartProvider} from '../components/CartProvider'
import ThemeProvider from '../components/ThemeProvider'
import {SiteContentProvider} from '../components/SiteContentProvider'
import SupportLauncher from '../components/support/SupportLauncher'
import MarketingTags from '../components/MarketingTags'
import {marketingSettings} from '../lib/marketing-settings'
import {DEFAULT_DESCRIPTION,LOGO_URL,SITE_NAME,SITE_URL,jsonLdString,organizationJsonLd,websiteJsonLd} from '../lib/seo'

export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#0b3a30'}

export async function generateMetadata():Promise<Metadata>{
 const tags=await marketingSettings()
 const other:Record<string,string>={}
 if(tags.bingVerification)other['msvalidate.01']=tags.bingVerification
 if(tags.metaDomainVerification)other['facebook-domain-verification']=tags.metaDomainVerification
 return {
  metadataBase:new URL(SITE_URL),
  title:'New India Solar | Solar ACDB, DCDB & Combo Boxes',
  description:DEFAULT_DESCRIPTION,
  applicationName:SITE_NAME,
  keywords:['solar ACDB','solar DCDB','ACDB DCDB combo','ACDB box','DCDB box','single phase ACDB','1 in 1 out DCDB','rooftop solar distribution box','solar distribution box India','New India Solar'],
  openGraph:{type:'website',siteName:SITE_NAME,locale:'en_IN',url:SITE_URL,title:'New India Solar | Solar ACDB, DCDB & Combo Boxes',description:DEFAULT_DESCRIPTION,images:[{url:LOGO_URL,alt:'New India Solar'}]},
  twitter:{card:'summary',title:'New India Solar | Solar ACDB, DCDB & Combo Boxes',description:DEFAULT_DESCRIPTION,images:[LOGO_URL]},
  icons:{icon:'/new-india-solar-logo.webp',apple:'/new-india-solar-logo.webp'},
  formatDetection:{telephone:false},
  verification:{...(tags.googleVerification?{google:tags.googleVerification}:{}),...(Object.keys(other).length?{other}:{})},
 }
}

export default async function RootLayout({children}:{children:React.ReactNode}){
 const tags=await marketingSettings()
 return <html lang="en-IN"><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdString([organizationJsonLd(),websiteJsonLd()])}}/><ThemeProvider><SiteContentProvider><CartProvider>{children}<SupportLauncher/></CartProvider></SiteContentProvider></ThemeProvider><MarketingTags settings={tags}/></body></html>
}

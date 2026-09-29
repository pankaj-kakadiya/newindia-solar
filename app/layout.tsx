import './globals.css'
import './buyer-account.css'
import './brand.css'
import './upgrade.css'
import './upgrade2.css'
import './upgrade3.css'
import './upgrade4.css'
import './upgrade5.css'
import './upgrade6.css'
import './product-detail-flow.css'
import './upgrade7.css'
import './homepage-v2.css'
import './header-v2.css'
import './product-page-v3.css'
import './product-image-fit.css'
import './configurator-v2.css'
import './production-fixes.css'
import './responsive-final.css'
import './responsive-hotfix.css'
import './buyer-design-system-v2.css'
import './configurator-assets-v3.css'
import './storefront-v3.css'
import './storefront-polish-v4.css'
import './admin-login-v2.css'
import './storefront-visual-v5.css'
import './product-responsive-v6.css'
import './storefront-fixes-v7.css'
import './support-chat-v8.css'
import './support-chat-controls-v8.css'
import type {Metadata} from 'next'
import {CartProvider} from '../components/CartProvider'
import ThemeProvider from '../components/ThemeProvider'
import {SiteContentProvider} from '../components/SiteContentProvider'
import SupportLauncher from '../components/support/SupportLauncher'

export const metadata:Metadata={
 icons:{icon:'/new-india-solar-logo.webp'},
 metadataBase:new URL('https://newindiasolar.com'),
 title:'New India Solar | ACDB, DCDB & Solar Components',
 description:'Shop ACDB, DCDB, MCB, SPD, solar cable, earthing kits and customize ACDB/DCDB boxes for solar installations.'
}

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><ThemeProvider><SiteContentProvider><CartProvider>{children}<SupportLauncher/></CartProvider></SiteContentProvider></ThemeProvider></body></html>
}

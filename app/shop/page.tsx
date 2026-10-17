import type {Metadata} from 'next'
import {Suspense} from 'react'
import ShopCatalogue from '../../components/buyer/ShopCatalogue'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
import './catalogue-v2.css'

export const metadata: Metadata = {
  title: 'Buy Solar ACDB, DCDB & Combo Boxes Online | New India Solar',
  description: 'Buy solar ACDB, DCDB and ACDB + DCDB combo boxes for 1–6 kW single phase rooftop solar. Compare ratings, GST-inclusive prices and order online or request bulk pricing.',
  alternates: {canonical: '/shop'},
}
export default function ShopPage() {
  return <><StoreHeader/><Suspense fallback={<main id="main-content" className="container cvPage" aria-busy="true"><h1 className="nisH1">Solar component catalogue</h1><p role="status">Loading catalogue…</p></main>}><ShopCatalogue/></Suspense><StoreFooter/></>
}

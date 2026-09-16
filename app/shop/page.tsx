import type {Metadata} from 'next'
import {Suspense} from 'react'
import ShopCatalogue from '../../components/buyer/ShopCatalogue'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
import './catalogue-v2.css'

export const metadata: Metadata = {
  title: 'Shop Solar Components | New India Solar',
  description: 'Browse ACDB, DCDB and solar BOS components. Filter published specifications, compare GST-inclusive starting prices and enquire for project quantities.',
  alternates: {canonical: '/shop'},
}
export default function ShopPage() {
  return <><StoreHeader/><Suspense fallback={<main id="main-content" className="container cvPage" aria-busy="true"><h1 className="nisH1">Solar component catalogue</h1><p role="status">Loading catalogue…</p></main>}><ShopCatalogue/></Suspense><StoreFooter/></>
}

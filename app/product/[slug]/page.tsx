import type {Metadata} from 'next'
import {Suspense} from 'react'
import ProductDetail from '../../../components/buyer/ProductDetail'
import StoreHeader from '../../../components/StoreHeader'
import StoreFooter from '../../../components/StoreFooter'
import './product-detail-v2.css'
export const metadata:Metadata={title:'Product Details | New India Solar',description:'Review published solar component specifications, select a product variant and check its price, GST and availability.'}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params
  return <><StoreHeader/><Suspense fallback={<main id="main-content" className="container p28State" aria-busy="true"><p role="status">Loading product…</p></main>}><ProductDetail slug={slug} key={slug}/></Suspense><StoreFooter/></>
}

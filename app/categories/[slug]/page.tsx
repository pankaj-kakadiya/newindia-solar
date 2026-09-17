import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {Suspense} from 'react'
import StoreHeader from '../../../components/StoreHeader'
import StoreFooter from '../../../components/StoreFooter'
import ShopCatalogue from '../../../components/buyer/ShopCatalogue'
import {CATEGORY_PAGES,categoryPage} from '../../../lib/category-pages'
import '../../shop/catalogue-v2.css'

export const dynamicParams=false
export function generateStaticParams(){return CATEGORY_PAGES.map(({slug})=>({slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params,category=categoryPage(slug);return category?{title:`${category.label} Products | New India Solar`,description:category.description,alternates:{canonical:`/categories/${slug}`}}:{title:'Product Category | New India Solar'}}
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params,category=categoryPage(slug);if(!category)notFound();const scope={categoryTerms:category.categoryTerms,label:category.label,path:`/categories/${category.slug}`,description:category.description};return <><StoreHeader/><Suspense fallback={<main id="main-content" className="container cvPage" aria-busy="true"><h1 className="nisH1">{category.label}</h1><p role="status">Loading products…</p></main>}><ShopCatalogue scope={scope}/></Suspense><StoreFooter/></>}

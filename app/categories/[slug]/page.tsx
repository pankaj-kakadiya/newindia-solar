import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {Suspense} from 'react'
import StoreHeader from '../../../components/StoreHeader'
import StoreFooter from '../../../components/StoreFooter'
import ShopCatalogue from '../../../components/buyer/ShopCatalogue'
import {CATEGORY_PAGES,categoryPage} from '../../../lib/category-pages'
import {LOGO_URL,SITE_NAME,SITE_URL,breadcrumbJsonLd,jsonLdString} from '../../../lib/seo'
import '../../shop/catalogue-v2.css'

export const dynamicParams=false
export function generateStaticParams(){return CATEGORY_PAGES.map(({slug})=>({slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params,category=categoryPage(slug);return category?{title:{absolute:category.seoTitle},description:category.description,alternates:{canonical:`/categories/${slug}`},openGraph:{type:'website',siteName:SITE_NAME,locale:'en_IN',title:category.seoTitle,description:category.description,url:`${SITE_URL}/categories/${slug}`,images:[{url:LOGO_URL,alt:SITE_NAME}]}}:{title:'Product Category | New India Solar'}}
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params,category=categoryPage(slug);if(!category)notFound();const scope={categoryTerms:category.categoryTerms,label:category.label,path:`/categories/${category.slug}`,description:category.description,productSlugPrefix:category.productSlugPrefix,excludeSlugPrefix:category.excludeSlugPrefix};const breadcrumbs=breadcrumbJsonLd([{name:'Home',url:SITE_URL},{name:'Categories',url:`${SITE_URL}/categories`},{name:category.label,url:`${SITE_URL}/categories/${category.slug}`}]);return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdString(breadcrumbs)}}/><StoreHeader/><Suspense fallback={<main id="main-content" className="container cvPage" aria-busy="true"><h1 className="nisH1">{category.label}</h1><p role="status">Loading products…</p></main>}><ShopCatalogue scope={scope}/></Suspense><StoreFooter/></>}

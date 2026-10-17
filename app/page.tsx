import type {Metadata} from 'next'
import HomePageContent from '../components/HomePageContent'
import {supabase} from '../lib/supabase'
import {isStorefrontProduct} from '../lib/storefront-scope'
import {withDefaultCatalogue, type HomeProduct, type HomeDownload} from '../lib/homepage-sections'

export const dynamic='force-dynamic'

export async function generateMetadata():Promise<Metadata>{
  const {data}=await supabase.from('cms_settings').select('value').eq('key','seo').abortSignal(AbortSignal.timeout(6000)).maybeSingle()
  const seo:any=data?.value||{}
  const title=seo.home_title||'New India Solar | Solar ACDB, DCDB & Combo Boxes Online'
  const description=seo.home_description||'Buy solar ACDB, DCDB and matched ACDB + DCDB combo boxes for 1–6 kW single phase rooftop solar, and submit project RFQs for EPC and installer requirements across India.'
  return {title:{absolute:title},description,alternates:{canonical:'/'},openGraph:{title:seo.og_title||title,description:seo.og_description||description,type:'website',siteName:'New India Solar',locale:'en_IN',url:'https://newindiasolar.com',images:[{url:'https://newindiasolar.com/new-india-solar-full-logo.webp',alt:'New India Solar'}]}}
}

export default async function Home(){
  const [products, downloads] = await Promise.all([
    supabase.from('products').select('id,name,slug,short_description,featured,gst_rate,categories(name,slug),product_images(image_url,alt_text,sort_order),product_variants(selling_price,stock_qty,sku)').eq('status','active').order('featured',{ascending:false}).order('sort_order').limit(60).abortSignal(AbortSignal.timeout(6000)),
    supabase.from('cms_downloads').select('id,title,description,file_url,category').eq('is_active',true).order('sort_order').limit(12).abortSignal(AbortSignal.timeout(6000)),
  ])
  return <HomePageContent products={((products.data || []) as any[]).filter(isStorefrontProduct).slice(0,4) as HomeProduct[]} downloads={withDefaultCatalogue((downloads.data || []) as HomeDownload[])} productsUnavailable={!!products.error}/>
}

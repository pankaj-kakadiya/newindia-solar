import type {Metadata} from 'next'
import HomePageContent from '../components/HomePageContent'
import {supabase} from '../lib/supabase'
import {withDefaultCatalogue, type HomeProduct, type HomeDownload} from '../lib/homepage-sections'

export const dynamic='force-dynamic'

export async function generateMetadata():Promise<Metadata>{
  const {data}=await supabase.from('cms_settings').select('value').eq('key','seo').abortSignal(AbortSignal.timeout(6000)).maybeSingle()
  const seo:any=data?.value||{}
  const title=seo.home_title||'New India Solar | ACDB, DCDB & Solar BOS Components'
  const description=seo.home_description||'Buy ACDB, DCDB and solar BOS components, configure custom distribution boxes, and submit project RFQs for EPC and installer requirements across India.'
  return {title,description,alternates:{canonical:'/'},openGraph:{title:seo.og_title||title,description:seo.og_description||description,type:'website'}}
}

export default async function Home(){
  const [products, downloads] = await Promise.all([
    supabase.from('products').select('id,name,slug,short_description,featured,gst_rate,product_images(image_url,alt_text,sort_order),product_variants(selling_price,stock_qty,sku)').eq('status','active').order('featured',{ascending:false}).order('sort_order').limit(4).abortSignal(AbortSignal.timeout(6000)),
    supabase.from('cms_downloads').select('id,title,description,file_url,category').eq('is_active',true).order('sort_order').limit(12).abortSignal(AbortSignal.timeout(6000)),
  ])
  return <HomePageContent products={(products.data || []) as HomeProduct[]} downloads={withDefaultCatalogue((downloads.data || []) as HomeDownload[])} productsUnavailable={!!products.error}/>
}

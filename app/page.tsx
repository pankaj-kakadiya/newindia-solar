import type {Metadata} from 'next'
import HomePageContent from '../components/HomePageContent'
import {supabase} from '../lib/supabase'

export const dynamic='force-dynamic'

export async function generateMetadata():Promise<Metadata>{
  const {data}=await supabase.from('cms_settings').select('value').eq('key','seo').maybeSingle()
  const seo:any=data?.value||{}
  const title=seo.home_title||'New India Solar | ACDB, DCDB & Solar BOS Components'
  const description=seo.home_description||'Buy ACDB, DCDB and solar BOS components, configure custom distribution boxes, and submit project RFQs for EPC and installer requirements across India.'
  return {title,description,alternates:{canonical:'/'},openGraph:{title:seo.og_title||title,description:seo.og_description||description,type:'website'}}
}

export default function Home(){return <HomePageContent/>}

import CatalogueDownload from '../../components/CatalogueDownload'
import {STOREFRONT_CATALOGUES} from '../../lib/pdf-catalogues'
import '../catalogues.css'
import type {Metadata} from 'next'
import {Download,FileText} from 'lucide-react'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
import {supabase} from '../../lib/supabase'
import {isRetiredCatalogue} from '../../lib/homepage-sections'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Catalogues & Downloads | New India Solar',description:'Download the full New India Solar catalogue for ACDB + DCDB combos, ACDB boxes and DCDB boxes, with photos, specifications and prices.',alternates:{canonical:'/downloads'}}

const BLURB:Record<string,string>={
 'acdb-dcdb-combo':'Every matched ACDB + DCDB set for 1–6 kW single phase rooftop solar.',
 acdb:'Every single phase ACDB box for 1–6 kW rooftop solar.',
 dcdb:'Every DCDB box for 1–6 kW rooftop solar.',
}

export default async function DownloadsPage(){
 const {data}=await supabase.from('cms_downloads').select('*').eq('is_active',true).order('sort_order').order('created_at',{ascending:false}).abortSignal(AbortSignal.timeout(6000))
 const rows=(data||[]).filter((d:any)=>!isRetiredCatalogue(d)&&!/catalogue|catalog/i.test(`${d.category||''} ${d.title||''}`))
 return <><StoreHeader/><main className="cmsPublicPage"><div className="container">
  <div className="cmsPublicHead"><span>RESOURCE LIBRARY</span><h1>Catalogues</h1><p>Full product catalogues with photos, specifications and prices. Tap any product in the PDF to open it online.</p></div>
  <section className="catPublic" id="catalogues" aria-label="Product catalogues"><div className="catGrid">{STOREFRONT_CATALOGUES.map(c=><article className="catCard" key={c.id}><small>FULL CATALOGUE</small><h3>{c.title}</h3><p>{BLURB[c.storefront||'']||''}</p><CatalogueDownload catalogue={c}/></article>)}</div></section>
  {rows.length>0&&<><h2>Documents & resources</h2><div className="cmsDownloadGrid">{rows.map((d:any)=><article key={d.id}><div className="cmsDownloadIcon"><FileText/></div><div><small>{d.category||d.file_type||'DOCUMENT'}</small><h2>{d.title}</h2>{d.description&&<p>{d.description}</p>}<a href={d.file_url} target="_blank" rel="noreferrer">Download <Download size={16}/></a></div></article>)}</div></>}
 </div></main><StoreFooter/></>
}

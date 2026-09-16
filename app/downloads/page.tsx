import type {Metadata} from 'next'
import {Download,FileText} from 'lucide-react'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
import {supabase} from '../../lib/supabase'
import {withDefaultCatalogue} from '../../lib/homepage-sections'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Downloads | New India Solar',description:'Download New India Solar catalogues, datasheets, technical documents and project resources.'}
export default async function DownloadsPage(){const {data}=await supabase.from('cms_downloads').select('*').eq('is_active',true).order('sort_order').order('created_at',{ascending:false}).abortSignal(AbortSignal.timeout(6000));const rows=withDefaultCatalogue(data||[]);return <><StoreHeader/><main className="cmsPublicPage"><div className="container"><div className="cmsPublicHead"><span>RESOURCE LIBRARY</span><h1>Downloads</h1><p>Catalogues, technical documents, datasheets and project resources published by New India Solar.</p></div><div className="cmsDownloadGrid">{rows.length?rows.map((d:any)=><article key={d.id}><div className="cmsDownloadIcon"><FileText/></div><div><small>{d.category||d.file_type||'DOCUMENT'}</small><h2>{d.title}</h2>{d.description&&<p>{d.description}</p>}<a href={d.file_url} target="_blank" rel="noreferrer">Download <Download size={16}/></a></div></article>):<div className="cmsPublicEmpty">No downloads are published yet.</div>}</div></div></main><StoreFooter/></>}

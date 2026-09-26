import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import DOMPurify from 'isomorphic-dompurify'
import StoreHeader from '../../../components/StoreHeader'
import StoreFooter from '../../../components/StoreFooter'
import {supabase} from '../../../lib/supabase'

export const dynamic='force-dynamic'
async function getPage(slug:string){const {data}=await supabase.from('cms_pages').select('*').eq('slug',slug).eq('status','published').maybeSingle();return data}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const p=await getPage(slug);if(!p)return{};return{title:p.seo_title||`${p.title} | New India Solar`,description:p.seo_description||p.excerpt||undefined,alternates:{canonical:`/pages/${slug}`}}}
export default async function CmsPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const p=await getPage(slug);if(!p)notFound();const safeHtml=DOMPurify.sanitize(p.body_html||'',{USE_PROFILES:{html:true}});return <><StoreHeader/><main className="cmsPublicPage"><div className="container"><div className="cmsPublicHead"><span>NEW INDIA SOLAR</span><h1>{p.title}</h1>{p.excerpt&&<p>{p.excerpt}</p>}</div><article className="cmsPublicBody" dangerouslySetInnerHTML={{__html:safeHtml}}/></div></main><StoreFooter/></>}

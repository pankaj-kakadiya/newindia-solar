import type {MetadataRoute} from 'next'
import {supabase} from '../lib/supabase'
import {CATEGORY_PAGES} from '../lib/category-pages'

export const dynamic = 'force-dynamic'
const SITE = 'https://newindiasolar.com'
const POLICY_SLUGS = ['privacy', 'terms', 'shipping', 'returns', 'warranty']

const STATIC_PATHS = [
  '', '/shop', '/categories', '/combo', '/customize/acdb', '/customize/dcdb',
  '/bulk-order', '/contact', '/why-new-india', '/login',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(path => ({
    url: `${SITE}${path}`,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }))

  for (const {slug} of CATEGORY_PAGES)
    entries.push({url: `${SITE}/categories/${slug}`, changeFrequency: 'weekly', priority: 0.6})
  for (const slug of POLICY_SLUGS)
    entries.push({url: `${SITE}/policies/${slug}`, changeFrequency: 'yearly', priority: 0.3})

  try {
    const {data: products} = await supabase
      .from('products')
      .select('slug')
      .eq('status', 'active')
      .abortSignal(AbortSignal.timeout(8000))
    for (const p of (products || []) as {slug: string}[])
      entries.push({url: `${SITE}/product/${encodeURIComponent(p.slug)}`, changeFrequency: 'weekly', priority: 0.8})
  } catch {
    // Catalogue unreachable: still return the static/category entries above rather than fail the whole sitemap.
  }

  try {
    const {data: pages} = await supabase
      .from('cms_pages')
      .select('slug')
      .eq('status', 'published')
      .abortSignal(AbortSignal.timeout(8000))
    for (const p of (pages || []) as {slug: string}[])
      entries.push({url: `${SITE}/pages/${encodeURIComponent(p.slug)}`, changeFrequency: 'monthly', priority: 0.4})
  } catch {}

  return entries
}

import type {MetadataRoute} from 'next'
import {CATEGORY_SLUGS} from '../lib/category-pages'
import {SITE_URL, productUrl, sortedImages, storefrontProducts} from '../lib/seo'

export const revalidate = 3600

const STATIC_PAGES: {path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly'}[] = [
  {path: '/', priority: 1, changeFrequency: 'daily'},
  {path: '/shop', priority: 0.9, changeFrequency: 'daily'},
  {path: '/categories', priority: 0.8, changeFrequency: 'weekly'},
  {path: '/bulk-order', priority: 0.7, changeFrequency: 'monthly'},
  {path: '/downloads', priority: 0.6, changeFrequency: 'weekly'},
  {path: '/why-new-india', priority: 0.5, changeFrequency: 'monthly'},
  {path: '/contact', priority: 0.5, changeFrequency: 'monthly'},
  {path: '/policies/shipping', priority: 0.3, changeFrequency: 'yearly'},
  {path: '/policies/returns', priority: 0.3, changeFrequency: 'yearly'},
  {path: '/policies/warranty', priority: 0.3, changeFrequency: 'yearly'},
  {path: '/policies/privacy', priority: 0.2, changeFrequency: 'yearly'},
  {path: '/policies/terms', priority: 0.2, changeFrequency: 'yearly'},
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const pages: MetadataRoute.Sitemap = [
    ...STATIC_PAGES.map(page => ({url: `${SITE_URL}${page.path === '/' ? '' : page.path}`, lastModified: now, changeFrequency: page.changeFrequency, priority: page.priority})),
    ...CATEGORY_SLUGS.map(slug => ({url: `${SITE_URL}/categories/${slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9})),
  ]
  try {
    const products = await storefrontProducts(3600)
    for (const product of products) {
      pages.push({
        url: productUrl(product.slug),
        lastModified: product.updated_at ? new Date(product.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.8,
        images: sortedImages(product).slice(0, 5),
      })
    }
  } catch {
    // If the catalogue is briefly unreachable, still publish the core pages.
  }
  return pages
}

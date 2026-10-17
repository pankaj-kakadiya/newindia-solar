import {COMPANY} from './company'
import {COMBO_SLUG_PREFIX} from './category-pages'
import {isStorefrontProduct} from './storefront-scope'

export const SITE_URL = 'https://newindiasolar.com'
export const SITE_NAME = 'New India Solar'
export const DEFAULT_DESCRIPTION = 'Buy ready-wired solar ACDB, DCDB and matched ACDB + DCDB combo boxes for 1–6 kW single phase rooftop solar. GST invoice, pan-India delivery and bulk pricing for EPCs, dealers and installers.'
export const LOGO_URL = `${SITE_URL}/new-india-solar-full-logo.webp`

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cdtbwuagqxkknkccpkcr.supabase.co'
// Public catalogue key, matching lib/supabase.ts. Never use a service-role key here.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_M81dfHhhhIn5jIUkSlDNVg_ml07slT-'

/** Read a public (RLS-protected) table through the REST API with Next.js caching. */
export async function readPublic<T>(table: string, params: Record<string, string>, revalidate = 900): Promise<T[]> {
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, {headers: {apikey: PUBLIC_KEY}, next: {revalidate}, signal: AbortSignal.timeout(10000)})
  if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`)
  const rows = await response.json()
  return Array.isArray(rows) ? rows as T[] : []
}

export type FeedProduct = {
  id: string; name: string; slug: string; short_description: string | null; description: string | null
  updated_at: string | null; gst_rate: number | null
  categories: {name: string | null; slug: string | null; is_active?: boolean | null} | null
  brands: {name: string | null; is_active?: boolean | null} | null
  product_images: {image_url: string; alt_text: string | null; sort_order: number | null}[] | null
  product_variants: {id: string; sku: string | null; selling_price: number | string | null; mrp?: number | string | null; stock_qty: number | string | null; is_active: boolean | null}[] | null
}

const FEED_SELECT = 'id,name,slug,short_description,description,updated_at,gst_rate,categories(name,slug,is_active),brands(name,is_active),product_images(image_url,alt_text,sort_order),product_variants(id,sku,selling_price,mrp,stock_qty,is_active)'

/** All active storefront products (ACDB, DCDB and combos). */
export async function storefrontProducts(revalidate = 900): Promise<FeedProduct[]> {
  const rows = await readPublic<FeedProduct>('products', {select: FEED_SELECT, status: 'eq.active', order: 'sort_order.asc', limit: '1000'}, revalidate)
  return rows.filter(row => row.slug && row.categories?.is_active !== false && isStorefrontProduct(row))
}

export function productUrl(slug: string) {
  return `${SITE_URL}/product/${encodeURIComponent(slug)}`
}

export function productCategory(product: {slug?: string | null; categories?: {name?: string | null; slug?: string | null} | null}) {
  const slug = String(product.slug || '').toLowerCase()
  if (slug.startsWith(COMBO_SLUG_PREFIX)) return {label: 'ACDB + DCDB Combo', path: '/categories/acdb-dcdb-combo'}
  const category = `${product.categories?.name || ''} ${product.categories?.slug || ''}`.toLowerCase()
  if (category.includes('acdb')) return {label: 'ACDB', path: '/categories/acdb'}
  if (category.includes('dcdb')) return {label: 'DCDB', path: '/categories/dcdb'}
  return {label: 'Solar Component', path: '/shop'}
}

export function safeHttpsUrl(value?: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value, SITE_URL)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {return null}
}

export function sortedImages(product: Pick<FeedProduct, 'product_images'>) {
  return [...(product.product_images || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(image => safeHttpsUrl(image.image_url)).filter((url): url is string => !!url)
}

/** GST-inclusive price in rupees, rounded to paise (matches the product page). */
export function priceWithGst(base: number, gstRate = 18) {
  const paise = Math.round((base + Number.EPSILON) * 100)
  return (paise + Math.round(paise * gstRate / 100)) / 100
}

export function activeVariants(product: Pick<FeedProduct, 'product_variants'>) {
  return (product.product_variants || []).filter(variant => variant.is_active !== false && Number(variant.selling_price) > 0)
}

export function plainText(value?: string | null, max = 5000) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: COMPANY.legalName,
    alternateName: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    taxID: COMPANY.gstin,
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${COMPANY.addressLine1}, ${COMPANY.addressLine2}`,
      addressLocality: COMPANY.city,
      addressRegion: COMPANY.state,
      postalCode: COMPANY.postalCode,
      addressCountry: 'IN',
    },
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: {'@id': `${SITE_URL}/#organization`},
    potentialAction: {
      '@type': 'SearchAction',
      target: {'@type': 'EntryPoint', urlTemplate: `${SITE_URL}/shop?q={search_term_string}`},
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbJsonLd(items: {name: string; url: string}[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({'@type': 'ListItem', position: index + 1, name: item.name, item: item.url})),
  }
}

/** Serialise JSON-LD safely for a <script> tag (no closing-tag injection). */
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

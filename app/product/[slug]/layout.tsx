import type {Metadata} from 'next'
import type {ReactNode} from 'react'
import {cache} from 'react'
import {SITE_NAME, SITE_URL, activeVariants, breadcrumbJsonLd, jsonLdString, plainText, priceWithGst, productCategory, productUrl, readPublic, sortedImages} from '../../../lib/seo'

export const dynamic = 'force-dynamic'

type PageProps = {params: Promise<{slug: string}>}
type ProductSEO = {
  id: string; name: string; slug: string; seo_title: string | null; seo_description: string | null
  short_description: string | null; description: string | null; gst_rate: number | null; warranty_months: number | null
  categories: {name: string | null; slug: string | null} | null
  brands: {name: string | null; is_active: boolean | null} | null
  product_images: {image_url: string; alt_text: string | null; sort_order: number | null}[] | null
  product_variants: {id: string; sku: string | null; selling_price: number | string | null; mrp: number | string | null; stock_qty: number | string | null; is_active: boolean | null}[] | null
}

const SELECT = 'id,name,slug,seo_title,seo_description,short_description,description,gst_rate,warranty_months,categories(name,slug),brands(name,is_active),product_images(image_url,alt_text,sort_order),product_variants(id,sku,selling_price,mrp,stock_qty,is_active)'

const loadProduct = cache(async (slug: string): Promise<ProductSEO | null> => {
  if (!slug || slug.length > 200) return null
  try {
    const rows = await readPublic<ProductSEO>('products', {select: SELECT, slug: `eq.${slug}`, status: 'eq.active', limit: '1'}, 300)
    const product = rows[0]
    return product && product.name && product.slug === slug ? product : null
  } catch {return null}
})

/** Readable title: keeps the admin SEO title but avoids an all-caps search result. */
function titleFor(product: ProductSEO) {
  const custom = product.seo_title?.trim()
  if (custom && custom !== custom.toUpperCase()) return custom
  const name = product.name.trim()
  return `${name.length > 70 ? `${name.slice(0, 67).trimEnd()}…` : name} | ${SITE_NAME}`
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {slug} = await params
  const product = await loadProduct(slug)
  // An unavailable catalogue must not publish a made-up product or index a hold/draft.
  if (!product) return {title: 'Product unavailable | New India Solar', robots: {index: false, follow: false}}
  const title = titleFor(product)
  const description = plainText(product.seo_description || product.short_description || product.name, 300)
  const canonical = productUrl(product.slug)
  const image = sortedImages(product)[0]
  const images = image ? [{url: image, alt: product.name}] : []
  return {
    metadataBase: new URL(SITE_URL), title: {absolute: title}, description,
    alternates: {canonical}, robots: {index: true, follow: true},
    openGraph: {type: 'website', siteName: SITE_NAME, locale: 'en_IN', title, description, url: canonical, images},
    twitter: {card: images.length ? 'summary_large_image' : 'summary', title, description, images: images.map(i => i.url)},
  }
}

function productJsonLd(product: ProductSEO) {
  const gst = Number(product.gst_rate ?? 18)
  const variants = activeVariants(product)
  const url = productUrl(product.slug)
  const category = productCategory(product)
  const validUntil = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)
  const offers = variants.map(variant => ({
    '@type': 'Offer',
    sku: variant.sku || undefined,
    url,
    priceCurrency: 'INR',
    price: priceWithGst(Number(variant.selling_price), gst).toFixed(2),
    priceValidUntil: validUntil,
    availability: Number(variant.stock_qty) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: {'@id': `${SITE_URL}/#organization`},
  }))
  const brand = product.brands?.is_active !== false && product.brands?.name ? product.brands.name : SITE_NAME
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    description: plainText(product.description || product.short_description || product.name, 5000),
    image: sortedImages(product).slice(0, 6),
    sku: variants[0]?.sku || undefined,
    mpn: variants[0]?.sku || undefined,
    category: `Solar Components > ${category.label}`,
    brand: {'@type': 'Brand', name: brand},
    url,
    ...(offers.length === 1 ? {offers: offers[0]} : offers.length > 1 ? {offers: {'@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: Math.min(...offers.map(o => Number(o.price))).toFixed(2), highPrice: Math.max(...offers.map(o => Number(o.price))).toFixed(2), offerCount: offers.length, offers}} : {}),
  }
}

export default async function ProductLayout({children, params}: {children: ReactNode; params: Promise<{slug: string}>}) {
  const {slug} = await params
  const product = await loadProduct(slug)
  if (!product) return children
  const category = productCategory(product)
  const breadcrumbs = breadcrumbJsonLd([
    {name: 'Home', url: SITE_URL},
    {name: 'Categories', url: `${SITE_URL}/categories`},
    {name: category.label, url: `${SITE_URL}${category.path}`},
    {name: product.name, url: productUrl(product.slug)},
  ])
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLdString(productJsonLd(product))}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLdString(breadcrumbs)}}/>
    {children}
  </>
}

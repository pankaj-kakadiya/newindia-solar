import type {Metadata} from 'next'
import type {ReactNode} from 'react'

export const dynamic = 'force-dynamic'
const SITE = 'https://newindiasolar.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cdtbwuagqxkknkccpkcr.supabase.co'
// Public catalogue key, matching lib/supabase.ts. Never use a service-role key here.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_M81dfHhhhIn5jIUkSlDNVg_ml07slT-'

type PageProps = {params: Promise<{slug: string}>}
type ProductSEO = {
  name: string; slug: string; seo_title: string | null;
  seo_description: string | null; short_description: string | null;
  product_images: {image_url: string; alt_text: string | null; sort_order: number | null}[];
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {slug} = await params
  const unavailable: Metadata = {
    title: 'Product unavailable | New India Solar',
    robots: {index: false, follow: false},
  }
  if (!slug || slug.length > 200) return unavailable
  try {
    const url = new URL('/rest/v1/products', SUPABASE_URL)
    url.searchParams.set('select', 'name,slug,seo_title,seo_description,short_description,product_images(image_url,alt_text,sort_order)')
    url.searchParams.set('slug', `eq.${slug}`)
    url.searchParams.set('status', 'eq.active')
    url.searchParams.set('limit', '1')
    const response = await fetch(url, {
      headers: {apikey: PUBLIC_KEY}, cache: 'no-store', signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return unavailable
    const rows: ProductSEO[] = await response.json()
    const p = Array.isArray(rows) ? rows[0] : null
    if (!p || !p.name || p.slug !== slug) return unavailable
    const title = p.seo_title?.trim() || `${p.name} | New India Solar`
    const description = p.seo_description?.trim() || p.short_description?.trim() || p.name
    const canonical = `${SITE}/product/${encodeURIComponent(p.slug)}`
    const image = [...(p.product_images || [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .find(i => {
        try {const u = new URL(i.image_url, SITE); return u.protocol === 'https:' && !u.username && !u.password} catch {return false}
      })
    const images = image ? [{url: new URL(image.image_url, SITE).href, alt: image.alt_text || p.name}] : []
    return {
      metadataBase: new URL(SITE), title: {absolute: title}, description,
      alternates: {canonical}, robots: {index: true, follow: true},
      openGraph: {type: 'website', siteName: 'New India Solar', title, description, url: canonical, images},
      twitter: {card: images.length ? 'summary_large_image' : 'summary', title, description, images: images.map(i => i.url)},
    }
  } catch {
    // An unavailable catalogue must not publish a made-up product or index a hold/draft.
    return unavailable
  }
}

export default function ProductLayout({children}: {children: ReactNode}) {
  return children
}

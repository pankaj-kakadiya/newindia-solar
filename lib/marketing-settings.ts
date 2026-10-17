import {readPublic} from './seo'

export type MarketingSettings = {
  ga4Id: string | null
  googleAdsId: string | null
  metaPixelId: string | null
  googleVerification: string | null
  bingVerification: string | null
  metaDomainVerification: string | null
}

// Strict formats: these values end up inside <script> and <meta> tags.
const GA4 = /^G-[A-Z0-9]{4,20}$/
const ADS = /^AW-\d{6,15}$/
const PIXEL = /^\d{8,20}$/
const TOKEN = /^[A-Za-z0-9_\-]{8,120}$/

const pick = (value: unknown, pattern: RegExp) => {
  const text = typeof value === 'string' ? value.trim() : ''
  return pattern.test(text) ? text : null
}

/** Read Google/Meta IDs from Admin → Content → SEO, falling back to env vars. */
export async function marketingSettings(): Promise<MarketingSettings> {
  let seo: Record<string, unknown> = {}
  try {
    const rows = await readPublic<{value: Record<string, unknown> | null}>('cms_settings', {select: 'value', key: 'eq.seo', limit: '1'}, 300)
    seo = rows[0]?.value || {}
  } catch {/* fall back to environment values */}
  return {
    ga4Id: pick(seo.ga4_id, GA4) || pick(process.env.NEXT_PUBLIC_GA4_ID, GA4),
    googleAdsId: pick(seo.google_ads_id, ADS) || pick(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, ADS),
    metaPixelId: pick(seo.meta_pixel_id, PIXEL) || pick(process.env.NEXT_PUBLIC_META_PIXEL_ID, PIXEL),
    googleVerification: pick(seo.google_site_verification, TOKEN) || pick(process.env.GOOGLE_SITE_VERIFICATION, TOKEN),
    bingVerification: pick(seo.bing_site_verification, TOKEN) || pick(process.env.BING_SITE_VERIFICATION, TOKEN),
    metaDomainVerification: pick(seo.meta_domain_verification, TOKEN) || pick(process.env.META_DOMAIN_VERIFICATION, TOKEN),
  }
}

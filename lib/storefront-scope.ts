import {CATEGORY_SLUGS, COMBO_SLUG_PREFIX} from './category-pages'

// The buyer storefront sells only ACDB boxes, DCDB boxes and ACDB + DCDB combos.
// Anything outside that range (loose switchgear, cable, builders) is kept out of
// buyer navigation, search and catalogue listings.

const normalize = (value?: string | null) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

type ScopedProduct = {slug?: string | null; categories?: {name?: string | null; slug?: string | null} | null}

export function isStorefrontProduct(product: ScopedProduct): boolean {
  if ((product.slug || '').toLowerCase().startsWith(COMBO_SLUG_PREFIX)) return true
  const name = normalize(product.categories?.name), slug = normalize(product.categories?.slug)
  return [name, slug].some(value => value.includes('acdb') || value.includes('dcdb'))
}

export function isStorefrontCategory(category: {name?: string | null; slug?: string | null}): boolean {
  const name = normalize(category.name), slug = normalize(category.slug)
  return [name, slug].some(value => value.includes('acdb') || value.includes('dcdb'))
}

const ALLOWED_CATEGORY_PATHS = new Set(CATEGORY_SLUGS.map(slug => `/categories/${slug}`))

/** True for links that point at removed builders or retired categories. */
export function isRetiredHref(href?: string | null): boolean {
  const path = String(href || '').trim().toLowerCase().split(/[?#]/)[0].replace(/\/$/, '')
  if (!path.startsWith('/')) return false
  if (path === '/combo' || path === '/customize' || path.startsWith('/customize/')) return true
  if (path.startsWith('/categories/')) return !ALLOWED_CATEGORY_PATHS.has(path)
  return false
}

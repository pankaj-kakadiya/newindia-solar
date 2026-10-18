export const homeSectionOrder = ['trust', 'collections', 'products', 'builder', 'buyways', 'project', 'why', 'downloads', 'final']

// Keep the editor's ordering, adding new Step 26 modules beside their older anchors.
export function normalizeHomeSections(value: unknown): string[] {
  if (!Array.isArray(value)) return [...homeSectionOrder]
  const order = [...new Set(value.filter((key): key is string => typeof key === 'string' && homeSectionOrder.includes(key)))]
  for (const [key, anchor] of [['products', 'collections'], ['project', 'buyways'], ['downloads', 'why']]) {
    if (order.includes(key)) continue
    const index = order.indexOf(anchor)
    order.splice(index < 0 ? Math.max(0, order.indexOf('final')) : index + 1, 0, key)
  }
  return order
}

export type HomeProduct = {
  id: string; name: string; slug: string; short_description: string | null; featured: boolean;
  gst_rate: number | null;
  product_images: { image_url: string; alt_text: string | null; sort_order: number }[];
  product_variants: { selling_price: number | null; stock_qty: number | null; sku: string }[];
}
export type HomeDownload = { id: string; title: string; description: string | null; file_url: string; category: string | null }

// Full catalogue for each storefront category, generated on the Downloads page from live products.
export const categoryCatalogueLinks: HomeDownload[] = [
  {id: 'full-acdb-dcdb-combo', title: 'ACDB + DCDB Combo Catalogue', description: 'All matched 1–6 kW ACDB + DCDB sets', file_url: '/downloads#catalogues', category: 'Full catalogue'},
  {id: 'full-acdb', title: 'ACDB Catalogue', description: 'All single phase ACDB boxes', file_url: '/downloads#catalogues', category: 'Full catalogue'},
  {id: 'full-dcdb', title: 'DCDB Catalogue', description: 'All DCDB boxes', file_url: '/downloads#catalogues', category: 'Full catalogue'},
]

/** Category catalogues first, then any other published documents (no bundled demo PDF). */
export function withCategoryCatalogues<T extends HomeDownload>(downloads: T[]): (T | HomeDownload)[] {
  return [...categoryCatalogueLinks, ...downloads.filter(file => !isRetiredCatalogue(file))]
}

/** The old 26-page demo catalogue (switchgear and BOS) is no longer offered. */
export function isRetiredCatalogue(file: {title?: string | null; file_url?: string | null}) {
  return /new-india-solar-product-catalogue\.pdf/i.test(String(file.file_url || '')) || /^new india solar product catalogue$/i.test(String(file.title || '').trim())
}

export function publicAssetUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) return value
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined } catch { return undefined }
}

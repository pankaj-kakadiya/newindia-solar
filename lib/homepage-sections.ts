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

export const bundledCatalogue: HomeDownload = {
  id: 'new-india-solar-product-catalogue',
  title: 'New India Solar Product Catalogue',
  description: '26-page product catalogue: ACDB, DCDB, switchgear and solar BOS components.',
  file_url: '/downloads/new-india-solar-product-catalogue.pdf',
  category: 'Catalogue',
}

export function withDefaultCatalogue<T extends HomeDownload>(downloads: T[]): (T | HomeDownload)[] {
  return downloads.some(file => /catalogue|catalog/i.test(`${file.category} ${file.title}`) && publicAssetUrl(file.file_url))
    ? downloads : [bundledCatalogue, ...downloads]
}

export function publicAssetUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) return value
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined } catch { return undefined }
}

/** Step 27: public catalogue calculations. No costs, guessed ratings or tax defaults. */
export type Category = {id: string; parent_id: string | null; name: string; slug: string; is_active: boolean}
export type Variant = {id: string; sku: string; title: string; selling_price: number | string | null; stock_qty: number | string | null; unit: string | null; is_active: boolean; attributes: unknown}
export type Product = {
  id: string; name: string; slug: string; status: string; category_id: string | null;
  product_type: string; short_description: string | null; featured: boolean;
  gst_rate: number | string | null; min_order_qty: number | string | null; sort_order: number | null;
  specifications: unknown; datasheet_url: string | null;
  categories: {name: string; slug: string; is_active: boolean} | null;
  brands: {name: string; slug: string; is_active: boolean} | null;
  product_images: {image_url: string; alt_text: string | null; sort_order: number | null}[];
  product_variants: Variant[];
}
export const SORTS = ['featured', 'low', 'high', 'name', 'stock'] as const
export type Sort = typeof SORTS[number]
export type Filters = {q: string; category: string; brand: string; stock: boolean; min: string; max: string; sort: Sort; page: number; view: 'grid' | 'list'; specs: Record<string, string>}
export const PAGE_SIZE = 12
export const EMPTY_FILTERS: Filters = {q: '', category: '', brand: '', stock: false, min: '', max: '', sort: 'featured', page: 1, view: 'grid', specs: {}}
const attrDefinitions: Record<string, {label: string; aliases: string[]}> = {
  voltage: {label: 'Operating / rated voltage', aliases: ['voltage', 'ratedvoltage', 'systemvoltage', 'maxvoltage', 'maximumdcvoltage', 'operatingvoltage', 'ratedvoltageuc', 'operatingvoltageuc', 'continuousoperatingvoltageuc', 'maximumcontinuousoperatingvoltageuc']},
  current: {label: 'Current rating', aliases: ['current', 'ratedcurrent', 'currentrating', 'mcbrating', 'amperage', 'amps']},
  phase: {label: 'Phase', aliases: ['phase', 'phasetype']},
  poles: {label: 'Poles', aliases: ['poles', 'pole', 'polecount', 'numberofpoles', 'poleconfiguration']},
  power: {label: 'System capacity', aliases: ['power', 'capacity', 'systemrating', 'systemcapacity', 'powerrating', 'kw']},
  strings: {label: 'Strings / input-output', aliases: ['strings', 'stringcount', 'numberofstrings', 'inputoutput']},
  spd: {label: 'SPD type', aliases: ['spdtype', 'surgeprotectiontype']},
  ip: {label: 'IP rating', aliases: ['ip', 'iprating', 'ingressprotection', 'enclosureprotection']},
  configuration: {label: 'Configuration', aliases: ['configuration']},
  device: {label: 'Device type', aliases: ['devicetype']},
  protection: {label: 'Protection class', aliases: ['protectionclass']},
  curve: {label: 'Tripping curve', aliases: ['trippingcurve', 'curve']},
  breaking: {label: 'Breaking capacity', aliases: ['breakingcapacity']},
  nominal: {label: 'Nominal discharge current', aliases: ['nominaldischargecurrent', 'nominaldischargecurrentin']},
  discharge: {label: 'Maximum discharge current', aliases: ['maximumdischargecurrent', 'maximumdischargecurrentimax']},
  size: {label: 'Cable size', aliases: ['cablesize', 'wiresize', 'crosssection', 'crosssectionalarea', 'sqmm']},
  color: {label: 'Colour', aliases: ['color', 'colour']},
  length: {label: 'Length', aliases: ['length', 'cablelength', 'lengthm', 'lengthmeters']},
  material: {label: 'Material', aliases: ['material', 'enclosurematerial', 'conductormaterial']},
}
const text = (value: unknown) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ')
const key = (value: unknown) => text(value).toLowerCase().replace(/[^a-z0-9]/g, '')
const equal = (a: string, b: string) => text(a).toLowerCase() === text(b).toLowerCase()
export function numeric(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const amountParam = (v: string | null) => v !== null && /^(?:\d+)(?:\.\d{1,2})?$/.test(v) && Number(v) <= 1e12 ? v : ''
export function readFilters(params: URLSearchParams): Filters {
  const specs: Record<string, string> = {}
  for (const name of Object.keys(attrDefinitions)) {
    const value = params.get(`spec.${name}`)
    if (value) specs[name] = text(value).slice(0, 120)
  }
  const sort = params.get('sort') || 'featured'
  const page = Number(params.get('page'))
  return {q: text(params.get('q')).slice(0, 160), category: text(params.get('category') || params.get('cat')).slice(0, 120), brand: text(params.get('brand')).slice(0, 120), stock: params.get('stock') === '1', min: amountParam(params.get('min')), max: amountParam(params.get('max')), sort: SORTS.includes(sort as Sort) ? sort as Sort : 'featured', page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1, view: params.get('view') === 'list' ? 'list' : 'grid', specs}
}
export function writeFilters(filters: Filters, previous = new URLSearchParams()): string {
  const params = new URLSearchParams(previous)
  for (const name of [...params.keys()]) if (['q', 'category', 'cat', 'brand', 'stock', 'min', 'max', 'sort', 'page', 'view'].includes(name) || name.startsWith('spec.')) params.delete(name)
  if (filters.q) params.set('q', filters.q)
  if (filters.category) params.set('category', filters.category)
  if (filters.brand) params.set('brand', filters.brand)
  if (filters.stock) params.set('stock', '1')
  if (filters.min) params.set('min', filters.min)
  if (filters.max) params.set('max', filters.max)
  if (filters.sort !== 'featured') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))
  if (filters.view === 'list') params.set('view', 'list')
  for (const [name, value] of Object.entries(filters.specs)) if (attrDefinitions[name] && value) params.set(`spec.${name}`, value)
  return params.toString()
}
export function minimumQuantity(p: Product): number {const n = numeric(p.min_order_qty); return n !== null && n > 0 ? n : 1}
export function activeVariants(p: Product): Variant[] {return (p.product_variants || []).filter(v => v.is_active === true)}
export function inStock(p: Product, v: Variant): boolean {return (numeric(v.stock_qty) ?? 0) >= minimumQuantity(p)}
export function priceFor(p: Product, v: Variant) {
  const base = numeric(v.selling_price), rate = numeric(p.gst_rate)
  if (base === null || base <= 0 || rate === null || rate < 0 || rate > 100) return null
  const basePaise = Math.round((base + Number.EPSILON) * 100)
  const taxPaise = Math.round(basePaise * rate / 100)
  return {base: basePaise / 100, tax: taxPaise / 100, total: (basePaise + taxPaise) / 100, rate}
}
export const money = (value: number) => new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value)
function scalar(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return text(value).slice(0, 120)
  return ''
}
export function attributesFor(p: Product, v: Variant | null): Record<string, string> {
  const result: Record<string, string> = {}
  for (const source of [p.specifications, v?.attributes]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const name = Object.keys(attrDefinitions).find(k => attrDefinitions[k].aliases.includes(key(rawKey)))
      const value = scalar(rawValue)
      if (name && value) result[name] = value
    }
  }
  return Object.fromEntries(Object.keys(attrDefinitions).filter(name => result[name]).map(name => [name, result[name]]))
}
export const attributeLabel = (name: string) => attrDefinitions[name]?.label || name
export function publishedProducts(products: Product[]): Product[] {
  return products.filter(p => p.status === 'active' && p.slug && p.categories?.is_active !== false)
}
export function categoryScope(categories: Category[], slug: string): Set<string> {
  const root = categories.find(c => c.is_active && c.slug === slug)
  const ids = new Set<string>(root ? [root.id] : [])
  let size = -1
  while (ids.size !== size) {
    size = ids.size
    for (const c of categories) if (c.is_active && c.parent_id && ids.has(c.parent_id)) ids.add(c.id)
  }
  return ids
}
export type VariantMatch = {variant: Variant | null; price: ReturnType<typeof priceFor>; attributes: Record<string, string>}
export type CatalogueResult = {product: Product; matches: VariantMatch[]; price: ReturnType<typeof priceFor>; available: boolean}
function searchMatches(p: Product, v: Variant | null, q: string): boolean {
  const specs = attributesFor(p, v)
  const rawValues = [p.specifications, v?.attributes].flatMap(source => source && typeof source === 'object' && !Array.isArray(source) ? Object.values(source).map(scalar) : [])
  const searchable = text([p.name, p.slug, p.short_description, p.categories?.name, p.brands?.is_active ? p.brands.name : '', v?.sku, v?.title, ...Object.values(specs), ...rawValues].join(' ')).toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(token => searchable.includes(token))
}
export function filterCatalogue(products: Product[], categories: Category[], filters: Filters): CatalogueResult[] {
  if (filters.min && filters.max && Number(filters.min) > Number(filters.max)) return []
  const scope = filters.category ? categoryScope(categories, filters.category) : null
  const results: CatalogueResult[] = []
  for (const p of publishedProducts(products)) {
    if (scope && (!p.category_id || !scope.has(p.category_id))) continue
    if (filters.brand && (!p.brands?.is_active || p.brands.slug !== filters.brand)) continue
    const variants: (Variant | null)[] = activeVariants(p)
    if (!variants.length) variants.push(null)
    const matches = variants.map(variant => ({variant, price: variant ? priceFor(p, variant) : null, attributes: attributesFor(p, variant)})).filter(row => {
      if (!searchMatches(p, row.variant, filters.q)) return false
      if (filters.stock && (!row.variant || !inStock(p, row.variant))) return false
      if (filters.min && (!row.price || row.price.total < Number(filters.min))) return false
      if (filters.max && (!row.price || row.price.total > Number(filters.max))) return false
      return Object.entries(filters.specs).every(([name, value]) => equal(row.attributes[name] || '', value))
    })
    if (!matches.length) continue
    const priced = matches.flatMap(m => m.price ? [m.price] : []).sort((a, b) => a.total - b.total)
    results.push({product: p, matches, price: priced[0] || null, available: matches.some(m => m.variant && inStock(p, m.variant))})
  }
  const tie = (a: CatalogueResult, b: CatalogueResult) => (a.product.sort_order ?? 0) - (b.product.sort_order ?? 0) || a.product.name.localeCompare(b.product.name, 'en-IN', {numeric: true}) || a.product.id.localeCompare(b.product.id)
  return results.sort((a, b) => {
    if (filters.sort === 'name') return a.product.name.localeCompare(b.product.name, 'en-IN', {numeric: true}) || tie(a, b)
    if (filters.sort === 'stock') return Number(b.available) - Number(a.available) || tie(a, b)
    if (filters.sort === 'low' || filters.sort === 'high') {
      // Quote-only products always follow priced products in both directions.
      if (!a.price || !b.price) return Number(!a.price) - Number(!b.price) || tie(a, b)
      return (filters.sort === 'low' ? a.price.total - b.price.total : b.price.total - a.price.total) || tie(a, b)
    }
    return Number(b.product.featured) - Number(a.product.featured) || tie(a, b)
  })
}
export type Facet = {key: string; label: string; values: string[]}
export function catalogueFacets(products: Product[], categories: Category[], filters: Filters): Facet[] {
  // Category/search context, without active technical/price filters: selections remain removable.
  const pool = filterCatalogue(products, categories, {...EMPTY_FILTERS, category: filters.category, q: filters.q})
  return Object.entries(attrDefinitions).map(([name, definition]) => {
    const values = new Map<string, string>()
    for (const row of pool) for (const match of row.matches) {
      const value = match.attributes[name]
      if (value) values.set(value.toLowerCase(), value)
    }
    if (filters.specs[name]) values.set(filters.specs[name].toLowerCase(), filters.specs[name])
    return {key: name, label: definition.label, values: [...values.values()].sort((a,b) => a.localeCompare(b, 'en-IN', {numeric: true}))}
  }).filter(f => f.values.length)
}
export function safeAssetUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\\\s\u0000-\u001f]/.test(value)) return undefined
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined} catch {return undefined}
}
export function productImage(p: Product) {
  return [...(p.product_images || [])].sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).find(image => safeAssetUrl(image.image_url))
}

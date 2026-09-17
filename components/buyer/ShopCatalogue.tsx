'use client'

import {FormEvent, useEffect, useId, useMemo, useRef, useState} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, LayoutGrid, List, LoaderCircle, Package, Search, ShoppingCart, SlidersHorizontal, X} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {useCart} from '../CartProvider'
import {BuyerAlert, BuyerBadge, BuyerButton, BuyerField, BuyerInput, BuyerSelect, BuyerSkeleton} from './BuyerUI'
import {activeVariants, attributeLabel, catalogueFacets, categoryScope, EMPTY_FILTERS, filterCatalogue, inStock, minimumQuantity, money, numeric, PAGE_SIZE, priceFor, productImage, publishedProducts, readFilters, safeAssetUrl, writeFilters} from '../../lib/catalogue'
import type {CatalogueResult, Category, Facet, Filters, Product} from '../../lib/catalogue'

// Explicit public projection: never request cost_price or internal inventory/finance fields.
const PRODUCT_SELECT = 'id,name,slug,status,category_id,product_type,short_description,featured,gst_rate,min_order_qty,sort_order,specifications,datasheet_url,categories(name,slug,is_active),brands(name,slug,is_active),product_images(image_url,alt_text,sort_order),product_variants(id,sku,title,selling_price,stock_qty,unit,is_active,attributes)'
const CATEGORY_SELECT = 'id,parent_id,name,slug,is_active'

async function readPublished(table: 'products' | 'categories', signal: AbortSignal): Promise<unknown[]> {
  const result: {id: string}[] = []
  let expected: number | null = null
  do {
    let query = supabase.from(table).select(table === 'products' ? PRODUCT_SELECT : CATEGORY_SELECT, {count: 'exact'})
    query = table === 'products' ? query.eq('status', 'active').eq('product_variants.is_active', true) : query.eq('is_active', true)
    const {data, count, error} = await query.order('sort_order').order('id').range(result.length, result.length + 199).abortSignal(signal)
    if (error) throw error
    if (signal.aborted) throw new Error('Catalogue request cancelled')
    if (count === null || (expected !== null && expected !== count)) throw new Error('Catalogue changed during loading. Please retry.')
    expected = count
    const rows = (data || []) as unknown as {id: string}[]
    if (!rows.length && result.length < expected) throw new Error('Incomplete catalogue response')
    result.push(...rows)
  } while (result.length < (expected ?? 0))
  if (new Set(result.map(row => row.id)).size !== result.length) throw new Error('Catalogue changed during loading. Please retry.')
  return result
}

type ChangeFilters = (patch: Partial<Filters>, resetPage?: boolean) => void
type CatalogueScope = {categoryTerms: string[]; label: string; path: string; description: string}

type FilterPanelProps = {
  filters: Filters; categories: Category[]; counts: Map<string, number>;
  brands: {name: string; slug: string}[]; facets: Facet[]; change: ChangeFilters; clear: () => void; hideCategories?: boolean
}
function FilterPanel({filters, categories, counts, brands, facets, change, clear, hideCategories=false}: FilterPanelProps) {
  const [min, setMin] = useState(filters.min), [max, setMax] = useState(filters.max)
  const [rangeError, setRangeError] = useState('')
  const id = useId()
  useEffect(() => {setMin(filters.min); setMax(filters.max); setRangeError('')}, [filters.min, filters.max])
  function applyPrice(e: FormEvent) {
    e.preventDefault()
    if (min && max && Number(min) > Number(max)) {setRangeError('Minimum price must not exceed maximum price.'); return}
    setRangeError(''); change({min, max})
  }
  return <div className="cvFilters">
    <div className="cvFilterHeading"><h2>Filter products</h2><button type="button" className="cvTextButton" onClick={clear}>Reset all</button></div>
    {!hideCategories&&<fieldset><legend>Category</legend>
      <label className="cvChoice"><input type="radio" name={`category-${id}`} checked={!filters.category} onChange={() => change({category: '', specs: {}})}/><span>All components</span><small>{counts.get('') ?? 0}</small></label>
      {categories.map(category => <label key={category.id} className={`cvChoice ${category.parent_id ? 'cvChildCategory' : ''}`}><input type="radio" name={`category-${id}`} checked={filters.category === category.slug} onChange={() => change({category: category.slug, specs: {}})}/><span>{category.name}</span><small>{counts.get(category.slug) ?? 0}</small></label>)}
      {filters.category && !categories.some(c => c.slug === filters.category) && <p className="cvSmall">This category is not currently published.</p>}
    </fieldset>}
    <fieldset><legend>Availability</legend><label className="cvChoice"><input type="checkbox" checked={filters.stock} onChange={e => change({stock: e.target.checked})}/><span>In stock for minimum order</span></label></fieldset>
    <fieldset><legend>Unit price · including GST</legend><form onSubmit={applyPrice}>
      <div className="cvPriceFields"><BuyerField label="Min ₹"><BuyerInput type="number" inputMode="decimal" min="0" max="1000000000000" step="0.01" value={min} placeholder="0" onChange={e => setMin(e.target.value)} error={!!rangeError}/></BuyerField><BuyerField label="Max ₹"><BuyerInput type="number" inputMode="decimal" min="0" max="1000000000000" step="0.01" value={max} placeholder="Any" onChange={e => setMax(e.target.value)} error={!!rangeError}/></BuyerField></div>
      {rangeError && <p className="cvRangeError" role="alert">{rangeError}</p>}
      <BuyerButton type="submit" variant="outline" block>Apply price range</BuyerButton>
      <p className="cvSmall">For one matching variant. Quote-only products are excluded when a price range is applied.</p>
    </form></fieldset>
    {brands.length > 0 && <fieldset><legend>Brand</legend><BuyerField label="Product brand"><BuyerSelect value={filters.brand} onChange={e => change({brand: e.target.value})}><option value="">All brands</option>{brands.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}{filters.brand && !brands.some(b => b.slug === filters.brand) && <option value={filters.brand}>{filters.brand} (unavailable)</option>}</BuyerSelect></BuyerField></fieldset>}
    <fieldset><legend>Technical specifications</legend>{facets.length ? <div className="cvSpecFilters">{facets.map(facet => <BuyerField label={facet.label} key={facet.key}><BuyerSelect value={filters.specs[facet.key] || ''} onChange={e => {const specs = {...filters.specs}; if (e.target.value) specs[facet.key] = e.target.value; else delete specs[facet.key]; change({specs})}}><option value="">Any {facet.label.toLowerCase()}</option>{facet.values.map(value => <option key={value} value={value}>{value}</option>)}</BuyerSelect></BuyerField>)}</div> : <p className="cvSmall">Technical filters appear when specifications are published for the selected products.</p>}</fieldset>
  </div>
}

function CatalogueImage({product}: {product: Product}) {
  const image = productImage(product), src = safeAssetUrl(image?.image_url)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return src && !failed ? <Image src={src} alt={image?.alt_text || product.name} fill unoptimized sizes="(max-width: 600px) 100vw, (max-width: 1023px) 50vw, 320px" onError={() => setFailed(true)}/> : <div className="cvImagePlaceholder"><Package size={40}/><span>Product image pending</span></div>
}

function ProductCard({result}: {result: CatalogueResult}) {
  const {product: p, matches, price, available} = result
  const {items, add} = useCart()
  const [adding, setAdding] = useState(false), [notice, setNotice] = useState(''), [failed, setFailed] = useState(false)
  const variants = activeVariants(p), single = variants.length === 1 ? variants[0] : null
  const href = `/product/${encodeURIComponent(p.slug)}`
  const moq = minimumQuantity(p)
  const quotedUnit = matches.find(m => m.price?.total === price?.total)?.variant?.unit || 'unit'
  const canAdd = !!single && p.product_type === 'standard' && !!price && available
  const specs = new Map<string, Set<string>>()
  for (const match of matches) for (const [name, value] of Object.entries(match.attributes)) {
    if (!specs.has(name)) specs.set(name, new Set())
    specs.get(name)!.add(value)
  }
  const datasheet = safeAssetUrl(p.datasheet_url)
  async function addVerified() {
    if (!single || adding) return
    setAdding(true); setNotice(''); setFailed(false)
    try {
      const {data, error} = await supabase.from('products').select(PRODUCT_SELECT).eq('id', p.id).eq('status', 'active').eq('product_variants.is_active', true).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
      if (error) throw new Error('Could not check the latest price and stock. Please try again.')
      const fresh = data as unknown as Product | null
      if (!fresh || !publishedProducts([fresh]).length || fresh.product_type !== 'standard') throw new Error('This product is no longer available for direct purchase.')
      const current = activeVariants(fresh)
      const variant = current.find(v => v.id === single.id)
      if (current.length !== 1 || !variant) throw new Error('Product options have changed. Open View product to select an option.')
      const latestPrice = priceFor(fresh, variant), qty = minimumQuantity(fresh)
      if (!latestPrice) throw new Error('Pricing needs confirmation. Please request a quotation.')
      const already = items.filter(i => i.productVariantId === variant.id).reduce((sum, i) => sum + i.qty, 0)
      if (!inStock(fresh, variant) || already + qty > (numeric(variant.stock_qty) ?? 0)) throw new Error('The available stock cannot cover this addition. Review your cart or enquire for supply.')
      const image = productImage(fresh)
      add({id: variant.id, kind: 'standard', productVariantId: variant.id, productSlug: fresh.slug, imageUrl: safeAssetUrl(image?.image_url) || undefined, imageAlt: image?.alt_text || fresh.name, name: fresh.name, variant: variant.title || variant.sku, price: latestPrice.base, qty})
      setNotice(`Added ${qty} ${variant.unit || 'unit'} to cart.${price && price.total !== latestPrice.total ? ' Price was updated; review your cart.' : ''}`)
    } catch (error) {setFailed(true); setNotice(error instanceof Error ? error.message : 'Unable to add this product. Please retry.')}
    finally {setAdding(false)}
  }
  return <article className="nisCard cvCard">
    <Link href={href} className="cvProductImage" prefetch={false}><CatalogueImage product={p}/>{p.featured && <span className="cvFeatured">Featured</span>}</Link>
    <div className="cvCardBody"><div className="cvCardEyebrow"><span>{p.categories?.name || 'Solar component'}</span>{p.brands?.is_active && <span>{p.brands.name}</span>}</div>
      <h2><Link href={href} prefetch={false}>{p.name}</Link></h2>
      {p.short_description && <p className="cvDescription">{p.short_description}</p>}
      <dl className="cvSpecs">{[...specs.entries()].slice(0, 4).map(([name, values]) => <div key={name}><dt>{attributeLabel(name)}</dt><dd>{[...values].slice(0, 2).join(' / ')}{values.size > 2 ? ` +${values.size - 2}` : ''}</dd></div>)}</dl>
      <p className="cvVariantLine">{variants.length > 1 ? `${variants.length} options · select on product page` : single ? `SKU: ${single.sku}` : 'Enquire for available options'}</p>
      <div className="cvPrice">{price ? <><span>{variants.length > 1 ? 'From' : 'Unit price'}</span><strong>{money(price.total)}<small> / {quotedUnit}</small></strong><span>Including {price.rate}% GST</span><small>Base {money(price.base)} + GST {money(price.tax)}</small></> : <><strong>Price on request</strong><span>Contact us for confirmed pricing and tax.</span></>}</div>
      <div className="cvAvailability"><BuyerBadge tone={available ? 'success' : 'warning'}>{available ? <><CheckCircle2 size={13}/>{variants.length > 1 ? 'Options in stock' : 'In stock'}</> : 'Supply on enquiry'}</BuyerBadge><span>Min. order: {moq}{single?.unit ? ` ${single.unit}` : ''}</span></div>
      <div className="cvCardActions"><Link href={href} className="nisBtn nisBtnOutline" prefetch={false}>View product <ArrowRight size={15}/></Link>{canAdd ? <BuyerButton onClick={addVerified} disabled={adding} aria-label={`Add ${p.name} to cart`}>{adding ? <LoaderCircle size={16} className="cvSpin"/> : <ShoppingCart size={16}/>} {adding ? 'Checking…' : 'Add to cart'}</BuyerButton> : variants.length > 1 && price ? <Link href={href} className="nisBtn nisBtnPrimary" prefetch={false}>Choose options</Link> : <Link className="nisBtn nisBtnPrimary" href="/bulk-order">Enquire</Link>}</div>
      <div className="cvCardLinks">{datasheet && <a href={datasheet} target="_blank" rel="noopener noreferrer"><Download size={14}/> Datasheet</a>}<Link href="/bulk-order">Bulk requirement <ArrowRight size={13}/></Link></div>
      {notice && <div className={`cvCardNotice ${failed ? 'error' : ''}`} role={failed ? 'alert' : 'status'}>{!failed && <Check size={14}/>}<span>{notice}{!failed && <> <Link href="/cart">View cart</Link></>}</span></div>}
    </div>
  </article>
}

export default function ShopCatalogue({scope}:{scope?:CatalogueScope}) {
  const router = useRouter(), searchParams = useSearchParams()
  const basePath = scope?.path || '/shop'
  const queryString = searchParams.toString()
  const filters = useMemo(() => readFilters(new URLSearchParams(queryString)), [queryString])
  const [products, setProducts] = useState<Product[]>([]), [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const [search, setSearch] = useState(filters.q)
  const dialog = useRef<HTMLDialogElement>(null), filterButton = useRef<HTMLButtonElement>(null), resultsHeading = useRef<HTMLDivElement>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const dialogId = useId()
  useEffect(() => setSearch(filters.q), [filters.q])
  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    const timer = setTimeout(() => controller.abort(), 30000)
    setLoading(true); setError('')
    Promise.all([readPublished('products', controller.signal), readPublished('categories', controller.signal)]).then(([p, c]) => {
      if (!disposed) {setProducts(publishedProducts(p as Product[])); setCategories(c as Category[]); setLoading(false)}
    }).catch(() => {if (!disposed) {setError('The catalogue could not be loaded completely. Please retry; your filters have been kept.'); setLoading(false)}}).finally(() => clearTimeout(timer))
    return () => {disposed = true; clearTimeout(timer); controller.abort()}
  }, [retry])
  const change: ChangeFilters = (patch, resetPage = true) => {
    const params = new URLSearchParams(window.location.search)
    const current = readFilters(params)
    const next = {...current, ...patch, page: resetPage ? 1 : patch.page ?? current.page}
    const query = writeFilters(next, params)
    window.history.pushState(null, '', `${basePath}${query ? `?${query}` : ''}`)
  }
  function clear() {change({...EMPTY_FILTERS, view: filters.view, specs: {}}); setSearch('')}
  const scopedProducts = useMemo(() => {if(!scope)return products;const terms=new Set(scope.categoryTerms.map(term=>term.toLowerCase().replace(/[^a-z0-9]/g,'')));return products.filter(product=>{const name=product.categories?.name.toLowerCase().replace(/[^a-z0-9]/g,'')||'',slug=product.categories?.slug.toLowerCase().replace(/[^a-z0-9]/g,'')||'';return terms.has(name)||terms.has(slug)})}, [products, scope])
  const results = useMemo(() => filterCatalogue(scopedProducts, categories, filters), [scopedProducts, categories, filters])
  const facets = useMemo(() => catalogueFacets(scopedProducts, categories, filters), [scopedProducts, categories, filters])
  const brands = useMemo(() => [...new Map(scopedProducts.filter(p => p.brands?.is_active).map(p => [p.brands!.slug, {slug: p.brands!.slug, name: p.brands!.name}])).values()].sort((a,b) => a.name.localeCompare(b.name)), [scopedProducts])
  const counts = useMemo(() => {
    const map = new Map<string, number>([['', products.length]])
    for (const c of categories) {const scope = categoryScope(categories, c.slug); map.set(c.slug, products.filter(p => p.category_id && scope.has(p.category_id)).length)}
    return map
  }, [products, categories])
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE)), page = Math.min(filters.page, pages)
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // Canonicalize out-of-range pages only after the complete catalogue has loaded.
  useEffect(() => {
    if (!loading && !error && filters.page !== page) {
      const query = writeFilters({...filters, page}, new URLSearchParams(queryString))
      router.replace(`${basePath}${query ? `?${query}` : ''}`, {scroll: false})
    }
  }, [loading, error, filters, page, queryString, router, basePath])
  useEffect(() => {
    if (!modalOpen) return
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const wide = window.matchMedia('(min-width: 1024px)')
    const closeOnWide = () => {if (wide.matches) dialog.current?.close()}
    wide.addEventListener('change', closeOnWide)
    return () => {document.body.style.overflow = old; wide.removeEventListener('change', closeOnWide)}
  }, [modalOpen])
  const chips: {label: string; remove: () => void}[] = []
  if (filters.q) chips.push({label: `Search: ${filters.q}`, remove: () => change({q: ''})})
  if (filters.category) chips.push({label: categories.find(c => c.slug === filters.category)?.name || filters.category, remove: () => change({category: '', specs: {}})})
  if (filters.brand) chips.push({label: brands.find(b => b.slug === filters.brand)?.name || filters.brand, remove: () => change({brand: ''})})
  if (filters.stock) chips.push({label: 'In stock', remove: () => change({stock: false})})
  if (filters.min || filters.max) chips.push({label: `${filters.min ? money(Number(filters.min)) : '₹0'} – ${filters.max ? money(Number(filters.max)) : 'Any price'}`, remove: () => change({min: '', max: ''})})
  for (const [name, value] of Object.entries(filters.specs)) chips.push({label: `${attributeLabel(name)}: ${value}`, remove: () => {const specs = {...filters.specs}; delete specs[name]; change({specs})}})
  const panelProps = {filters, categories, counts, brands, facets, change, clear, hideCategories:!!scope}
  const category = categories.find(c => c.slug === filters.category)
  function submitSearch(e: FormEvent) {e.preventDefault(); change({q: search.trim().slice(0,160)})}
  function goPage(next: number) {change({page: next}, false); resultsHeading.current?.scrollIntoView({block: 'start', behavior: 'auto'})}
  return <main id="main-content" className="cvPage">
    <section className="cvHero"><div className="container"><nav className="cvBreadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={14}/>{scope&&<><Link href="/categories">Categories</Link><ChevronRight size={14}/></>}<span aria-current="page">{scope?.label||'Shop components'}</span></nav>
      <div className="cvHeroRow"><div><span className="nisEyebrow">{scope?'SOLAR COMPONENT CATEGORY':'THE SOLAR COMPONENT CATALOGUE'}</span><h1>{scope?<>{scope.label}<br/><em>for solar projects.</em></>:<>Find the right component.<br/><em>Keep your project moving.</em></>}</h1><p>{scope?.description||'ACDB, DCDB and BOS components — browse published ratings, choose the right option and buy with clear GST pricing.'}</p></div><Link href="/bulk-order" className="cvProjectLink"><FileText size={24}/><span><strong>Buying for a project?</strong><small>Send quantities, ratings and your BOQ.</small></span><ArrowRight size={20}/></Link></div>
      <form onSubmit={submitSearch} role="search" className="cvSearch"><label htmlFor="catalogue-search" className="cvSrOnly">Search products, SKU, brand or rating</label><Search size={21}/><input id="catalogue-search" type="search" maxLength={160} value={search} placeholder={scope?`Search within ${scope.label}…`:'Search product, SKU, brand or rating…'} onChange={e => setSearch(e.target.value)}/>{(search || filters.q) && <button type="button" className="cvIconButton" aria-label="Clear product search" onClick={() => {setSearch(''); change({q: ''})}}><X size={18}/></button>}<BuyerButton type="submit">Search</BuyerButton></form>
      <div className="cvHeroFoot"><span><CheckCircle2 size={15}/> Prices include published GST</span><span><Package size={15}/> Choose from active product options</span><span><FileText size={15}/> Project RFQs welcome</span></div>
    </div></section>
    <div className="container cvContent"><div className="cvCategoryStrip" aria-label="Browse product categories">{scope?<><Link href="/categories"><ChevronLeft size={14}/> All categories</Link><Link href="/shop">Shop all components <ArrowRight size={14}/></Link></>:<><button type="button" aria-pressed={!filters.category} className={!filters.category ? 'active' : ''} onClick={() => change({category: '', specs: {}})}>All components</button>{categories.filter(c => !c.parent_id).map(c => <button type="button" aria-pressed={filters.category === c.slug} className={filters.category === c.slug ? 'active' : ''} key={c.id} onClick={() => change({category: c.slug, specs: {}})}>{c.name}<span>{counts.get(c.slug)}</span></button>)}<Link href="/categories">Category directory <ArrowRight size={14}/></Link></>}</div><section className="cvComboBanner"><div><span>AC + DC PROTECTION PAIR</span><h2>Choose ACDB and DCDB together.</h2><p>Build a two-product combo from published stock and add both quantities to one cart.</p></div><Link href="/combo">Create combo <ArrowRight size={17}/></Link></section>
      {error ? <BuyerAlert tone="error"><p>{error}</p><BuyerButton onClick={() => setRetry(r => r + 1)} variant="outline">Retry catalogue</BuyerButton></BuyerAlert> : <div className="cvLayout">
        <aside className="cvDesktopFilters" aria-label="Product filters">{!loading ? <FilterPanel {...panelProps}/> : <div className="cvFilterSkeleton"><BuyerSkeleton kind="title"/>{[0,1,2,3,4,5].map(i => <BuyerSkeleton key={i}/>)}</div>}</aside>
        <section className="cvResults" aria-busy={loading} aria-label="Catalogue results"><div className="cvResultsHead" ref={resultsHeading}><div><h2>{scope?.label||category?.name || (filters.category ? 'Category results' : 'All components')}</h2><p role="status" aria-live="polite">{loading ? 'Loading published products…' : `${results.length ? (page - 1) * PAGE_SIZE + 1 : 0}–${Math.min(page * PAGE_SIZE, results.length)} of ${results.length} products`}</p></div><div className="cvResultControls"><button ref={filterButton} type="button" className="nisBtn nisBtnOutline cvMobileFilter" aria-haspopup="dialog" aria-controls={dialogId} onClick={() => {dialog.current?.showModal(); setModalOpen(true)}} disabled={loading}><SlidersHorizontal size={17}/> Filters{chips.length > 0 && <span>{chips.length}</span>}</button><BuyerField label="Sort products"><BuyerSelect value={filters.sort} onChange={e => change({sort: e.target.value as Filters['sort']})}><option value="featured">Featured first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name: A–Z</option><option value="stock">In stock first</option></BuyerSelect></BuyerField><div className="cvViewControls" role="group" aria-label="Product view"><button type="button" className={filters.view === 'grid' ? 'active' : ''} aria-pressed={filters.view === 'grid'} aria-label="Grid view" onClick={() => change({view: 'grid'}, false)}><LayoutGrid size={19}/></button><button type="button" className={filters.view === 'list' ? 'active' : ''} aria-pressed={filters.view === 'list'} aria-label="List view" onClick={() => change({view: 'list'}, false)}><List size={19}/></button></div></div></div>
          {chips.length > 0 && <div className="cvActiveFilters" aria-label="Applied filters">{chips.map(chip => <button type="button" key={chip.label} onClick={chip.remove} aria-label={`Remove ${chip.label}`}>{chip.label}<X size={14}/></button>)}<button type="button" className="cvClearAll" onClick={clear}>Clear all</button></div>}
          {filters.min && filters.max && Number(filters.min) > Number(filters.max) && <BuyerAlert tone="warning">Minimum price exceeds maximum price. Clear or update the price filter.</BuyerAlert>}
          {loading ? <div className="cvGrid">{[0,1,2,3,4,5].map(i => <div className="nisCard cvLoadingCard" key={i}><BuyerSkeleton kind="media"/><BuyerSkeleton kind="title"/><BuyerSkeleton/><BuyerSkeleton kind="button"/></div>)}</div> : !results.length ? <div className="cvEmpty"><Search size={40}/><h3>{products.length ? 'No products match these filters.' : 'The catalogue is being prepared.'}</h3><p>{products.length ? 'Try fewer specifications, another category or a different search. Project requirements can also be submitted to our team.' : 'No active products are published yet. Send your requirement for a quotation.'}</p><div>{chips.length > 0 && <BuyerButton onClick={clear}>Clear filters</BuyerButton>}<BuyerButton href="/bulk-order" variant="outline">Send a requirement</BuyerButton></div></div> : <><div className={`cvGrid ${filters.view === 'list' ? 'cvList' : ''}`}>{visible.map(row => <ProductCard result={row} key={row.product.id}/>)}</div>{pages > 1 && <nav className="cvPagination" aria-label="Catalogue pages"><BuyerButton variant="outline" disabled={page === 1} onClick={() => goPage(page - 1)}><ChevronLeft size={16}/> Previous</BuyerButton><span>Page {page} of {pages}</span><BuyerButton variant="outline" disabled={page === pages} onClick={() => goPage(page + 1)}>Next <ChevronRight size={16}/></BuyerButton></nav>}</>}
          <p className="cvPricingNote">Unit prices use the published GST rate. “From” refers to a matching active variant, not a complete custom box quotation. Final availability, quantity, shipping and tax are verified at checkout.</p>
        </section>
      </div>}
      <section className="cvBottomCta"><div><span className="nisEyebrow">PROJECT PROCUREMENT</span><h2>Need more than a single component?</h2><p>Share your ACDB, DCDB or BOS requirement for a project quotation.</p></div><BuyerButton href="/bulk-order" variant="secondary">Request project pricing <ArrowRight size={17}/></BuyerButton></section>
    </div>
    <dialog ref={dialog} id={dialogId} className="cvFilterDialog" aria-labelledby={`${dialogId}-title`} onClose={() => {setModalOpen(false); filterButton.current?.focus()}} onClick={e => {if (e.target === e.currentTarget) dialog.current?.close()}}><div className="cvDialogShell"><header><h2 id={`${dialogId}-title`}>Refine your catalogue</h2><button type="button" className="cvIconButton" aria-label="Close filters" onClick={() => dialog.current?.close()} autoFocus><X size={22}/></button></header><div className="cvDialogBody"><FilterPanel {...panelProps}/></div><footer><BuyerButton block onClick={() => dialog.current?.close()}>Show {results.length} products <ArrowRight size={17}/></BuyerButton></footer></div></dialog>
  </main>
}

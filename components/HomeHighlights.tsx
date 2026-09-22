'use client'

import Image from 'next/image'
import Link from 'next/link'
import {useState} from 'react'
import {ArrowRight, Download, FileText, PackageSearch} from 'lucide-react'
import {publicAssetUrl, type HomeProduct, type HomeDownload} from '../lib/homepage-sections'

export function HomeProductImage({src, alt, priority = false}: {src?: string; alt: string; priority?: boolean}) {
  const [failed, setFailed] = useState<string>()
  const url = publicAssetUrl(src)
  if (!url || failed === url) return <span className="hvImagePlaceholder" role="img" aria-label={alt}><PackageSearch aria-hidden="true"/></span>
  return <Image src={url} alt={alt} width={900} height={700} sizes="(max-width: 560px) 46vw, (max-width: 1100px) 30vw, 300px" priority={priority} unoptimized={url.startsWith('https://')&&!url.startsWith('https://cdtbwuagqxkknkccpkcr.supabase.co/storage/v1/object/public/')} onError={() => setFailed(url)}/>
}

const money = (value: number) => new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 2}).format(value)

export function HomeFeaturedProducts({products, unavailable}: {products: HomeProduct[]; unavailable: boolean}) {
  const featured = products.some(product => product.featured)
  return <section className="hvSection hvFeatured" aria-labelledby="home-products-title"><div className="container">
    <div className="hvSectionHead"><div><span>FROM THE PRODUCT CATALOGUE</span><h2 id="home-products-title">{featured ? 'Featured products for your next installation.' : 'Explore products for your next installation.'}</h2><p>Review ratings, variants and availability before choosing the right component.</p></div><Link href="/shop">View all products <ArrowRight size={17}/></Link></div>
    {products.length ? <div className="hvFeaturedGrid">{products.map(product => {
      const variants = product.product_variants || []
      const prices = variants.map(v => v.selling_price == null ? NaN : Number(v.selling_price)).filter(n => Number.isFinite(n) && n > 0)
      const base = prices.length ? Math.min(...prices) : null
      const gst = Number(product.gst_rate ?? 18)
      const inclusive = base === null ? null : Math.round(base * (1 + gst / 100) * 100) / 100
      const inStock = variants.some(v => Number(v.stock_qty) > 0)
      const photo = [...(product.product_images || [])].sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0))[0]
      return <article key={product.id} className="hvFeaturedCard">
        <Link href={`/product/${product.slug}`} className="hvFeaturedPhoto" aria-label={`View ${product.name}`}><HomeProductImage src={photo?.image_url} alt={photo?.alt_text || product.name}/>{product.featured && <span>Featured</span>}</Link>
        <div className="hvFeaturedCopy"><h3><Link href={`/product/${product.slug}`}>{product.name}</Link></h3><p>{product.short_description || 'View product specifications and available variants.'}</p><div className="hvFeaturedPrice">{inclusive !== null ? <><b>{variants.length > 1 ? 'From ' : ''}{money(inclusive)}</b><small>Incl. {gst}% GST</small></> : <b>Price on request</b>}</div><span className={inStock ? 'hvAvailable' : 'hvOnRequest'}>{inStock ? 'Stock available — select variant' : 'Enquire for availability'}</span><Link className="hvTextLink" href={`/product/${product.slug}`}>View options <ArrowRight size={16}/></Link></div>
      </article>
    })}</div> : <div className="hvCatalogueEmpty"><PackageSearch aria-hidden="true"/><div><h3>{unavailable ? 'Product highlights are temporarily unavailable.' : 'Looking for a specific component?'}</h3><p>Browse the full catalogue or share your ratings and quantities for a quotation.</p></div><Link className="hvBtn hvBtnDark" href="/bulk-order">Request a quote <ArrowRight size={16}/></Link></div>}
  </div></section>
}

export function HomeResources({downloads}: {downloads: HomeDownload[]}) {
  const catalogue = downloads.find(file => /catalogue|catalog/i.test(`${file.category} ${file.title}`) && publicAssetUrl(file.file_url))
  return <section className="hvSection hvResources" aria-labelledby="home-downloads-title"><div className="container hvResourceGrid"><div><span className="hvResourceEyebrow">CATALOGUES & TECHNICAL RESOURCES</span><h2 id="home-downloads-title">Keep the details close to your project.</h2><p>Find published catalogues and technical documents, or request the information needed for your component selection.</p><div className="hvActions">{catalogue ? <a className="hvBtn hvBtnDark" href={publicAssetUrl(catalogue.file_url)} target="_blank" rel="noopener noreferrer"><Download size={17}/> Download catalogue</a> : <Link className="hvBtn hvBtnDark" href="/downloads"><Download size={17}/> Browse downloads</Link>}<Link className="hvTextLink" href="/bulk-order">Request technical details <ArrowRight size={16}/></Link></div></div><div className="hvResourceList">{downloads.filter(file => publicAssetUrl(file.file_url)).slice(0,3).map(file => <a key={file.id} href={publicAssetUrl(file.file_url)} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true"/><span><small>{file.category || 'Technical document'}</small><b>{file.title}</b></span><Download size={17}/></a>)}{!downloads.some(file => publicAssetUrl(file.file_url)) && <div className="hvResourceFallback"><FileText aria-hidden="true"/><h3>Need a catalogue or datasheet?</h3><p>Tell us the product and rating you need. Our team can help with the available documentation.</p><Link className="hvTextLink" href="/bulk-order">Request product information <ArrowRight size={16}/></Link></div>}</div></div></section>
}

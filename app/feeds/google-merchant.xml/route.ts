import {SITE_NAME, SITE_URL, activeVariants, plainText, priceWithGst, productCategory, productUrl, sortedImages, storefrontProducts} from '../../../lib/seo'

// Product feed for Google Merchant Center (also accepted by Meta Commerce Manager catalogues).
export const revalidate = 3600

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, char => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'}[char] as string))
const tag = (name: string, value: string | number | null | undefined) => value === null || value === undefined || value === '' ? '' : `<${name}>${escapeXml(String(value))}</${name}>`

export async function GET() {
  let items = ''
  try {
    const products = await storefrontProducts(3600)
    for (const product of products) {
      const variants = activeVariants(product)
      if (!variants.length) continue
      const images = sortedImages(product)
      if (!images.length) continue
      const gst = Number(product.gst_rate ?? 18)
      const category = productCategory(product)
      const multi = variants.length > 1
      for (const variant of variants) {
        const price = priceWithGst(Number(variant.selling_price), gst)
        const mrp = Number(variant.mrp) > Number(variant.selling_price) ? priceWithGst(Number(variant.mrp), gst) : 0
        const inStock = Number(variant.stock_qty) > 0
        const description = plainText(product.description || product.short_description || product.name)
        items += '<item>'
          + tag('g:id', variant.sku || variant.id)
          + (multi ? tag('g:item_group_id', product.id) : '')
          + tag('g:title', plainText(product.name, 150))
          + tag('g:description', description)
          + tag('g:link', productUrl(product.slug))
          + tag('g:image_link', images[0])
          + images.slice(1, 10).map(url => tag('g:additional_image_link', url)).join('')
          + tag('g:availability', inStock ? 'in_stock' : 'out_of_stock')
          + (mrp ? tag('g:price', `${mrp.toFixed(2)} INR`) + tag('g:sale_price', `${price.toFixed(2)} INR`) : tag('g:price', `${price.toFixed(2)} INR`))
          + tag('g:condition', 'new')
          + tag('g:brand', product.brands?.is_active !== false && product.brands?.name ? product.brands.name : SITE_NAME)
          + tag('g:mpn', variant.sku || variant.id)
          + tag('g:identifier_exists', 'no')
          + tag('g:google_product_category', '127')
          + tag('g:product_type', `Solar Components > ${category.label}`)
          + '</item>'
      }
    }
  } catch {
    return new Response('Catalogue temporarily unavailable', {status: 503, headers: {'Retry-After': '600', 'Cache-Control': 'no-store'}})
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${escapeXml(SITE_NAME)}</title><link>${SITE_URL}</link><description>${escapeXml('Solar ACDB, DCDB and ACDB + DCDB combo boxes')}</description>${items}</channel></rss>`
  return new Response(xml, {headers: {'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=900, s-maxage=3600'}})
}

// Marketing event helpers. Every call is a no-op unless the matching tag
// (Google tag / Meta Pixel) was loaded by components/MarketingTags.tsx.

type Item = {id: string; name: string; price: number; quantity?: number; category?: string}

type Gtag = (...args: unknown[]) => void
type Fbq = (...args: unknown[]) => void

function gtag(): Gtag | null {
  if (typeof window === 'undefined') return null
  const fn = (window as unknown as {gtag?: Gtag}).gtag
  return typeof fn === 'function' ? fn : null
}

function fbq(): Fbq | null {
  if (typeof window === 'undefined') return null
  const fn = (window as unknown as {fbq?: Fbq}).fbq
  return typeof fn === 'function' ? fn : null
}

function safely(run: () => void) {
  try {run()} catch {/* tracking must never break the buyer flow */}
}

const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100

function gaItems(items: Item[]) {
  return items.map(item => ({item_id: item.id, item_name: item.name, item_category: item.category, price: round(item.price), quantity: item.quantity || 1}))
}

function value(items: Item[]) {
  return round(items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0))
}

export function trackViewItem(item: Item) {
  safely(() => {
    gtag()?.('event', 'view_item', {currency: 'INR', value: value([item]), items: gaItems([item])})
    fbq()?.('track', 'ViewContent', {content_ids: [item.id], content_name: item.name, content_type: 'product', value: value([item]), currency: 'INR'})
  })
}

export function trackAddToCart(item: Item) {
  safely(() => {
    gtag()?.('event', 'add_to_cart', {currency: 'INR', value: value([item]), items: gaItems([item])})
    fbq()?.('track', 'AddToCart', {content_ids: [item.id], content_name: item.name, content_type: 'product', value: value([item]), currency: 'INR'})
  })
}

export function trackBeginCheckout(items: Item[]) {
  safely(() => {
    gtag()?.('event', 'begin_checkout', {currency: 'INR', value: value(items), items: gaItems(items)})
    fbq()?.('track', 'InitiateCheckout', {content_ids: items.map(item => item.id), content_type: 'product', num_items: items.length, value: value(items), currency: 'INR'})
  })
}

export function trackPurchase(orderId: string, total: number) {
  safely(() => {
    gtag()?.('event', 'purchase', {transaction_id: orderId, currency: 'INR', value: round(total)})
    fbq()?.('track', 'Purchase', {value: round(total), currency: 'INR'})
  })
}

export function trackLead(source: string) {
  safely(() => {
    gtag()?.('event', 'generate_lead', {lead_source: source, currency: 'INR'})
    fbq()?.('track', 'Lead', {content_name: source})
  })
}

export function trackSearch(term: string) {
  const query = term.trim().slice(0, 100)
  if (!query) return
  safely(() => {
    gtag()?.('event', 'search', {search_term: query})
    fbq()?.('track', 'Search', {search_string: query})
  })
}

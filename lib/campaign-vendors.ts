// Installation vendors: import from the PM Surya Ghar registered-vendor list (per district) or a sheet,
// merge into campaign_vendors without touching our own fields, and rank vendors for a district.

export const VENDOR_STATUSES = [
  { key: 'prospect', label: 'Prospect' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'Working with us' },
  { key: 'blocked', label: 'Do not use' },
] as const

export const vendorStatusLabel = (key: string) => VENDOR_STATUSES.find(s => s.key === key)?.label || key

export type PortalVendor = {
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address?: string | null
  website?: string | null
  brands: string | null
  district_installs: Record<string, number>
  registered_districts: string[]
  capacity_kwp: number | null
  portal_rating: number | null
  portal_reviews: number | null
}

const clean = (v: unknown) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s && !/^(na|n\/a|null|-)$/i.test(s) ? s : null }
const num = (v: unknown) => { const s = String(v ?? '').replace(/[,₹\s]/g, ''); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null }
export const vendorKey = (name: unknown) => String(name ?? '').toLowerCase().replace(/\b(private|pvt|limited|ltd|llp|co|company|the)\b\.?/g, '').replace(/[^a-z0-9]+/g, '')
const phoneOf = (v: unknown) => { const d = String(v ?? '').replace(/\D/g, ''); const m = d.match(/(?:91)?([6-9]\d{9})$/) || d.match(/([6-9]\d{9})/); return m ? m[1] : clean(v) }
const emailOf = (v: unknown) => { const s = clean(String(v ?? '').replace(/\[at\]/gi, '@').replace(/\[dot\]/gi, '.')); return s && /\S+@\S+\.\S+/.test(s) ? s.toLowerCase() : s }

/**
 * Merges the per-district lists collected from the portal ({ districts: { 'Amreli': [rows...] } }) into one
 * vendor per company. Ratings and capacity are portal-wide, so a district where the portal shows none
 * (Bhavnagar) still gets them from another district's row for the same vendor.
 */
export function vendorsFromPortalExport(data: any): PortalVendor[] {
  const byKey = new Map<string, PortalVendor>()
  const districts = data?.districts && typeof data.districts === 'object' ? data.districts : {}
  for (const [district, rows] of Object.entries<any>(districts)) {
    if (!Array.isArray(rows)) continue
    for (const r of rows) {
      const name = clean(r?.name)
      if (!name) continue
      const k = vendorKey(name)
      if (!k) continue
      const v = byKey.get(k) || { name, contact_name: null, phone: null, email: null, address: null, website: null, brands: null, district_installs: {}, registered_districts: [], capacity_kwp: null, portal_rating: null, portal_reviews: null }
      v.contact_name ||= clean(r.contact)
      v.phone ||= phoneOf(r.phone)
      v.email ||= emailOf(r.email)
      v.address ||= clean(r.address)
      v.website ||= clean(r.website)
      v.brands ||= clean(r.brand)
      if (!v.registered_districts.includes(district)) v.registered_districts.push(district)
      const inst = num(r.inst)
      if (inst && inst > 0) v.district_installs[district] = inst
      const kwp = num(r.kwp), rating = num(r.rating), reviews = num(r.reviews)
      if (kwp != null && (v.capacity_kwp == null || kwp > v.capacity_kwp)) v.capacity_kwp = kwp
      if (rating != null && rating > 0 && rating <= 5 && (v.portal_reviews == null || (reviews ?? 0) >= v.portal_reviews)) { v.portal_rating = rating; v.portal_reviews = reviews ?? v.portal_reviews }
      byKey.set(k, v)
    }
  }
  return [...byKey.values()]
}

/** Vendors from a sheet: Name, Contact person, Phone/Mobile, Email, Address, Website, Brand, District, Installations, Rating, Reviews. */
export function vendorsFromSheetRows(rows: Record<string, unknown>[]): PortalVendor[] {
  const pick = (row: Record<string, unknown>, re: RegExp) => { for (const [k, v] of Object.entries(row)) if (re.test(k.toLowerCase().replace(/[^a-z]+/g, ' ').trim())) return v; return undefined }
  const grouped: Record<string, any[]> = {}
  for (const row of rows) {
    const name = clean(pick(row, /^(vendor|vendor name|name|company|company name|agency)$/))
    if (!name) continue
    const district = clean(pick(row, /^(district|area)$/)) || 'Unknown'
    ;(grouped[district] ||= []).push({
      name, contact: pick(row, /^(contact|contact person|contact name|owner)$/), phone: pick(row, /^(phone|mobile|contact number|contact no|mobile number|phone number)$/),
      email: pick(row, /^(email|e mail|email id)$/), address: pick(row, /^(address|location)$/), website: pick(row, /^(website|web|url)$/), brand: pick(row, /^(brand|brands|brand name)$/),
      inst: pick(row, /^(installations|no of installations|installs)$/), kwp: pick(row, /^(capacity|capacity kwp|installed capacity|kwp)$/), rating: pick(row, /^(rating|portal rating)$/), reviews: pick(row, /^(reviews|ratings|rating count|review count)$/),
    })
  }
  return vendorsFromPortalExport({ districts: grouped })
}

/** Fields a portal refresh may overwrite on an existing vendor; our status, rating, notes etc. are never touched. */
export function portalPatch(existing: any, v: PortalVendor) {
  const patch: Record<string, any> = {
    district_installs: { ...(existing?.district_installs || {}), ...v.district_installs },
    registered_districts: [...new Set([...(existing?.registered_districts || []), ...v.registered_districts])],
    portal_synced_at: new Date().toISOString(),
  }
  for (const k of ['contact_name', 'phone', 'email', 'address', 'website', 'brands'] as const) if (v[k] && !existing?.[k]) patch[k] = v[k]
  for (const k of ['capacity_kwp', 'portal_rating', 'portal_reviews'] as const) if (v[k] != null) patch[k] = v[k]
  return patch
}

/** Installations the portal shows for the vendor in a district (0 when none), or across our districts for 'all'. */
export function installsIn(vendor: { district_installs?: Record<string, number> | null }, district: string) {
  const d = vendor.district_installs || {}
  return district === 'all' ? Object.values(d).reduce((a, n) => a + (Number(n) || 0), 0) : Number(d[district] || 0)
}

/** Links for checking a vendor outside the portal: Google reviews, Maps, and company registration (age). */
export function vendorLinks(v: { name: string; address?: string | null }) {
  const q = (s: string) => encodeURIComponent(s)
  const place = v.address ? `${v.name} ${v.address}` : `${v.name} Gujarat solar`
  return {
    reviews: `https://www.google.com/search?q=${q(`${v.name} solar reviews`)}`,
    maps: `https://www.google.com/maps/search/${q(place)}`,
    company: `https://www.google.com/search?q=${q(`${v.name} company incorporation date CIN`)}`,
    portal: 'https://pmsuryaghar.gov.in/#/registered-vendors',
  }
}

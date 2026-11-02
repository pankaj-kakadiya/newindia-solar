// Solar market data: PM Surya Ghar portal snapshots and Gujarat live grid / sunlight.
// Pure helpers shared by the admin dashboard, its API route and the tests.

export type PmsgLevel = 'india' | 'state' | 'district' | 'discom'
export type PmsgRow = {
  snapshot_date: string
  level: PmsgLevel
  state: string
  name: string
  applications: number
  installations: number
  households: number
  capacity_mw: number
  subsidy_lakh: number
}

const num = (s: unknown) => {
  const n = Number(String(s ?? '').replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Parses a table copied from the PM Surya Ghar portal (State/UT-wise Progress → District Info or
 * Discom Info): a title line such as "District-wise Data for Gujarat" or "All Discoms Data for Gujarat",
 * a header row, then tab-separated rows of name, applications, installations, households, MW, subsidy (₹ lakh).
 * Also accepts CSV with the same column order. Returns the rows and the lines it could not read.
 */
export function parsePortalTable(text: string, snapshotDate: string, fallbackState = 'Gujarat'): { rows: PmsgRow[]; skipped: string[] } {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let level: PmsgLevel = 'district'
  let state = fallbackState
  let subsidyInCrore = false
  const rows: PmsgRow[] = []
  const skipped: string[] = []
  for (const line of lines) {
    const title = line.match(/^(District-wise|All Discoms) Data for (.+)$/i)
    if (title) { level = /discom/i.test(title[1]) ? 'discom' : 'district'; state = title[2].trim(); continue }
    if (/^(district|discom name|state)\b.*application/i.test(line) || /^name\b/i.test(line)) { subsidyInCrore = /\(cr\)/i.test(line); if (/^discom/i.test(line)) level = 'discom'; continue }
    const cells = line.includes('\t') ? line.split('\t') : line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, ''))
    if (cells.length < 6) { skipped.push(line); continue }
    const [name, ...rest] = cells
    const [a, i, h, mw, sub] = rest.slice(-5).map(num)
    if (!name.trim() || [a, i, h, mw, sub].some(v => Number.isNaN(v))) { skipped.push(line); continue }
    rows.push({ snapshot_date: snapshotDate, level, state, name: name.trim().replace(/\s+/g, ' '), applications: a, installations: i, households: h, capacity_mw: mw, subsidy_lakh: subsidyInCrore ? Math.round(sub * 100 * 100) / 100 : sub })
  }
  return { rows, skipped }
}

export type DistrictInsight = PmsgRow & { pending: number; conversion: number; change?: { installations: number; capacity_mw: number; days: number } }

/** Adds pending applications, conversion and the change since an earlier snapshot of the same place. */
export function districtInsights(current: PmsgRow[], previous: PmsgRow[] = []): DistrictInsight[] {
  const prev = new Map(previous.map(r => [`${r.level}|${r.state}|${r.name.toLowerCase()}`, r]))
  return current.map(r => {
    const p = prev.get(`${r.level}|${r.state}|${r.name.toLowerCase()}`)
    const days = p ? Math.round((Date.parse(r.snapshot_date) - Date.parse(p.snapshot_date)) / 864e5) : 0
    return {
      ...r,
      pending: Math.max(r.applications - r.installations, 0),
      conversion: r.applications ? r.installations / r.applications : 0,
      ...(p && days > 0 ? { change: { installations: r.installations - p.installations, capacity_mw: Math.round((r.capacity_mw - p.capacity_mw) * 100) / 100, days } } : {}),
    }
  })
}

export type SldcLive = { frequency_hz: number | null; demand_mw: number | null; dam_rate: number | null }

/** Reads Grid Frequency, Gujarat Catered (MW) and DAM Rate from the SLDC Gujarat home page HTML. */
export function parseSldcHome(html: string): SldcLive {
  const text = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  const pick = (label: RegExp) => { const m = text.match(label); return m ? num(m[1]) : null }
  const f = pick(/Grid Frequency\s*:\s*([\d.]+)\s*Hz/i)
  const d = pick(/Gujarat Catered\s*:\s*([\d,.]+)\s*MW/i)
  const r = pick(/DAM Rate\s*:\s*([\d.]+)\s*Rs/i)
  return {
    frequency_hz: f != null && f > 45 && f < 55 ? f : null,
    demand_mw: d != null && d > 1000 && d < 60000 ? d : null,
    dam_rate: r != null && r >= 0 && r < 50 ? r : null,
  }
}

export const SOLAR_SITES = [
  { district: 'Gir Somnath', place: 'Veraval', lat: 20.907, lon: 70.367 },
  { district: 'Amreli', place: 'Amreli', lat: 21.603, lon: 71.222 },
  { district: 'Bhavnagar', place: 'Bhavnagar', lat: 21.765, lon: 72.152 },
  { district: 'Ahmedabad', place: 'Ahmedabad', lat: 23.023, lon: 72.571 },
  { district: 'Rajkot', place: 'Rajkot', lat: 22.303, lon: 70.802 },
  { district: 'Surat', place: 'Surat', lat: 21.170, lon: 72.831 },
] as const

/** Typical rooftop performance ratio (inverter, temperature, dust and wiring losses) used for estimates. */
export const PERFORMANCE_RATIO = 0.75

/** Estimated output in MW of `installedMw` of rooftop solar at `irradiance` W/m² (plane-of-array ≈ horizontal). */
export const estimateOutputMw = (installedMw: number, irradiance: number) => Math.max(0, installedMw * (irradiance / 1000) * PERFORMANCE_RATIO)

/** Estimated kWh from a system of `kw` given daily radiation in MJ/m² (Open-Meteo shortwave_radiation_sum). */
export const estimateDailyKwh = (kw: number, radiationMjPerM2: number) => Math.max(0, kw * (radiationMjPerM2 / 3.6) * PERFORMANCE_RATIO)

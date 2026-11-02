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

/** Gujarat state top-up (Cabinet decision 22-10-2026): "more than three lakh families", ~₹1,000 crore. */
export const STATE_SCHEME = { start: '2026-10-22', households: 300000 } as const

export type SchemeDistrict = { name: string; applications: number; installations: number; pending: number; newApplications: number; newInstallations: number; appsPerDay: number; installsPerDay: number }

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

/**
 * Growth since the state scheme started, from portal snapshots. The baseline is the first Gujarat district
 * snapshot on or after the start date; the days between the start and the baseline are filled at the
 * measured daily rate (an estimate, flagged by gapDays). Every new Gujarat installation is counted against
 * the 3-lakh pool, so the pool figures are an upper bound: the portal does not mark state top-up households.
 */
export function sinceScheme(rows: PmsgRow[], latestDate: string, start: string = STATE_SCHEME.start, pool: number = STATE_SCHEME.households) {
  const gj = rows.filter(r => r.level === 'district' && r.state.toLowerCase() === 'gujarat')
  const dates = [...new Set(gj.map(r => r.snapshot_date))].filter(d => d >= start && d <= latestDate).sort()
  const baseline = dates[0]
  if (!baseline || baseline === latestDate) return { ready: false as const, baseline: baseline || null, latest: latestDate, snapshots: dates.length }
  const base = new Map(gj.filter(r => r.snapshot_date === baseline).map(r => [r.name.toLowerCase(), r]))
  const days = dayDiff(baseline, latestDate), gapDays = Math.max(dayDiff(start, baseline), 0)
  const districts: SchemeDistrict[] = gj.filter(r => r.snapshot_date === latestDate).map(r => {
    const b = base.get(r.name.toLowerCase())
    const newApplications = b ? Math.max(r.applications - b.applications, 0) : 0
    const newInstallations = b ? Math.max(r.installations - b.installations, 0) : 0
    return { name: r.name, applications: r.applications, installations: r.installations, pending: Math.max(r.applications - r.installations, 0), newApplications, newInstallations, appsPerDay: newApplications / days, installsPerDay: newInstallations / days }
  })
  const sum = (k: keyof SchemeDistrict) => districts.reduce((a, d) => a + (Number(d[k]) || 0), 0)
  const newApplications = sum('newApplications'), newInstallations = sum('newInstallations')
  const installsPerDay = newInstallations / days, appsPerDay = newApplications / days
  const usedEstimate = Math.round(newInstallations + installsPerDay * gapDays)
  const applicationsEstimate = Math.round(newApplications + appsPerDay * gapDays)
  const left = Math.max(pool - usedEstimate, 0)
  return {
    ready: true as const, baseline, latest: latestDate, snapshots: dates.length, days, gapDays, pool,
    districts, newApplications, newInstallations, appsPerDay, installsPerDay,
    usedEstimate, applicationsEstimate, left, usedShare: Math.min(usedEstimate / pool, 1),
    // Applications fill the pool before installations do: the earlier of the two is the real deadline for camps.
    daysLeftByInstalls: installsPerDay > 0 ? Math.ceil(left / installsPerDay) : null,
    daysLeftByApplications: appsPerDay > 0 ? Math.ceil(Math.max(pool - applicationsEstimate, 0) / appsPerDay) : null,
  }
}

/** Camp priority for a district: households already applying fast, and many applications still waiting for installation. */
export const campPriority = (d: SchemeDistrict) => d.appsPerDay * 30 + d.pending * 0.05

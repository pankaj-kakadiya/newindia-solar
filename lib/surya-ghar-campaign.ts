// PM Surya Ghar + Gujarat state top-up rules and campaign helpers.
// Source: Gujarat Energy & Petrochemicals Department GR No. EPCD/BUD/e-file/20/2025/2435/B1
// dated 22-10-2026, read with MNRE PM Surya Ghar CFA slabs. Final amounts are decided by the DISCOM.

export const SURYA_GHAR_RULES = {
  grNumber: 'EPCD/BUD/e-file/20/2025/2435/B1',
  grDate: '2026-10-22',
  benchmarkFirst2Kw: 50000,
  benchmarkAbove2Kw: 45000,
  centralFirst2Kw: 30000,
  centralThirdKw: 18000,
  centralCap: 78000,
  stateLimitKw: 2.18,
  householdShare: { general: 0.10, sc: 0.05, st: 0.05 },
} as const

export type HouseholdCategory = 'general' | 'sc' | 'st'

export type SubsidyBreakdown = {
  kw: number
  category: HouseholdCategory
  benchmark: number
  central: number
  stateEligible: boolean
  state: number
  householdPays: number
  governmentTotal: number
}

const rupees = (n: number) => Math.round(n)

export function calcSuryaGharSubsidy(kwInput: number | string | null | undefined, category: HouseholdCategory = 'general'): SubsidyBreakdown {
  const kw = Math.max(0, Number(kwInput) || 0)
  const r = SURYA_GHAR_RULES
  const benchmark = rupees(Math.min(kw, 2) * r.benchmarkFirst2Kw + Math.max(kw - 2, 0) * r.benchmarkAbove2Kw)
  const central = rupees(Math.min(Math.min(kw, 2) * r.centralFirst2Kw + Math.min(Math.max(kw - 2, 0), 1) * r.centralThirdKw, r.centralCap))
  const stateEligible = kw > 0 && kw <= r.stateLimitKw
  const share = r.householdShare[category] ?? r.householdShare.general
  const householdPays = stateEligible ? rupees(benchmark * share) : Math.max(benchmark - central, 0)
  const state = stateEligible ? Math.max(benchmark - central - householdPays, 0) : 0
  return { kw, category, benchmark, central, stateEligible, state, householdPays, governmentTotal: central + state }
}

export const CAMPAIGN_DISTRICTS = ['Gir Somnath', 'Amreli', 'Bhavnagar', 'Other'] as const

export const CAMPAIGN_STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'registered', label: 'Portal registered' },
  { key: 'feasibility_approved', label: 'PGVCL approved' },
  { key: 'survey_done', label: 'Survey done' },
  { key: 'installed', label: 'Installed' },
  { key: 'commissioned', label: 'Commissioned / net meter' },
  { key: 'subsidy_received', label: 'Subsidy received' },
  { key: 'lost', label: 'Lost' },
] as const

export type CampaignStage = typeof CAMPAIGN_STAGES[number]['key']

export const stageLabel = (key: string) => CAMPAIGN_STAGES.find(s => s.key === key)?.label || key
const stageOrder = (key: string) => CAMPAIGN_STAGES.findIndex(s => s.key === key)

/** True when a lead has reached `stage` or any later stage of the active funnel (lost never counts). */
export function reachedStage(leadStage: string, stage: string) {
  if (leadStage === 'lost') return false
  const a = stageOrder(leadStage), b = stageOrder(stage)
  return a >= 0 && b >= 0 && a >= b
}

export const CAMPAIGN_METRICS = [
  { key: 'camps_held', label: 'Village camps held' },
  { key: 'leads', label: 'Leads captured' },
  { key: 'registrations', label: 'Portal registrations' },
  { key: 'surveys', label: 'Site surveys done' },
  { key: 'installed', label: 'Systems installed' },
  { key: 'commissioned', label: 'Systems commissioned' },
  { key: 'subsidy_received', label: 'Subsidy received' },
] as const

type LeadLike = { stage: string; district?: string | null; portal_registered?: boolean | null; survey_date?: string | null }
type CampLike = { status: string; district?: string | null }

export function metricActual(metric: string, leads: LeadLike[], camps: CampLike[], district?: string | null) {
  const L = district ? leads.filter(l => l.district === district) : leads
  const C = district ? camps.filter(c => c.district === district) : camps
  switch (metric) {
    case 'camps_held': return C.filter(c => c.status === 'completed').length
    case 'leads': return L.length
    case 'registrations': return L.filter(l => l.portal_registered || reachedStage(l.stage, 'registered')).length
    case 'surveys': return L.filter(l => reachedStage(l.stage, 'survey_done')).length
    case 'installed': return L.filter(l => reachedStage(l.stage, 'installed')).length
    case 'commissioned': return L.filter(l => reachedStage(l.stage, 'commissioned')).length
    case 'subsidy_received': return L.filter(l => l.stage === 'subsidy_received').length
    default: return 0
  }
}

/** Indian mobile number as 10 digits, or null when it cannot be one. */
export function normalizeMobile(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits
  return /^[6-9][0-9]{9}$/.test(ten) ? ten : null
}

export function whatsappLink(mobile: string | null | undefined, text: string) {
  const m = normalizeMobile(mobile)
  return m ? `https://wa.me/91${m}?text=${encodeURIComponent(text)}` : null
}

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const SHEET_COLUMNS: Record<string, string> = {
  'name': 'full_name', 'full name': 'full_name', 'household': 'full_name',
  'mobile': 'mobile', 'phone': 'mobile', 'mobile number': 'mobile',
  'village': 'village', 'taluka': 'taluka', 'district': 'district',
  'pgvcl consumer no': 'consumer_number', 'consumer no': 'consumer_number', 'consumer number': 'consumer_number',
  'category': 'category', 'avg units month': 'avg_monthly_units', 'avg units per month': 'avg_monthly_units',
  'suggested size kw': 'system_kw', 'system kw': 'system_kw', 'size kw': 'system_kw',
  'registered on portal': 'portal_registered', 'loan needed': 'loan_needed',
  'survey date': 'survey_date', 'stage': 'stage', 'next follow up': 'next_follow_up_at', 'notes': 'notes', 'camp id': 'camp_code',
}

const yes = (v: unknown) => /^(y|yes|true|1|હા)$/i.test(String(v ?? '').trim())
const toIsoDate = (v: unknown) => {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10)
  const s = String(v ?? '').trim()
  if (!s) return null
  const d = new Date(s)
  return isNaN(+d) ? null : d.toISOString().slice(0, 10)
}
const stageFromText = (v: unknown): CampaignStage => {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return 'lead'
  const direct = CAMPAIGN_STAGES.find(x => x.key === s || x.label.toLowerCase() === s)
  if (direct) return direct.key
  if (s.includes('subsidy')) return 'subsidy_received'
  if (s.includes('inspect') || s.includes('net meter') || s.includes('commission')) return 'commissioned'
  if (s.includes('install')) return 'installed'
  if (s.includes('survey')) return 'survey_done'
  if (s.includes('approv')) return 'feasibility_approved'
  if (s.includes('regist')) return 'registered'
  if (s.includes('lost')) return 'lost'
  return 'lead'
}

export type ImportedLead = Record<string, any> & { full_name: string }

/**
 * Maps rows from the Village Solar Campaign Excel tracker (or any sheet with similar headers)
 * to campaign_leads columns. Rows without a name, or the template's example row, are skipped.
 */
export function leadsFromSheetRows(rows: Record<string, unknown>[]): { leads: ImportedLead[]; skipped: number } {
  const leads: ImportedLead[] = []
  let skipped = 0
  for (const row of rows) {
    const out: Record<string, any> = {}
    for (const [h, v] of Object.entries(row)) {
      const key = SHEET_COLUMNS[headerKey(h)]
      if (key) out[key] = v
    }
    const name = String(out.full_name ?? '').trim()
    if (!name || /example/i.test(name) || /example row/i.test(String(out.notes ?? ''))) { skipped++; continue }
    const category = String(out.category ?? '').trim().toLowerCase()
    const district = CAMPAIGN_DISTRICTS.find(d => d.toLowerCase() === String(out.district ?? '').trim().toLowerCase()) || 'Other'
    const kw = Number(out.system_kw)
    const units = Number(out.avg_monthly_units)
    const stage = stageFromText(out.stage)
    leads.push({
      full_name: name.slice(0, 120),
      mobile: normalizeMobile(out.mobile),
      village: String(out.village ?? '').trim() || null,
      taluka: String(out.taluka ?? '').trim() || null,
      district,
      consumer_number: String(out.consumer_number ?? '').trim() || null,
      category: category === 'sc' || category === 'st' ? category : 'general',
      avg_monthly_units: Number.isFinite(units) && units >= 0 && String(out.avg_monthly_units ?? '').trim() !== '' ? Math.round(units) : null,
      system_kw: Number.isFinite(kw) && kw > 0 && kw <= 10 ? kw : null,
      portal_registered: yes(out.portal_registered) || reachedStage(stage, 'registered'),
      loan_needed: yes(out.loan_needed),
      survey_date: toIsoDate(out.survey_date),
      stage,
      next_follow_up_at: toIsoDate(out.next_follow_up_at),
      notes: String(out.notes ?? '').trim() || null,
      camp_code: String(out.camp_code ?? '').trim() || null,
    })
  }
  return { leads, skipped }
}

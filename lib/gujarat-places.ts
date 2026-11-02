// Campaign geography: districts, talukas (English + Gujarati), village matching and
// village-directory import (LGD "Villages" download or Census 2011 village abstract).

export type DistrictInfo = { gu: string; talukas: [string, string][] }

export const CAMPAIGN_GEO: Record<string, DistrictInfo> = {
  'Gir Somnath': { gu: 'ગીર સોમનાથ', talukas: [['Veraval', 'વેરાવળ'], ['Talala', 'તાલાલા'], ['Sutrapada', 'સૂત્રાપાડા'], ['Kodinar', 'કોડીનાર'], ['Una', 'ઉના'], ['Gir Gadhada', 'ગીર ગઢડા']] },
  'Amreli': { gu: 'અમરેલી', talukas: [['Amreli', 'અમરેલી'], ['Babra', 'બાબરા'], ['Bagasara', 'બગસરા'], ['Dhari', 'ધારી'], ['Jafrabad', 'જાફરાબાદ'], ['Khambha', 'ખાંભા'], ['Kunkavav Vadia', 'કુંકાવાવ વડિયા'], ['Lathi', 'લાઠી'], ['Lilia', 'લીલીયા'], ['Rajula', 'રાજુલા'], ['Savarkundla', 'સાવરકુંડલા']] },
  'Bhavnagar': { gu: 'ભાવનગર', talukas: [['Bhavnagar', 'ભાવનગર'], ['Gariadhar', 'ગારીયાધાર'], ['Ghogha', 'ઘોઘા'], ['Jesar', 'જેસર'], ['Mahuva', 'મહુવા'], ['Palitana', 'પાલીતાણા'], ['Sihor', 'સિહોર'], ['Talaja', 'તળાજા'], ['Umrala', 'ઉમરાળા'], ['Vallabhipur', 'વલ્લભીપુર']] },
  'Other': { gu: 'અન્ય', talukas: [] },
}

export const VENUE_TYPES = [
  { key: 'panchayat_office', label: 'Gram panchayat office', gu: 'ગ્રામ પંચાયત કચેરી' },
  { key: 'gov_school', label: 'Government school', gu: 'સરકારી શાળા' },
  { key: 'temple', label: 'Temple', gu: 'મંદિર' },
  { key: 'ground', label: 'Village ground', gu: 'ગામનું મેદાન' },
  { key: 'community_hall', label: 'Community hall / samaj vadi', gu: 'સમાજ વાડી' },
  { key: 'dairy', label: 'Milk dairy', gu: 'દૂધ ડેરી' },
  { key: 'other', label: 'Other', gu: 'અન્ય' },
] as const

export const venueTypeLabel = (key: string) => {
  const t = VENUE_TYPES.find(v => v.key === key)
  return t ? `${t.label} (${t.gu})` : key
}

/** "Una (ઉના)" — English first so lists sort and search the same way staff type. */
export const bilingual = (en?: string | null, gu?: string | null) => en ? (gu && gu !== en ? `${en} (${gu})` : en) : (gu || '')

const squash = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '')

const TALUKA_ALIASES: Record<string, string> = {
  girgadhada: 'Gir Gadhada', girgadhda: 'Gir Gadhada', gadhada: 'Gir Gadhada', gadhda: 'Gir Gadhada',
  // LGD lists city wards as separate sub-districts; they belong to the parent taluka for the campaign.
  veravalcity: 'Veraval', bhavnagarcityeast: 'Bhavnagar', bhavnagarcitywest: 'Bhavnagar', bhavnagarcity: 'Bhavnagar', amrelicity: 'Amreli', kunkavavvadia: 'Kunkavav Vadia', kunkavav: 'Kunkavav Vadia', vadia: 'Kunkavav Vadia',
  savarkundla: 'Savarkundla', savarkundala: 'Savarkundla', liliya: 'Lilia', lilia: 'Lilia', bagasra: 'Bagasara', bagasara: 'Bagasara',
  gariyadhar: 'Gariadhar', gariadhar: 'Gariadhar', vallabhipur: 'Vallabhipur', vallabhpur: 'Vallabhipur', umrala: 'Umrala', sihor: 'Sihor', shihor: 'Sihor',
  patanveraval: 'Veraval', veraval: 'Veraval', sutrapada: 'Sutrapada', talala: 'Talala', talalagir: 'Talala', kodinar: 'Kodinar', una: 'Una',
}

export function talukasFor(district: string) {
  return CAMPAIGN_GEO[district]?.talukas || []
}

/** Canonical district name for the campaign, from LGD/Census spellings ("GIR SOMNATH", "Gir-Somnath"). */
export function canonicalDistrict(value: unknown) {
  const s = squash(value)
  if (!s) return null
  return Object.keys(CAMPAIGN_GEO).find(d => d !== 'Other' && (squash(d) === s || squash(CAMPAIGN_GEO[d].gu) === s)) || null
}

/** Canonical taluka within a district (English or Gujarati input, common spelling variants). */
export function canonicalTaluka(district: string, value: unknown) {
  const s = squash(value)
  if (!s) return null
  const list = talukasFor(district)
  const hit = list.find(([en, gu]) => squash(en) === s || squash(gu) === s)
  if (hit) return hit[0]
  const alias = TALUKA_ALIASES[s]
  return alias && list.some(([en]) => en === alias) ? alias : null
}

export type VillageRow = { id?: string; district: string; taluka: string; name_en: string; name_gu?: string | null; lgd_code?: string | null; census_code?: string | null; households?: number | null; population?: number | null }

/** Finds a village by English or Gujarati name (case/space-insensitive) inside a district and, if given, a taluka. */
export function findVillage(villages: VillageRow[], district: string, taluka: string | null | undefined, name: string) {
  const s = squash(name)
  if (!s) return null
  return villages.find(v => v.district === district && (!taluka || v.taluka === taluka) && (squash(v.name_en) === s || squash(v.name_gu) === s)) || null
}

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const COLUMN_RULES: [RegExp, keyof VillageRow | 'skip'][] = [
  [/^village name in english$|^village name english$|^village name$|^village$|^name$|^name of village$/, 'name_en'],
  [/^village name in local( language)?$|^village name local$|^local name$|^village name gujarati$|^gujarati name$|^villagenamelocal$/, 'name_gu'],
  [/^(sub district|subdistrict|sub district name|subdistrict name|sub district name in english|taluka|taluka name|tehsil|block name)$/, 'taluka'],
  [/^(district|district name|district name in english)$/, 'district'],
  [/^(village code|village lgd code|lgd code|villagecode)$/, 'lgd_code'],
  [/^(census 2011 code|census code 2011|census 2011 village code|village census 2011 code|town village code|villagecensus2011code)$/, 'census_code'],
  [/^(no hh|households|number of households|total households)$/, 'households'],
  [/^(tot p|total population|population)$/, 'population'],
]

/**
 * Maps rows from an LGD "Villages" download, a Census 2011 village abstract, or a simple sheet
 * (District, Taluka, Village, Gujarati name) to geo_villages rows. Rows outside the campaign
 * districts, or whose taluka cannot be recognised, are skipped and counted.
 */
export function villagesFromSheetRows(rows: Record<string, unknown>[], fallbackDistrict?: string) {
  const villages: VillageRow[] = []
  let skipped = 0
  const seen = new Set<string>()
  const seenCodes = new Set<string>()
  for (const row of rows) {
    const out: Record<string, unknown> = {}
    for (const [h, v] of Object.entries(row)) {
      const rule = COLUMN_RULES.find(([re]) => re.test(headerKey(h)))
      if (rule && out[rule[1]] === undefined) out[rule[1]] = v
    }
    const district = canonicalDistrict(out.district) || (out.district ? null : fallbackDistrict && CAMPAIGN_GEO[fallbackDistrict] ? fallbackDistrict : null)
    const taluka = district ? canonicalTaluka(district, out.taluka) : null
    const name = String(out.name_en ?? '').trim().replace(/\s+/g, ' ')
    if (!district || !taluka || !name) { skipped++; continue }
    const lgd = String(out.lgd_code ?? '').trim()
    if (lgd && seenCodes.has(lgd)) { skipped++; continue }
    if (lgd) seenCodes.add(lgd)
    let key = `${district}|${taluka}|${squash(name)}`
    let finalName = name
    if (seen.has(key)) {
      // Two different villages with the same name in one taluka (LGD has a few): keep both, told apart by code.
      if (!lgd) { skipped++; continue }
      finalName = `${name} (${lgd})`
      key = `${district}|${taluka}|${squash(finalName)}`
    }
    seen.add(key)
    const int = (v: unknown) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.round(n) : null }
    const titled = finalName === finalName.toUpperCase() ? finalName.toLowerCase().replace(/(^|[\s(-])\p{L}/gu, m => m.toUpperCase()) : finalName
    const gu = String(out.name_gu ?? '').trim()
    villages.push({
      district, taluka, name_en: titled,
      // LGD often repeats the English name in the local-name column: keep it only when it is in Gujarati script.
      name_gu: /[\u0A80-\u0AFF]/.test(gu) ? gu : null,
      lgd_code: lgd || null,
      census_code: String(out.census_code ?? '').trim() || null,
      households: int(out.households), population: int(out.population),
    })
  }
  return { villages, skipped }
}

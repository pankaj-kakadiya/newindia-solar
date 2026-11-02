// The 9-step rooftop solar installation process under PM Surya Ghar + the Gujarat state top-up,
// from first visit to subsidy credit. Each lead keeps its progress in campaign_leads.process:
//   { [stepKey]: { done_at?: 'YYYY-MM-DD', checks?: { [itemKey]: true }, note?: string } }

// Same order as CAMPAIGN_STAGES in surya-ghar-campaign.ts (kept import-free so tests load it directly; a test checks they match).
export const PROCESS_STAGE_ORDER = ['lead', 'registered', 'feasibility_approved', 'survey_done', 'installed', 'commissioned', 'subsidy_received'] as const
const reachedStage = (leadStage: string, stage: string) => {
  if (leadStage === 'lost') return false
  const a = order(leadStage), b = order(stage)
  return a >= 0 && b >= 0 && a >= b
}

export type InstallStep = {
  key: string
  n: number
  title: string
  gu: string
  owner: string
  /** What the step means, in one line, for the team. */
  summary: string
  checklist: [string, string][]
  /** Lead stage reached when this step is done. */
  stage: string
  /** For leads without step records: the stage that shows this step was already done. */
  impliedBy: string
  /** Lead date field filled with the step's done date. */
  dateField?: 'survey_date' | 'install_date' | 'commission_date'
}

export const INSTALL_STEPS: InstallStep[] = [
  {
    key: 'eligibility', n: 1, title: 'Lead & eligibility check', gu: 'લીડ અને પાત્રતા ચકાસણી', owner: 'Field team',
    summary: 'Meet the household, check the roof and connection, collect documents.',
    checklist: [
      ['bill', 'Latest PGVCL electricity bill collected'],
      ['consumer', 'Consumer number checked against the bill'],
      ['owner', 'House owner name matches the bill'],
      ['roof', 'Shadow-free roof: about 10 m² per kW (22 m² for 2.18 kW)'],
      ['load', 'Sanctioned load and monthly units noted'],
      ['aadhaar', 'Aadhaar card copy'],
      ['bank', 'Bank passbook or cancelled cheque'],
      ['category', 'SC/ST certificate (only if SC/ST)'],
      ['contact', 'Mobile number and email ready for OTP'],
    ],
    stage: 'lead', impliedBy: 'registered',
  },
  {
    key: 'registration', n: 2, title: 'National portal registration', gu: 'નેશનલ પોર્ટલ પર નોંધણી', owner: 'Field team with household',
    summary: 'Register on pmsuryaghar.gov.in with the consumer number and mobile OTP.',
    checklist: [
      ['portal', 'Registered on pmsuryaghar.gov.in (State: Gujarat, DISCOM: PGVCL)'],
      ['otp', 'Mobile OTP verified, email added'],
      ['login', 'Logged in with consumer number + mobile'],
      ['appno', 'Registration / application number written on the lead'],
    ],
    stage: 'registered', impliedBy: 'registered',
  },
  {
    key: 'application', n: 3, title: 'Rooftop solar application & vendor choice', gu: 'રૂફટોપ સોલાર અરજી અને વેન્ડર પસંદગી', owner: 'Field team',
    summary: 'Fill the rooftop solar form, choose our PGVCL-registered partner vendor, submit.',
    checklist: [
      ['form', 'Rooftop solar application form filled on the portal'],
      ['size', 'System size entered (2.18 kW for the full state top-up)'],
      ['vendor', 'NewIndia partner vendor selected (PGVCL-registered)'],
      ['upload', 'Electricity bill uploaded'],
      ['submitted', 'Application submitted, acknowledgement saved'],
    ],
    stage: 'registered', impliedBy: 'feasibility_approved',
  },
  {
    key: 'feasibility', n: 4, title: 'PGVCL feasibility approval', gu: 'PGVCL ટેક્નિકલ ફિઝિબિલિટી મંજૂરી', owner: 'PGVCL (we follow up)',
    summary: 'PGVCL checks the connection and approves technical feasibility on the portal.',
    checklist: [
      ['followup', 'Followed up with the PGVCL sub-division office'],
      ['approved', 'Feasibility shown as approved on the portal'],
      ['informed', 'Household informed and survey date agreed'],
    ],
    stage: 'feasibility_approved', impliedBy: 'feasibility_approved',
  },
  {
    key: 'survey', n: 5, title: 'Site survey, design & agreement', gu: 'સાઇટ સર્વે, ડિઝાઇન અને કરાર', owner: 'Technical team',
    summary: 'Survey the roof, finalise the layout and price, sign the agreement, collect the household share.',
    checklist: [
      ['photos', 'Roof photos and measurements taken'],
      ['layout', 'Panel layout, structure height and cable route decided'],
      ['final', 'System size and price confirmed with the household'],
      ['agreement', 'Agreement signed with the household'],
      ['payment', 'Household share collected or bank loan sanctioned'],
    ],
    stage: 'survey_done', impliedBy: 'survey_done', dateField: 'survey_date',
  },
  {
    key: 'installation', n: 6, title: 'Material dispatch & installation', gu: 'માલ મોકલવો અને ઇન્સ્ટોલેશન', owner: 'Installation team',
    summary: 'Dispatch the kit and install panels, inverter, ACDB/DCDB, earthing and lightning arrester.',
    checklist: [
      ['modules', 'ALMM / DCR solar modules installed, serial numbers noted'],
      ['inverter', 'Inverter installed, serial number noted'],
      ['boxes', 'NewIndia ACDB and DCDB fitted'],
      ['structure', 'Mounting structure fixed and sealed'],
      ['earthing', 'Earthing (3 pits) and lightning arrester done'],
      ['cabling', 'DC/AC cabling in conduit, labels on'],
      ['photos', 'Photos with the household beside the system'],
    ],
    stage: 'installed', impliedBy: 'installed', dateField: 'install_date',
  },
  {
    key: 'net_meter', n: 7, title: 'Installation details & net-meter application', gu: 'ઇન્સ્ટોલેશન વિગતો અને નેટ મીટર અરજી', owner: 'Back office',
    summary: 'Upload installation details on the portal and apply for the net meter.',
    checklist: [
      ['details', 'Installation details uploaded (module and inverter serials, photos)'],
      ['netmeter', 'Net-meter application submitted'],
      ['documents', 'Vendor documents and test report uploaded'],
    ],
    stage: 'installed', impliedBy: 'commissioned',
  },
  {
    key: 'commissioning', n: 8, title: 'PGVCL inspection, net meter & commissioning', gu: 'PGVCL તપાસ, નેટ મીટર અને કમિશનિંગ', owner: 'PGVCL (we attend)',
    summary: 'PGVCL inspects, installs the net meter and the commissioning certificate is issued on the portal.',
    checklist: [
      ['inspection', 'PGVCL inspection done'],
      ['meter', 'Bi-directional net meter installed'],
      ['certificate', 'Commissioning certificate generated on the portal'],
    ],
    stage: 'commissioned', impliedBy: 'commissioned', dateField: 'commission_date',
  },
  {
    key: 'subsidy', n: 9, title: 'Bank details, subsidy & handover', gu: 'બેંક વિગતો, સબસિડી અને હેન્ડઓવર', owner: 'Back office',
    summary: 'Submit bank details on the portal, track both subsidies, hand over warranty papers.',
    checklist: [
      ['bankdetails', 'Bank details and cancelled cheque submitted on the portal'],
      ['central', 'Central subsidy credited'],
      ['state', 'Gujarat state top-up credited'],
      ['handover', 'Warranty card, user guide and cleaning tips handed over'],
      ['review', 'Household feedback / referral asked'],
    ],
    stage: 'subsidy_received', impliedBy: 'subsidy_received',
  },
]

export type StepRecord = { done_at?: string | null; checks?: Record<string, boolean>; note?: string | null }
export type LeadProcess = Record<string, StepRecord>
type LeadLike = { stage?: string | null; process?: LeadProcess | null }

function order(stage: string) { return (PROCESS_STAGE_ORDER as readonly string[]).indexOf(stage) }

/** True when the step is done: marked done, or (with no record for it) the lead's stage shows it happened. */
export function stepDone(lead: LeadLike, step: InstallStep) {
  const rec = lead.process?.[step.key]
  if (rec && 'done_at' in rec) return Boolean(rec.done_at)
  return reachedStage(String(lead.stage || 'lead'), step.impliedBy)
}

/** Ticked items out of the step's checklist. */
export function stepChecks(lead: LeadLike, step: InstallStep) {
  const checks = lead.process?.[step.key]?.checks || {}
  return step.checklist.filter(([k]) => checks[k]).length
}

/** The first step not yet done (10 when all nine are done), and how many are done. */
export function processProgress(lead: LeadLike) {
  const done = INSTALL_STEPS.map(s => stepDone(lead, s))
  const first = done.findIndex(d => !d)
  return { done: done.filter(Boolean).length, current: first < 0 ? INSTALL_STEPS.length + 1 : first + 1 }
}

/** The lead stage that the completed steps add up to (the furthest stage of any done step). */
export function stageFromProcess(lead: LeadLike) {
  let best = 'lead'
  for (const s of INSTALL_STEPS) if (stepDone(lead, s) && order(s.stage) > order(best)) best = s.stage
  return best
}

/**
 * Marks a step done (date) or not done (null), returning the patch to save on the lead:
 * the new process, the stage the steps now add up to (a lost lead stays lost) and the matching date field.
 */
export function setStepDone(lead: LeadLike & Record<string, any>, stepKey: string, doneAt: string | null) {
  const step = INSTALL_STEPS.find(s => s.key === stepKey)
  if (!step) throw new Error(`Unknown step ${stepKey}`)
  const process: LeadProcess = { ...(lead.process || {}) }
  // Steps so far only implied by the lead's stage are written down first, so changing one step never un-does the others.
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
  for (const s of INSTALL_STEPS) if (s.key !== stepKey && !(process[s.key] && 'done_at' in process[s.key]) && stepDone(lead, s)) process[s.key] = { ...(process[s.key] || {}), done_at: (s.dateField && lead[s.dateField] ? String(lead[s.dateField]).slice(0, 10) : '') || doneAt || today }
  process[stepKey] = { ...(process[stepKey] || {}), done_at: doneAt }
  const patch: Record<string, any> = { process }
  if (lead.stage !== 'lost') patch.stage = stageFromProcess({ process, stage: 'lead' })
  if (step.dateField && doneAt && !lead[step.dateField]) patch[step.dateField] = doneAt
  if (stepKey === 'registration' && doneAt) patch.portal_registered = true
  if (stepKey === 'subsidy') {
    const checks = process.subsidy?.checks || {}
    if (checks.central) patch.central_subsidy_received = true
    if (checks.state) patch.state_subsidy_received = true
  }
  return patch
}

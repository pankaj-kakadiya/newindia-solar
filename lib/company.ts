export const COMPANY = {
  legalName: 'New India Solar Components Pvt Ltd',
  tradeName: 'New India Solar',
  gstin: '24AALCN7372A1ZJ',
  addressLine1: '3 Floor, 315-KBC (Karunesh Business Center)',
  addressLine2: 'Opp. KBC4, Yogichowk',
  city: 'Surat',
  state: 'Gujarat',
  postalCode: '395010',
  country: 'India',
  website: 'newindiasolar.com',
} as const

export const COMPANY_ADDRESS = `${COMPANY.addressLine1}, ${COMPANY.addressLine2}, ${COMPANY.city}, ${COMPANY.state} ${COMPANY.postalCode}, ${COMPANY.country}`

import type {Metadata} from 'next'
import type {ReactNode} from 'react'

export const metadata: Metadata = {
  title: 'Bulk ACDB & DCDB Pricing – Project RFQ | New India Solar',
  description: 'Send one requirement for solar ACDB, DCDB and ACDB + DCDB combo boxes. EPCs, dealers and installers get project pricing, GST invoice and dispatch timing.',
  alternates: {canonical: '/bulk-order'},
}

export default function BulkOrderLayout({children}: {children: ReactNode}) {
  return children
}

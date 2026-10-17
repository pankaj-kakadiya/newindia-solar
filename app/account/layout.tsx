import type {Metadata} from 'next'
import type {ReactNode} from 'react'

export const metadata: Metadata = {
  title: 'My Account | New India Solar',
  robots: {index: false, follow: false},
}

export default function PrivatePageLayout({children}: {children: ReactNode}) {
  return children
}

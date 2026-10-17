import type {Metadata} from 'next'
import type {ReactNode} from 'react'

export const metadata: Metadata = {
  title: 'Your Cart | New India Solar',
  robots: {index: false, follow: false},
}

export default function PrivatePageLayout({children}: {children: ReactNode}) {
  return children
}

'use client'

import {usePathname} from 'next/navigation'
import {useEffect, useRef} from 'react'

// Meta Pixel only records the first page load; report client-side route changes too.
// (GA4 enhanced measurement already tracks history changes on its own.)
export default function RouteTracker() {
  const pathname = usePathname()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {first.current = false; return}
    if (pathname.startsWith('/admin')) return
    try {
      const fbq = (window as unknown as {fbq?: (...args: unknown[]) => void}).fbq
      if (typeof fbq === 'function') fbq('track', 'PageView')
    } catch {/* never block navigation */}
  }, [pathname])
  return null
}

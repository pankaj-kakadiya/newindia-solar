import './globals.css'
import './brand.css'
import './upgrade.css'
import './upgrade2.css'
import './upgrade3.css'
import './upgrade4.css'
import './upgrade5.css'
import type { Metadata } from 'next'
import { CartProvider } from '../components/CartProvider'
import ThemeProvider from '../components/ThemeProvider'
import CartLink from '../components/CartLink'

export const metadata: Metadata = {
  title: 'New India Solar | ACDB, DCDB & Solar Components',
  description: 'Shop ACDB, DCDB, MCB, SPD, solar cable, earthing kits and customize ACDB/DCDB boxes for solar installations.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ThemeProvider><CartProvider>{children}<CartLink/></CartProvider></ThemeProvider></body></html>
}

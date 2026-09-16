'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell, Boxes, ChevronDown, ChevronLeft, ChevronRight, Command, ExternalLink,
  Factory, FileText, IndianRupee, KeyRound, LayoutDashboard, LogOut, Menu,
  Package, Palette, Search, Settings, ShoppingCart, SlidersHorizontal, Users,
  Warehouse, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

type BadgeKey = 'orders' | 'production' | 'rfqs'
type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; badge?: BadgeKey }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  { label: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Sales', items: [
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, badge: 'orders' },
    { href: '/admin/rfqs', label: 'Bulk RFQs', icon: FileText, badge: 'rfqs' },
    { href: '/admin/customers', label: 'Customers', icon: Users },
  ]},
  { label: 'Catalogue', items: [
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/components', label: 'Components', icon: Boxes },
    { href: '/admin/inventory', label: 'Inventory', icon: Warehouse },
  ]},
  { label: 'Procurement', items: [{ href: '/admin/purchasing', label: 'Suppliers & Purchasing', icon: ShoppingCart }] },
  { label: 'Commercial', items: [
    { href: '/admin/pricing', label: 'Pricing & Margins', icon: IndianRupee },
    { href: '/admin/finance', label: 'Finance & GST', icon: FileText },
  ]},
  { label: 'Configurator', items: [{ href: '/admin/configurator', label: 'ACDB / DCDB Builder', icon: SlidersHorizontal }] },
  { label: 'Operations', items: [{ href: '/admin/production', label: 'Production', icon: Factory, badge: 'production' }] },
  { label: 'Settings', items: [
    { href: '/admin/theme', label: 'Brand & Theme', icon: Palette },
    { href: '/admin/change-password', label: 'Security', icon: KeyRound },
  ]},
]

const flatNav = navGroups.flatMap(group => group.items.map(item => ({ ...item, group: group.label })))
function routeTitle(path: string) {
  if (path === '/admin') return 'Dashboard'
  const exact = flatNav.find(item => path === item.href || path.startsWith(item.href + '/'))
  return exact?.label || 'Control Center'
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [email, setEmail] = useState('Admin')
  const [role, setRole] = useState('admin')
  const [environment, setEnvironment] = useState('STAGING')
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ orders: 0, production: 0, rfqs: 0 })
  const searchRef = useRef<HTMLInputElement>(null)
  const isLogin = pathname === '/admin/login'

  useEffect(() => {
    if (isLogin) return
    const saved = window.localStorage.getItem('nis-admin-sidebar-collapsed')
    if (saved === '1') setCollapsed(true)
    const host = window.location.hostname
    setEnvironment(host.includes('vercel.app') || host.includes('localhost') ? 'STAGING' : 'PRODUCTION')
  }, [isLogin])

  useEffect(() => {
    if (isLogin) return
    let alive = true
    ;(async () => {
      const [{ data: auth }, orderRes, productionRes, rfqRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'confirmed', 'processing']),
        supabase.from('production_jobs').select('*', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
        supabase.from('bulk_rfqs').select('*', { count: 'exact', head: true }).in('status', ['new', 'contacted', 'quoted']),
      ])
      if (!alive) return
      if (auth.user?.email) setEmail(auth.user.email)
      if (auth.user?.id) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
        if (alive && profile?.role) setRole(profile.role)
      }
      setBadges({ orders: orderRes.count || 0, production: productionRes.count || 0, rfqs: rfqRes.count || 0 })
    })()
    return () => { alive = false }
  }, [isLogin, pathname])

  useEffect(() => {
    if (isLogin) return
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true) }
      if (event.key === 'Escape') { setSearchOpen(false); setMobileOpen(false); setNotificationsOpen(false); setActionsOpen(false); setProfileOpen(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isLogin])

  useEffect(() => {
    if (!searchOpen) return
    const id = window.setTimeout(() => searchRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [searchOpen])

  useEffect(() => {
    setMobileOpen(false); setNotificationsOpen(false); setActionsOpen(false); setProfileOpen(false); setSearchOpen(false); setSearch('')
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [mobileOpen])

  const filteredNav = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return flatNav
    return flatNav.filter(item => `${item.label} ${item.group}`.toLowerCase().includes(q))
  }, [search])

  const totalAlerts = badges.orders + badges.production + badges.rfqs
  const displayName = email === 'Admin' ? 'Admin' : email.split('@')[0].replace(/[._-]+/g, ' ')
  function toggleCollapsed() {
    setCollapsed(value => { const next = !value; window.localStorage.setItem('nis-admin-sidebar-collapsed', next ? '1' : '0'); return next })
  }
  async function logout() { await supabase.auth.signOut(); router.replace('/admin/login') }
  if (isLogin) return <>{children}</>

  return <div className={`adminV2 ${collapsed ? 'isCollapsed' : ''}`}>
    <button className={`adminV2Overlay ${mobileOpen ? 'show' : ''}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
    <aside className={`adminV2Sidebar ${mobileOpen ? 'mobileOpen' : ''}`}>
      <div className="adminV2BrandRow">
        <Link href="/admin" className="adminV2Brand" aria-label="New India Solar admin dashboard">
          <span className="adminV2LogoBox"><img src="/new-india-solar-full-logo.webp" alt="New India Solar" /></span>
          <span className="adminV2BrandCopy"><b>Control Center</b><small>New India Solar</small></span>
        </Link>
        <button className="adminV2MobileClose" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="adminV2Environment"><span className={environment === 'PRODUCTION' ? 'live' : 'stage'} /><span>{environment}</span></div>
      <nav className="adminV2Nav" aria-label="Admin navigation">
        {navGroups.map(group => <section className="adminV2NavGroup" key={group.label}>
          <div className="adminV2GroupLabel">{group.label}</div>
          {group.items.map(item => {
            const Icon = item.icon
            const active = item.href === '/admin' ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
            const count = item.badge ? badges[item.badge] : 0
            return <Link href={item.href} key={item.href} className={`adminV2NavItem ${active ? 'active' : ''}`} title={collapsed ? item.label : undefined}>
              <span className="adminV2NavIcon"><Icon size={18} strokeWidth={1.9} /></span><span className="adminV2NavLabel">{item.label}</span>{count > 0 && <span className="adminV2NavBadge">{count > 99 ? '99+' : count}</span>}
            </Link>
          })}
        </section>)}
      </nav>
      <div className="adminV2SidebarFooter">
        <a className="adminV2StoreLink" href="/" target="_blank" rel="noreferrer" title="Open storefront"><ExternalLink size={17} /><span>View Store</span></a>
        <button className="adminV2Collapse" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}<span>Collapse</span></button>
      </div>
    </aside>

    <div className="adminV2Main">
      <header className="adminV2Topbar">
        <div className="adminV2TopbarLeft">
          <button className="adminV2MenuButton" onClick={() => setMobileOpen(true)} aria-label="Open admin navigation"><Menu size={20} /></button>
          <div className="adminV2PageIdentity"><small>New India Solar</small><b>{routeTitle(pathname)}</b></div>
        </div>
        <div className="adminV2TopbarRight">
          <button className="adminV2SearchButton" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Search admin</span><kbd><Command size={12} />K</kbd></button>
          <div className="adminV2DropWrap">
            <button className="adminV2QuickButton" onClick={() => setActionsOpen(v => !v)} aria-expanded={actionsOpen}><span>Quick Actions</span><ChevronDown size={15} /></button>
            {actionsOpen && <div className="adminV2Dropdown adminV2QuickMenu">
              <Link href="/admin/products">Manage products <span>→</span></Link>
              <Link href="/admin/components">Manage components <span>→</span></Link>
              <Link href="/admin/purchasing">Open purchasing <span>→</span></Link>
              <Link href="/admin/pricing">Pricing & margins <span>→</span></Link>
              <Link href="/admin/finance">Finance & GST <span>→</span></Link>
              <Link href="/admin/configurator">Open configurator <span>→</span></Link>
              <Link href="/admin/orders">Review orders <span>→</span></Link>
            </div>}
          </div>
          <div className="adminV2DropWrap">
            <button className="adminV2IconButton" onClick={() => setNotificationsOpen(v => !v)} aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={18} />{totalAlerts > 0 && <span className="adminV2AlertDot">{totalAlerts > 9 ? '9+' : totalAlerts}</span>}</button>
            {notificationsOpen && <div className="adminV2Dropdown adminV2Notifications">
              <div className="adminV2DropdownHead"><b>Needs attention</b><small>{totalAlerts} open</small></div>
              <Link href="/admin/orders"><span><ShoppingCart size={16} /> Open orders</span><b>{badges.orders}</b></Link>
              <Link href="/admin/production"><span><Factory size={16} /> Production queue</span><b>{badges.production}</b></Link>
              <Link href="/admin/rfqs"><span><FileText size={16} /> Active RFQs</span><b>{badges.rfqs}</b></Link>
            </div>}
          </div>
          <div className="adminV2DropWrap">
            <button className="adminV2ProfileButton" onClick={() => setProfileOpen(v => !v)} aria-expanded={profileOpen}><span className="adminV2Avatar">{displayName.slice(0, 1).toUpperCase()}</span><span className="adminV2ProfileCopy"><b>{displayName}</b><small>{role}</small></span><ChevronDown size={14} /></button>
            {profileOpen && <div className="adminV2Dropdown adminV2ProfileMenu">
              <div className="adminV2ProfileEmail"><small>Signed in as</small><b>{email}</b></div>
              <Link href="/admin/change-password"><KeyRound size={16} /> Change password</Link>
              <Link href="/admin/theme"><Settings size={16} /> Store settings</Link>
              <button onClick={logout}><LogOut size={16} /> Sign out</button>
            </div>}
          </div>
        </div>
      </header>
      <main className="adminV2Content">{children}</main>
    </div>

    {searchOpen && <div className="adminV2CommandBackdrop" onMouseDown={() => setSearchOpen(false)}>
      <div className="adminV2Command" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Search admin">
        <div className="adminV2CommandInput"><Search size={20} /><input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pages, tools and settings…" aria-label="Search admin pages" /><button onClick={() => setSearchOpen(false)}>ESC</button></div>
        <div className="adminV2CommandResults">
          {filteredNav.length ? filteredNav.map(item => { const Icon = item.icon; return <Link href={item.href} key={item.href}><span className="adminV2CommandIcon"><Icon size={17} /></span><span><b>{item.label}</b><small>{item.group}</small></span><ChevronRight size={16} /></Link> }) : <div className="adminV2CommandEmpty">No admin page matches “{search}”.</div>}
        </div>
        <div className="adminV2CommandFooter"><span>Navigate with search</span><span>⌘K anytime · Esc to close</span></div>
      </div>
    </div>}
  </div>
}

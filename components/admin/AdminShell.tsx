'use client'

import Link from 'next/link'
import {usePathname,useRouter} from 'next/navigation'
import {useEffect,useMemo,useRef,useState} from 'react'
import {BarChart3,Bell,Boxes,ChevronDown,ChevronLeft,ChevronRight,Command,ExternalLink,Factory,FileText,GitBranch,Globe2,IndianRupee,KeyRound,LayoutDashboard,LogOut,Menu,Package,Palette,Search,Settings,ShieldCheck,ShoppingCart,SlidersHorizontal,Users,Warehouse,X} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {AdminAccess,adminRoleLabels,canAdmin} from '../../lib/adminAccess'

type BadgeKey='orders'|'production'|'rfqs'|'alerts'
type NavItem={href:string;label:string;icon:React.ComponentType<{size?:number;strokeWidth?:number}>;badge?:BadgeKey;module?:string}
type NavGroup={label:string;items:NavItem[]}
type WorkflowAlert={id:string;severity:string;title:string;message:string|null;href:string|null;is_read:boolean;module_key:string}
type GlobalResult={result_type:string;result_id:string;module_key:string;title:string;subtitle:string|null;identifier:string|null;status:string|null;amount:number|null;href:string;updated_at:string|null;rank:number}
const navGroups:NavGroup[]=[
 {label:'Overview',items:[{href:'/admin',label:'Dashboard',icon:LayoutDashboard,module:'dashboard'},{href:'/admin/search',label:'Global Search',icon:Search,module:'search'},{href:'/admin/imports',label:'Bulk Operations & Imports',icon:FileText,module:'imports'},{href:'/admin/notifications',label:'Notifications & Tasks',icon:Bell,badge:'alerts',module:'notifications'},{href:'/admin/workflows',label:'Workflow Automation',icon:GitBranch,module:'workflows'},{href:'/admin/reports',label:'Reports & Analytics',icon:BarChart3,module:'reports'}]},
 {label:'Sales',items:[{href:'/admin/orders',label:'Orders',icon:ShoppingCart,badge:'orders',module:'orders'},{href:'/admin/rfqs',label:'Bulk RFQs',icon:FileText,badge:'rfqs',module:'rfqs'},{href:'/admin/customers',label:'Customers',icon:Users,module:'customers'}]},
 {label:'Catalogue',items:[{href:'/admin/products',label:'Products',icon:Package,module:'products'},{href:'/admin/components',label:'Components',icon:Boxes,module:'components'},{href:'/admin/inventory',label:'Inventory',icon:Warehouse,module:'inventory'}]},
 {label:'Procurement',items:[{href:'/admin/purchasing',label:'Suppliers & Purchasing',icon:ShoppingCart,module:'purchasing'}]},
 {label:'Commercial',items:[{href:'/admin/pricing',label:'Pricing & Margins',icon:IndianRupee,module:'pricing'},{href:'/admin/finance',label:'Finance & GST',icon:FileText,module:'finance'}]},
 {label:'Configurator',items:[{href:'/admin/configurator',label:'ACDB / DCDB Builder',icon:SlidersHorizontal,module:'configurator'}]},
 {label:'Operations',items:[{href:'/admin/production',label:'Production',icon:Factory,badge:'production',module:'production'}]},
 {label:'Website',items:[{href:'/admin/content',label:'Content & CMS',icon:Globe2,module:'content'},{href:'/admin/theme',label:'Brand & Theme',icon:Palette,module:'theme'}]},
 {label:'Settings',items:[{href:'/admin/access',label:'Roles & Audit',icon:ShieldCheck,module:'security'},{href:'/admin/change-password',label:'Change Password',icon:KeyRound}]}
]
const flatNav=navGroups.flatMap(group=>group.items.map(item=>({...item,group:group.label})))
const typeLabel:Record<string,string>={order:'Order',customer:'Customer',product:'Product',component:'Component',supplier:'Supplier',purchase_order:'PO',grn:'GRN',invoice:'Invoice',rfq:'RFQ',production_job:'Job'}
function routeTitle(path:string){if(path==='/admin')return'Dashboard';const exact=flatNav.find(item=>path===item.href||path.startsWith(item.href+'/'));return exact?.label||'Control Center'}

export default function AdminShell({children}:{children:React.ReactNode}){
 const pathname=usePathname(),router=useRouter()
 const [mobileOpen,setMobileOpen]=useState(false),[collapsed,setCollapsed]=useState(false),[searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState(''),[notificationsOpen,setNotificationsOpen]=useState(false),[actionsOpen,setActionsOpen]=useState(false),[profileOpen,setProfileOpen]=useState(false),[email,setEmail]=useState('Admin'),[environment,setEnvironment]=useState('STAGING'),[badges,setBadges]=useState<Record<BadgeKey,number>>({orders:0,production:0,rfqs:0,alerts:0}),[access,setAccess]=useState<AdminAccess|null>(null),[workflowAlerts,setWorkflowAlerts]=useState<WorkflowAlert[]>([]),[globalResults,setGlobalResults]=useState<GlobalResult[]>([]),[globalSearching,setGlobalSearching]=useState(false)
 const searchRef=useRef<HTMLInputElement>(null),isLogin=pathname==='/admin/login'

 useEffect(()=>{if(isLogin)return;const saved=window.localStorage.getItem('nis-admin-sidebar-collapsed');if(saved==='1')setCollapsed(true);const host=window.location.hostname;setEnvironment(host.includes('vercel.app')||host.includes('localhost')?'STAGING':'PRODUCTION')},[isLogin])
 useEffect(()=>{if(isLogin)return;let alive=true;(async()=>{
   const [{data:auth},{data:accessData}]=await Promise.all([supabase.auth.getUser(),supabase.rpc('get_my_admin_access')])
   if(!alive)return
   if(auth.user?.email)setEmail(auth.user.email)
   const a=(accessData||null) as AdminAccess|null;setAccess(a)
   const next:Record<BadgeKey,number>={orders:0,production:0,rfqs:0,alerts:0}
   const tasks:Promise<void>[]=[]
   if(canAdmin(a,'orders'))tasks.push(Promise.resolve(supabase.from('orders').select('*',{count:'exact',head:true}).in('status',['pending','confirmed','processing'])).then(({count})=>{next.orders=count||0}))
   if(canAdmin(a,'production'))tasks.push(Promise.resolve(supabase.from('production_jobs').select('*',{count:'exact',head:true}).not('status','in','("completed","cancelled")')).then(({count})=>{next.production=count||0}))
   if(canAdmin(a,'rfqs'))tasks.push(Promise.resolve(supabase.from('bulk_rfqs').select('*',{count:'exact',head:true}).in('status',['new','qualified','contacted','quote_preparing','quoted','negotiation'])).then(({count})=>{next.rfqs=count||0}))
   if(canAdmin(a,'notifications'))tasks.push((async()=>{if(canAdmin(a,'workflows'))await supabase.rpc('workflow_run_sla_sweep');await supabase.rpc('refresh_workflow_notifications');const {data}=await supabase.rpc('workflow_notification_feed',{p_limit:6});const rows=(data||[]) as WorkflowAlert[];if(alive){setWorkflowAlerts(rows);next.alerts=rows.filter(x=>!x.is_read).length}})())
   await Promise.all(tasks);if(alive)setBadges({...next})
 })();return()=>{alive=false}},[isLogin,pathname])
 useEffect(()=>{if(isLogin)return;function onKeyDown(event:KeyboardEvent){if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true)}if(event.key==='Escape'){setSearchOpen(false);setMobileOpen(false);setNotificationsOpen(false);setActionsOpen(false);setProfileOpen(false)}}window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[isLogin])
 useEffect(()=>{if(!searchOpen)return;const id=window.setTimeout(()=>searchRef.current?.focus(),40);return()=>window.clearTimeout(id)},[searchOpen])
 useEffect(()=>{if(!searchOpen||!canAdmin(access,'search')){setGlobalResults([]);setGlobalSearching(false);return}const q=search.trim();if(q.length<2){setGlobalResults([]);setGlobalSearching(false);return}let alive=true;const timer=window.setTimeout(async()=>{setGlobalSearching(true);const {data}=await supabase.rpc('admin_global_search',{p_query:q,p_limit:10});if(alive){setGlobalResults((data||[]) as GlobalResult[]);setGlobalSearching(false)}},160);return()=>{alive=false;window.clearTimeout(timer)}},[searchOpen,search,access])
 useEffect(()=>{setMobileOpen(false);setNotificationsOpen(false);setActionsOpen(false);setProfileOpen(false);setSearchOpen(false);setSearch('');setGlobalResults([])},[pathname])
 useEffect(()=>{if(!mobileOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[mobileOpen])

 const visibleGroups=useMemo(()=>navGroups.map(group=>({...group,items:group.items.filter(item=>!item.module||canAdmin(access,item.module,'view'))})).filter(group=>group.items.length),[access])
 const visibleFlat=useMemo(()=>visibleGroups.flatMap(group=>group.items.map(item=>({...item,group:group.label}))),[visibleGroups])
 const filteredNav=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return visibleFlat;return visibleFlat.filter(item=>`${item.label} ${item.group}`.toLowerCase().includes(q))},[search,visibleFlat])
 const totalAlerts=badges.alerts,displayName=email==='Admin'?'Admin':email.split('@')[0].replace(/[._-]+/g,' '),roleLabel=adminRoleLabels[access?.admin_role||access?.role||'admin']||access?.admin_role||access?.role||'Staff'
 function toggleCollapsed(){setCollapsed(value=>{const next=!value;window.localStorage.setItem('nis-admin-sidebar-collapsed',next?'1':'0');return next})}
 async function logout(){await supabase.auth.signOut();router.replace('/admin/login')}
 async function readAlert(id:string){await supabase.rpc('workflow_mark_notification',{p_notification_id:id,p_action:'read'});setWorkflowAlerts(rows=>rows.map(x=>x.id===id?{...x,is_read:true}:x));setBadges(b=>({...b,alerts:Math.max(0,b.alerts-1)}))}
 function openFirstResult(){if(globalResults[0]){router.push(globalResults[0].href);setSearchOpen(false);return}if(filteredNav[0]){router.push(filteredNav[0].href);setSearchOpen(false)}}
 if(isLogin)return <>{children}</>

 return <div className={`adminV2 ${collapsed?'isCollapsed':''}`}>
  <button className={`adminV2Overlay ${mobileOpen?'show':''}`} aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>
  <aside className={`adminV2Sidebar ${mobileOpen?'mobileOpen':''}`}>
   <div className="adminV2BrandRow"><Link href="/admin" className="adminV2Brand" aria-label="New India Solar admin dashboard"><span className="adminV2LogoBox"><img src="/new-india-solar-full-logo.webp" alt="New India Solar"/></span><span className="adminV2BrandCopy"><b>Control Center</b><small>New India Solar</small></span></Link><button className="adminV2MobileClose" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"><X size={18}/></button></div>
   <div className="adminV2Environment"><span className={environment==='PRODUCTION'?'live':'stage'}/><span>{environment}</span></div>
   <nav className="adminV2Nav" aria-label="Admin navigation">{visibleGroups.map(group=><section className="adminV2NavGroup" key={group.label}><div className="adminV2GroupLabel">{group.label}</div>{group.items.map(item=>{const Icon=item.icon;const active=item.href==='/admin'?pathname===item.href:pathname===item.href||pathname.startsWith(item.href+'/');const count=item.badge?badges[item.badge]:0;return <Link href={item.href} key={item.href} className={`adminV2NavItem ${active?'active':''}`} title={collapsed?item.label:undefined}><span className="adminV2NavIcon"><Icon size={18} strokeWidth={1.9}/></span><span className="adminV2NavLabel">{item.label}</span>{count>0&&<span className="adminV2NavBadge">{count>99?'99+':count}</span>}</Link>})}</section>)}</nav>
   <div className="adminV2SidebarFooter"><a className="adminV2StoreLink" href="/" target="_blank" rel="noreferrer"><ExternalLink size={17}/><span>View Store</span></a><button className="adminV2Collapse" onClick={toggleCollapsed}>{collapsed?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}<span>Collapse</span></button></div>
  </aside>

  <div className="adminV2Main"><header className="adminV2Topbar"><div className="adminV2TopbarLeft"><button className="adminV2MenuButton" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="adminV2PageIdentity"><small>New India Solar</small><b>{routeTitle(pathname)}</b></div></div><div className="adminV2TopbarRight">
   <button className="adminV2SearchButton" onClick={()=>setSearchOpen(true)}><Search size={17}/><span>Search everything</span><kbd><Command size={12}/>K</kbd></button>
   <div className="adminV2DropWrap"><button className="adminV2QuickButton" onClick={()=>setActionsOpen(v=>!v)}><span>Quick Actions</span><ChevronDown size={15}/></button>{actionsOpen&&<div className="adminV2Dropdown adminV2QuickMenu">
    {canAdmin(access,'search')&&<Link href="/admin/search">Global search <span>→</span></Link>}{canAdmin(access,'imports')&&<Link href="/admin/imports">Bulk operations & imports <span>→</span></Link>}{canAdmin(access,'workflows')&&<Link href="/admin/workflows">Workflow automation <span>→</span></Link>}{canAdmin(access,'notifications')&&<Link href="/admin/notifications">Notifications & tasks <span>→</span></Link>}{canAdmin(access,'content')&&<Link href="/admin/content">Website content <span>→</span></Link>}{canAdmin(access,'reports')&&<Link href="/admin/reports">Reports & analytics <span>→</span></Link>}{canAdmin(access,'products')&&<Link href="/admin/products">Manage products <span>→</span></Link>}{canAdmin(access,'purchasing')&&<Link href="/admin/purchasing">Open purchasing <span>→</span></Link>}{canAdmin(access,'pricing')&&<Link href="/admin/pricing">Pricing & margins <span>→</span></Link>}{canAdmin(access,'finance')&&<Link href="/admin/finance">Finance & GST <span>→</span></Link>}{canAdmin(access,'configurator')&&<Link href="/admin/configurator">Open configurator <span>→</span></Link>}{canAdmin(access,'orders')&&<Link href="/admin/orders">Review orders <span>→</span></Link>}{canAdmin(access,'security')&&<Link href="/admin/access">Roles & audit <span>→</span></Link>}
   </div>}</div>
   {canAdmin(access,'notifications')&&<div className="adminV2DropWrap"><button className="adminV2IconButton" onClick={()=>setNotificationsOpen(v=>!v)} aria-label="Notifications"><Bell size={18}/>{totalAlerts>0&&<span className="adminV2AlertDot">{totalAlerts>9?'9+':totalAlerts}</span>}</button>{notificationsOpen&&<div className="adminV2Dropdown adminV2Notifications"><div className="adminV2DropdownHead"><b>Workflow alerts</b><small>{totalAlerts} unread</small></div>{workflowAlerts.length?workflowAlerts.slice(0,5).map(a=><Link href={a.href||'/admin/notifications'} key={a.id} className={`workflowMini ${a.severity}`} onClick={()=>{if(!a.is_read)readAlert(a.id)}}><i/><span><b>{a.title}</b><small>{a.message||a.module_key}</small></span></Link>):<Link href="/admin/notifications"><span>No active alerts</span><b>✓</b></Link>}<Link href="/admin/notifications" className="workflowViewAll">View notification center →</Link></div>}</div>}
   <div className="adminV2DropWrap"><button className="adminV2ProfileButton" onClick={()=>setProfileOpen(v=>!v)}><span className="adminV2Avatar">{displayName.slice(0,1).toUpperCase()}</span><span className="adminV2ProfileCopy"><b>{displayName}</b><small>{roleLabel}</small></span><ChevronDown size={14}/></button>{profileOpen&&<div className="adminV2Dropdown adminV2ProfileMenu"><div className="adminV2ProfileEmail"><small>Signed in as</small><b>{email}</b></div><Link href="/admin/change-password"><KeyRound size={16}/> Change password</Link>{canAdmin(access,'security')&&<Link href="/admin/access"><ShieldCheck size={16}/> Roles & audit</Link>}{canAdmin(access,'content')&&<Link href="/admin/content"><Globe2 size={16}/> Website content</Link>}{canAdmin(access,'theme')&&<Link href="/admin/theme"><Settings size={16}/> Brand & theme</Link>}<button onClick={logout}><LogOut size={16}/> Sign out</button></div>}</div>
  </div></header><main className="adminV2Content">{children}</main></div>

  {searchOpen&&<div className="adminV2CommandBackdrop" onMouseDown={()=>setSearchOpen(false)}><div className="adminV2Command" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true"><div className="adminV2CommandInput"><Search size={20}/><input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();openFirstResult()}}} placeholder="Order, customer, GSTIN, phone, SKU, PO, GRN, invoice, RFQ…"/><button onClick={()=>setSearchOpen(false)}>ESC</button></div><div className="adminV2CommandResults">
   {search.trim().length>=2&&<><div className="globalCmdSectionLabel">ERP records</div>{globalSearching?<div className="globalCmdLoading">Searching permitted records…</div>:globalResults.length?globalResults.map(r=><Link href={r.href} key={`${r.result_type}-${r.result_id}`} className="globalCmdResult"><i>{typeLabel[r.result_type]||r.result_type}</i><span><b>{r.title}</b><small>{r.subtitle||r.status||r.module_key}</small></span>{r.identifier&&<code>{r.identifier}</code>}</Link>):<div className="globalCmdLoading">No matching ERP records.</div>}</>}
   {filteredNav.length>0&&<><div className="globalCmdSectionLabel">Pages & tools</div>{filteredNav.slice(0,8).map(item=>{const Icon=item.icon;return <Link href={item.href} key={item.href}><span className="adminV2CommandIcon"><Icon size={17}/></span><span><b>{item.label}</b><small>{item.group}</small></span><ChevronRight size={16}/></Link>})}</>}
   {search.trim().length>=2&&canAdmin(access,'search')&&<Link href="/admin/search" className="globalCmdResult"><i>All</i><span><b>Open Global Search</b><small>Search up to 80 results with filters and recent items</small></span><ChevronRight size={16}/></Link>}
   {!globalSearching&&!globalResults.length&&!filteredNav.length&&<div className="adminV2CommandEmpty">No permitted page or record matches “{search}”.</div>}
  </div><div className="adminV2CommandFooter"><span>Role-filtered search · {roleLabel}</span><span>Enter opens first match · Esc closes</span></div></div></div>}
 </div>
}

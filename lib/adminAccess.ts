export type AdminAction='view'|'create'|'edit'|'delete'|'approve'|'export'
export type ModulePermission=Record<AdminAction,boolean>
export type AdminAccess={
  user_id?:string
  role:string
  admin_role:string
  staff_status:string
  job_title?:string|null
  permissions:Record<string,ModulePermission>
}

export const hrefModule:Record<string,string>={
  '/admin':'dashboard',
  '/admin/search':'search',
  '/admin/notifications':'notifications',
  '/admin/workflows':'workflows',
  '/admin/reports':'reports',
  '/admin/orders':'orders',
  '/admin/rfqs':'rfqs',
  '/admin/customers':'customers',
  '/admin/products':'products',
  '/admin/components':'components',
  '/admin/inventory':'inventory',
  '/admin/purchasing':'purchasing',
  '/admin/pricing':'pricing',
  '/admin/finance':'finance',
  '/admin/configurator':'configurator',
  '/admin/production':'production',
  '/admin/content':'content',
  '/admin/theme':'theme',
  '/admin/access':'security',
}

export function moduleForAdminPath(path:string){
  if(path==='/admin')return'dashboard'
  const candidates=Object.entries(hrefModule).filter(([href])=>href!=='/admin').sort((a,b)=>b[0].length-a[0].length)
  return candidates.find(([href])=>path===href||path.startsWith(href+'/'))?.[1]||null
}

export function canAdmin(access:AdminAccess|null|undefined,moduleKey:string,action:AdminAction='view'){
  if(!access)return false
  if(access.role==='admin')return true
  return Boolean(access.permissions?.[moduleKey]?.[action])
}

export const adminRoleLabels:Record<string,string>={
  admin:'Administrator',general:'General Staff',sales:'Sales',finance:'Finance',production:'Production',inventory:'Inventory',content:'Content'
}

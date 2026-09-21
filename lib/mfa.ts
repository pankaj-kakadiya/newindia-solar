import type {SupabaseClient} from '@supabase/supabase-js'

export type MfaFactor={id:string;friendly_name?:string;factor_type:string;status:string}
export type MfaState={factors:MfaFactor[];currentLevel:string;nextLevel:string}

export async function readMfaState(client:SupabaseClient):Promise<MfaState>{
  const [factors,levels]=await Promise.all([client.auth.mfa.listFactors(),client.auth.mfa.getAuthenticatorAssuranceLevel()])
  if(factors.error)throw factors.error
  if(levels.error)throw levels.error
  if(!levels.data?.currentLevel)throw Error('Your session expired. Sign in again.')
  return {factors:factors.data.all,currentLevel:levels.data.currentLevel,nextLevel:levels.data.nextLevel||'aal1'}
}

export function needsMfaChallenge(state:MfaState){
  return state.currentLevel!=='aal2'&&(state.nextLevel==='aal2'||state.factors.some(f=>f.status==='verified'))
}

export type AdminLoginStep='verify'|'password'|'enroll'|'ready'
export function adminLoginStep(profile:{must_change_password?:boolean;mfa_required?:boolean},state:MfaState):AdminLoginStep{
  if(needsMfaChallenge(state))return 'verify'
  if(profile.must_change_password)return 'password'
  if(profile.mfa_required&&(state.currentLevel!=='aal2'||!state.factors.some(f=>f.status==='verified')))return 'enroll'
  return 'ready'
}

export function safeAdminReturnTo(value:string|null|undefined){
  if(!value||!value.startsWith('/admin')||/[\\\\\x00-\x1f]/.test(value))return '/admin'
  try{
    const url=new URL(value,'https://admin.invalid')
    if(url.origin!=='https://admin.invalid'||!/^\/admin(?:\/|$)/.test(url.pathname)||/^\/admin\/login(?:\/|$)/.test(url.pathname))return '/admin'
    return url.pathname+url.search+url.hash
  }catch{return '/admin'}
}

export function adminSecurityRedirect(profile:{must_change_password?:boolean;mfa_required?:boolean},state:MfaState,path:string){
  if(path==='/admin/login'||adminLoginStep(profile,state)==='ready')return null
  const next=['/admin/change-password','/admin/account-security'].includes(path)?'/admin':safeAdminReturnTo(path)
  return '/admin/login?next='+encodeURIComponent(next)
}

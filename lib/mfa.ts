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

export function adminSecurityRedirect(profile:{must_change_password?:boolean;mfa_required?:boolean},state:MfaState,path:string){
  const security=path==='/admin/account-security'
  // Verify an existing factor before attempting a password change.
  if(needsMfaChallenge(state))return security?null:'/admin/account-security?required=1'
  if(profile.must_change_password)return path==='/admin/change-password'?null:'/admin/change-password?required=1'
  if(profile.mfa_required&&state.currentLevel!=='aal2')return security?null:'/admin/account-security?required=1'
  return null
}

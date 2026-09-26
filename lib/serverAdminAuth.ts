import {createClient,SupabaseClient} from '@supabase/supabase-js'
import {NextRequest,NextResponse} from 'next/server'

export type ServerAdminAuth={client:SupabaseClient;access:any;token:string}

export async function requireServerAdminPermission(request:NextRequest,moduleKey:string,action:'view'|'create'|'edit'|'delete'|'approve'|'export'='view'):Promise<ServerAdminAuth|NextResponse>{
 const auth=request.headers.get('authorization')||''
 const token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():''
 if(!token)return NextResponse.json({error:'Authentication required.'},{status:401})
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 if(!url||!key)return NextResponse.json({error:'Server Supabase configuration is incomplete.'},{status:503})
 const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data,error}=await client.rpc('get_my_admin_access')
 const access=data||null
 if(error||!access)return NextResponse.json({error:'Admin access could not be verified.'},{status:403})
 const {data:userData,error:userError}=await client.auth.getUser(token)
 if(userError||!userData.user)return NextResponse.json({error:'Session expired.'},{status:401})
 const enrolled=userData.user.factors?.some(factor=>factor.status==='verified')
 if(access.must_change_password)return NextResponse.json({error:'Password change required before using admin tools.',code:'PASSWORD_CHANGE_REQUIRED'},{status:403})
 if((access.mfa_required||enrolled)&&access.aal!=='aal2')return NextResponse.json({error:'Two-factor verification required before using admin tools.',code:'MFA_REQUIRED'},{status:403})
 const allowed=access.role==='admin'||Boolean(access.permissions?.[moduleKey]?.[action])
 if(access.session_ready===false)return NextResponse.json({error:'Complete account security or sign in again.',code:'SESSION_SECURITY_REQUIRED'},{status:403})
 if(!allowed)return NextResponse.json({error:`${moduleKey} ${action} permission required.`},{status:403})
 return {client,access,token}
}

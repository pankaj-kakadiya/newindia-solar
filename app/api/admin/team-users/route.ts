import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {NextRequest,NextResponse} from 'next/server'
import {requireServerAdminPermission} from '../../../../lib/serverAdminAuth'
import {validateManualTeamUser} from '../../../../lib/teamUser'

function response(body:Record<string,unknown>,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})}

export async function POST(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'security','create')
 if(auth instanceof NextResponse)return auth
 if(auth.access?.role!=='admin')return response({error:'Owner administrator access is required to create team users.'},403)
 let body:unknown
 try{body=await request.json()}catch{return response({error:'Invalid request body.'},400)}
 const checked=validateManualTeamUser(body)
 if(!checked.data)return response({error:checked.error||'Invalid team-user details.'},400)
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!serviceKey)return response({error:'Secure user-creation service is not configured.'},503)
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const input=checked.data
 const {data:created,error:createError}=await admin.auth.admin.createUser({email:input.email,password:input.temporary_password,email_confirm:true,user_metadata:{full_name:input.full_name,phone:input.phone||undefined}})
 if(createError||!created.user){const duplicate=/already|registered|exists/i.test(createError?.message||'');return response({error:duplicate?'This email already has an account. Use “Promote existing account” below.':createError?.message||'Could not create the team user.'},duplicate?409:422)}
 const {data:profile,error:profileError}=await admin.from('profiles').update({full_name:input.full_name,email:input.email,phone:input.phone,role:'staff',admin_role:input.admin_role,staff_status:'active',job_title:input.job_title,updated_at:new Date().toISOString()}).eq('id',created.user.id).select('id').single()
 if(profileError||!profile){await admin.auth.admin.deleteUser(created.user.id);return response({error:'The login was rolled back because the staff profile could not be created.'},500)}
 return response({user:{id:created.user.id,email:input.email,full_name:input.full_name,admin_role:input.admin_role,job_title:input.job_title},message:'Team user created successfully.'},201)
}

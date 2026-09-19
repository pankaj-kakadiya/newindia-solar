import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {NextRequest,NextResponse} from 'next/server'
import {requireServerAdminPermission} from '../../../../lib/serverAdminAuth'
import {validateManualTeamUser,validateTemporaryPassword} from '../../../../lib/teamUser'

function response(body:Record<string,unknown>,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})}

async function ownerAdmin(request:NextRequest,action:'view'|'create'|'edit'){
 const auth=await requireServerAdminPermission(request,'security',action)
 if(auth instanceof NextResponse)return auth
 if(auth.access?.role!=='admin')return response({error:'Owner administrator access is required to manage users.'},403)
 return auth
}

function serviceAdmin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null
}

export async function GET(request:NextRequest){
 const auth=await ownerAdmin(request,'view');if(auth instanceof NextResponse)return auth
 const admin=serviceAdmin();if(!admin)return response({error:'Secure user-management service is not configured.'},503)
 const authUsers:any[]=[]
 for(let page=1;page<=20;page++){const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});if(error){console.error('admin/team-users listUsers failed',error);return response({error:'Could not load Auth users.'},503)}authUsers.push(...data.users);if(data.users.length<1000)break}
 const ids=authUsers.map(user=>user.id)
 const profiles:any[]=[]
 for(let i=0;i<ids.length;i+=200){const part=ids.slice(i,i+200);const {data:rows,error:profileError}=await admin.from('profiles').select('id,full_name,email,phone,role,admin_role,staff_status,job_title,account_status,must_change_password,password_changed_at,mfa_required,access_reviewed_at,created_at,updated_at').in('id',part);if(profileError){console.error('admin/team-users profile load failed',profileError);return response({error:'Could not load team profiles.'},503)}profiles.push(...(rows||[]))}
 const {data:securityRows}=await auth.client.rpc('admin_user_security_summary')
 const securityById=new Map<string,any>((securityRows||[]).map((row:any)=>[row.user_id,row]))
 const profileById=new Map(profiles.map(profile=>[profile.id,profile]))
 const users=authUsers.map(user=>{const profile=profileById.get(user.id)||{},security=securityById.get(user.id)||{};return {id:user.id,email:user.email||profile.email||null,phone:user.phone||profile.phone||null,full_name:profile.full_name||null,role:profile.role||'customer',admin_role:profile.admin_role||null,staff_status:profile.staff_status||'active',job_title:profile.job_title||null,account_status:profile.account_status||'active',must_change_password:Boolean(profile.must_change_password),password_changed_at:profile.password_changed_at||null,mfa_required:Boolean(profile.mfa_required),mfa_enrolled:Boolean(security.mfa_enrolled),session_count:Number(security.session_count||0),last_session_at:security.last_session_at||null,access_reviewed_at:profile.access_reviewed_at||null,email_confirmed:Boolean(user.email_confirmed_at),last_sign_in_at:user.last_sign_in_at||null,created_at:user.created_at,updated_at:user.updated_at,providers:Array.isArray(user.app_metadata?.providers)?user.app_metadata.providers:[],banned:Boolean(user.banned_until&&new Date(user.banned_until).getTime()>Date.now())}})
 const security={must_change_password:users.filter(user=>user.must_change_password).length,mfa_required:users.filter(user=>user.mfa_required).length,mfa_enrolled:users.filter(user=>user.mfa_enrolled).length,active_sessions:users.reduce((sum,user)=>sum+user.session_count,0),unreviewed_team:users.filter(user=>['admin','staff'].includes(user.role)&&!user.access_reviewed_at).length}
 return response({users,total:users.length,security})
}

export async function POST(request:NextRequest){
 const auth=await ownerAdmin(request,'create');if(auth instanceof NextResponse)return auth
 let body:unknown
 try{body=await request.json()}catch{return response({error:'Invalid request body.'},400)}
 const checked=validateManualTeamUser(body)
 if(!checked.data)return response({error:checked.error||'Invalid team-user details.'},400)
 const admin=serviceAdmin();if(!admin)return response({error:'Secure user-creation service is not configured.'},503)
 const input=checked.data
 const {data:roleDef}=await admin.from('admin_role_definitions').select('role_key').eq('role_key',input.admin_role).neq('role_key','admin').maybeSingle()
 if(!roleDef)return response({error:'Selected department role no longer exists.'},400)
 const {data:created,error:createError}=await admin.auth.admin.createUser({email:input.email,password:input.temporary_password,email_confirm:true,user_metadata:{full_name:input.full_name,phone:input.phone||undefined},app_metadata:{must_change_password:true}})
 if(createError||!created.user){const duplicate=/already|registered|exists/i.test(createError?.message||'');if(createError&&!duplicate)console.error('admin/team-users createUser failed',createError);return response({error:duplicate?'This email already has an account. Use “Promote existing account” below.':'Could not create the team user.'},duplicate?409:422)}
 const {data:profile,error:profileError}=await admin.from('profiles').upsert({id:created.user.id,full_name:input.full_name,email:input.email,phone:input.phone,role:'staff',admin_role:input.admin_role,staff_status:'active',job_title:input.job_title,must_change_password:true,updated_at:new Date().toISOString()},{onConflict:'id'}).select('id').single()
 if(profileError||!profile){await admin.auth.admin.deleteUser(created.user.id);return response({error:'The login was rolled back because the staff profile could not be created.'},500)}
 return response({user:{id:created.user.id,email:input.email,full_name:input.full_name,admin_role:input.admin_role,job_title:input.job_title},message:'Team user created successfully.'},201)
}

export async function PATCH(request:NextRequest){
 const auth=await ownerAdmin(request,'edit');if(auth instanceof NextResponse)return auth
 const admin=serviceAdmin();if(!admin)return response({error:'Secure user-management service is not configured.'},503)
 let body:any;try{body=await request.json()}catch{return response({error:'Invalid request body.'},400)}
 const userId=String(body?.user_id||'');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))return response({error:'Invalid user ID.'},400)
 const [{data:userData,error:userError},{data:profile,error:profileReadError}]=await Promise.all([admin.auth.admin.getUserById(userId),admin.from('profiles').select('*').eq('id',userId).maybeSingle()])
 if(userError||!userData.user)return response({error:'Auth user not found.'},404)
 if(profileReadError)return response({error:profileReadError.message},503)
 if(profile?.role==='admin')return response({error:'Owner Admin credentials and access must be managed from their own account.'},403)
 if(body.action==='reset_password'){
  const password=String(body.temporary_password||''),passwordError=validateTemporaryPassword(password)
  if(passwordError)return response({error:passwordError},400)
  const {error}=await admin.auth.admin.updateUserById(userId,{password,email_confirm:true,app_metadata:{...(userData.user.app_metadata||{}),must_change_password:true}})
  if(error){console.error('admin/team-users reset_password failed',error);return response({error:'Could not update the password.'},422)}
  const {error:flagError}=await admin.from('profiles').update({must_change_password:true,updated_at:new Date().toISOString()}).eq('id',userId)
  if(flagError)console.error('admin/team-users reset_password flag update failed',flagError)
  return flagError?response({error:'Password updated but the must-change-password flag could not be saved.'},500):response({message:'Temporary password updated. The user must change it at next login.'})
 }
 if(body.action!=='update_user')return response({error:'Unsupported user-management action.'},400)
 const fullName=String(body.full_name||'').trim().replace(/\s+/g,' '),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').trim().replace(/[\s()-]/g,''),role=String(body.role||''),adminRole=String(body.admin_role||'general'),status=String(body.staff_status||'active'),jobTitle=String(body.job_title||'').trim().replace(/\s+/g,' ')
 if(fullName.length<2||fullName.length>100)return response({error:'Enter a valid full name.'},400)
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return response({error:'Enter a valid email address.'},400)
 if(phone&&!/^\+[1-9]\d{7,14}$/.test(phone))return response({error:'Enter mobile with country code, for example +919876543210.'},400)
 if(!['customer','staff'].includes(role))return response({error:'Invalid account role.'},400)
 if(role==='staff'){const {data:roleDef}=await admin.from('admin_role_definitions').select('role_key').eq('role_key',adminRole).neq('role_key','admin').maybeSingle();if(!roleDef)return response({error:'Invalid department role.'},400)}
 if(!['active','suspended','inactive'].includes(status))return response({error:'Invalid account status.'},400)
 if(jobTitle.length>80)return response({error:'Job title must be 80 characters or fewer.'},400)
 const original=userData.user
 const authUpdate:any={email,email_confirm:true,ban_duration:status==='active'?'none':'876000h',user_metadata:{...(original.user_metadata||{}),full_name:fullName}}
 if(phone)authUpdate.phone=phone
 const {error:authError}=await admin.auth.admin.updateUserById(userId,authUpdate)
 if(authError){console.error('admin/team-users update_user auth update failed',authError);return response({error:'Could not update the login account.'},422)}
 const mfaRequired=role==='staff'&&Boolean(body.mfa_required),mustChange=role==='staff'&&Boolean(body.must_change_password)
 const {data:saved,error:profileError}=await admin.from('profiles').upsert({id:userId,full_name:fullName,email,phone:phone||null,role,admin_role:role==='staff'?adminRole:null,staff_status:status,account_status:status,job_title:role==='staff'?(jobTitle||null):null,mfa_required:mfaRequired,must_change_password:mustChange,access_reviewed_at:new Date().toISOString(),access_reviewed_by:auth.access.user_id,updated_at:new Date().toISOString()},{onConflict:'id'}).select('id').single()
 if(profileError||!saved){await admin.auth.admin.updateUserById(userId,{email:original.email||undefined,phone:original.phone||undefined,ban_duration:original.banned_until?'876000h':'none'});return response({error:'Auth changes were rolled back because the profile could not be updated.'},500)}
 return response({message:'User details and login access updated.'})
}

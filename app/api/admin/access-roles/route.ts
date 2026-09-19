import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {NextRequest,NextResponse} from 'next/server'
import {requireServerAdminPermission} from '../../../../lib/serverAdminAuth'

function out(body:Record<string,unknown>,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})}
function service(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null}
async function owner(request:NextRequest){const auth=await requireServerAdminPermission(request,'security','edit');if(auth instanceof NextResponse)return auth;if(auth.access.role!=='admin')return out({error:'Owner administrator access is required.'},403);return auth}
function cleanName(value:unknown){return String(value||'').trim().replace(/\s+/g,' ')}
function cleanKey(value:unknown){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}

export async function POST(request:NextRequest){
 const auth=await owner(request);if(auth instanceof NextResponse)return auth
 const admin=service();if(!admin)return out({error:'Secure role service is not configured.'},503)
 let body:any;try{body=await request.json()}catch{return out({error:'Invalid request body.'},400)}
 const name=cleanName(body.name),roleKey=cleanKey(body.role_key||name),description=cleanName(body.description),base=cleanKey(body.copy_from||'general')
 if(name.length<2||name.length>60)return out({error:'Role name must be 2–60 characters.'},400)
 if(!/^[a-z][a-z0-9_]{1,39}$/.test(roleKey)||roleKey==='admin')return out({error:'Use a role key with 2–40 lowercase letters, numbers or underscores.'},400)
 const {data:baseRole}=await admin.from('admin_role_definitions').select('role_key').eq('role_key',base).maybeSingle();if(!baseRole)return out({error:'Copy-from role not found.'},400)
 const {data:maxRow}=await admin.from('admin_role_definitions').select('sort_order').order('sort_order',{ascending:false}).limit(1).maybeSingle()
 const {error}=await admin.from('admin_role_definitions').insert({role_key:roleKey,name,description:description||null,sort_order:Number(maxRow?.sort_order||0)+10,is_system:false})
 if(error){if(error.code!=='23505')console.error('admin/access-roles create failed',error);return out({error:error.code==='23505'?'A role with this key already exists.':'Could not create the role.'},409)}
 const {data:source}=await admin.from('admin_role_permissions').select('module_key,can_view,can_create,can_edit,can_delete,can_approve,can_export').eq('role_key',base)
 if(source?.length)await admin.from('admin_role_permissions').upsert(source.map(row=>({...row,role_key:roleKey,updated_by:auth.access.user_id,updated_at:new Date().toISOString()})),{onConflict:'role_key,module_key'})
 return out({message:`${name} role created with ${base} access as its starting point.`,role_key:roleKey},201)
}

export async function PATCH(request:NextRequest){
 const auth=await owner(request);if(auth instanceof NextResponse)return auth
 const admin=service();if(!admin)return out({error:'Secure role service is not configured.'},503)
 let body:any;try{body=await request.json()}catch{return out({error:'Invalid request body.'},400)}
 const roleKey=cleanKey(body.role_key),name=cleanName(body.name),description=cleanName(body.description)
 const {data:role}=await admin.from('admin_role_definitions').select('is_system').eq('role_key',roleKey).maybeSingle();if(!role)return out({error:'Role not found.'},404)
 if(role.is_system)return out({error:'System role names cannot be changed.'},403)
 if(name.length<2||name.length>60)return out({error:'Role name must be 2–60 characters.'},400)
 const {error}=await admin.from('admin_role_definitions').update({name,description:description||null,updated_at:new Date().toISOString()}).eq('role_key',roleKey)
 if(error)console.error('admin/access-roles update failed',error)
 return error?out({error:'Could not update the role.'},422):out({message:'Custom role details updated.'})
}

export async function DELETE(request:NextRequest){
 const auth=await owner(request);if(auth instanceof NextResponse)return auth
 const admin=service();if(!admin)return out({error:'Secure role service is not configured.'},503)
 let body:any;try{body=await request.json()}catch{return out({error:'Invalid request body.'},400)}
 const roleKey=cleanKey(body.role_key)
 const {data:role}=await admin.from('admin_role_definitions').select('name,is_system').eq('role_key',roleKey).maybeSingle();if(!role)return out({error:'Role not found.'},404)
 if(role.is_system)return out({error:'System roles cannot be deleted.'},403)
 const {count}=await admin.from('profiles').select('id',{count:'exact',head:true}).eq('admin_role',roleKey);if(count)return out({error:`Reassign ${count} team user${count===1?'':'s'} before deleting this role.`},409)
 const {error}=await admin.from('admin_role_definitions').delete().eq('role_key',roleKey)
 if(error)console.error('admin/access-roles delete failed',error)
 return error?out({error:'Could not delete the role.'},422):out({message:`${role.name} role deleted.`})
}

import {NextRequest} from 'next/server'
import {buyerContext,buyerJson,buyerFailure,validate} from '../../../../lib/buyer-server'
import {PROFILE_FIELDS,ADDRESS_FIELDS,ORDER_FIELDS,profileInput} from '../../../../lib/buyer-account'
export async function GET(request:NextRequest){try{
 const {user,db}=await buyerContext(request)
 const offset=Math.max(0,Math.min(100000,Number(request.nextUrl.searchParams.get('offset'))||0))
 const [profile,addresses,orders]=await Promise.all([
  db.from('profiles').select(PROFILE_FIELDS).eq('id',user.id).maybeSingle().throwOnError(),
  db.from('addresses').select(ADDRESS_FIELDS).eq('user_id',user.id).order('is_default_shipping',{ascending:false}).order('created_at',{ascending:false}).limit(100).throwOnError(),
  db.from('orders').select(ORDER_FIELDS).eq('user_id',user.id).order('created_at',{ascending:false}).range(offset,offset+19).throwOnError()
 ])
 return buyerJson({profile:profile.data||{full_name:'',phone:user.phone||'',company_name:'',gstin:''},email:user.email||'',verified_phone:user.phone_confirmed_at?user.phone:null,addresses:addresses.data,orders:orders.data,hasMore:orders.data?.length===20})
}catch(e){return buyerFailure(e)}}
export async function PATCH(request:NextRequest){try{
 const {user,client}=await buyerContext(request),body=await request.json(),fields=validate(()=>profileInput(body))
 const {data}=await client.from('profiles').update(fields).eq('id',user.id).select(PROFILE_FIELDS).single().throwOnError()
 return buyerJson({profile:data})
}catch(e){return buyerFailure(e)}}

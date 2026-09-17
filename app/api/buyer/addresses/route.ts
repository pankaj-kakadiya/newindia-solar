import {NextRequest} from 'next/server'
import {buyerContext,buyerJson,buyerFailure,BuyerError,validate} from '../../../../lib/buyer-server'
import {addressInput,ADDRESS_FIELDS,UUID} from '../../../../lib/buyer-account'
export async function POST(request:NextRequest){try{
 const {user,client}=await buyerContext(request),body=await request.json(),fields=validate(()=>addressInput(body))
 const {data}=await client.from('addresses').insert({...fields,user_id:user.id}).select(ADDRESS_FIELDS).single().throwOnError()
 return buyerJson({address:data})
}catch(e){return buyerFailure(e)}}
export async function PATCH(request:NextRequest){try{
 const {user,client}=await buyerContext(request),body=await request.json()
 if(!UUID.test(body.id||''))throw new BuyerError('Invalid address.')
 const fields=validate(()=>addressInput(body))
 const {data}=await client.from('addresses').update(fields).eq('id',body.id).eq('user_id',user.id).select(ADDRESS_FIELDS).maybeSingle().throwOnError()
 if(!data)throw new BuyerError('Address not found.',404)
 return buyerJson({address:data})
}catch(e){return buyerFailure(e)}}
export async function DELETE(request:NextRequest){try{
 const {user,client}=await buyerContext(request),id=request.nextUrl.searchParams.get('id')||''
 if(!UUID.test(id))throw new BuyerError('Invalid address.')
 const {data}=await client.from('addresses').delete().eq('id',id).eq('user_id',user.id).select('id').maybeSingle().throwOnError()
 if(!data)throw new BuyerError('Address not found.',404)
 return buyerJson({deleted:true})
}catch(e){return buyerFailure(e)}}

import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {NextRequest,NextResponse} from 'next/server'
import {serviceClient} from './transactionRuntime'
export class BuyerError extends Error{constructor(message:string,public status=400){super(message)}}
export async function buyerContext(request:NextRequest){
 const token=(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1]
 if(!token)throw new BuyerError('Please sign in to your account.',401)
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 if(!url||!key)throw new BuyerError('Account service is unavailable.',503)
 const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await client.auth.getUser(token)
 if(error||!data.user)throw new BuyerError('Your session expired. Please sign in again.',401)
 const db=serviceClient();if(!db)throw new BuyerError('Account service is unavailable.',503)
 return {user:data.user,client,db}
}
export function buyerJson(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}})}
export function buyerFailure(error:unknown){return buyerJson({error:error instanceof BuyerError?error.message:'Unable to complete your request. Please try again.'},error instanceof BuyerError?error.status:503)}
export function validate<T>(fn:()=>T):T{try{return fn()}catch(e){throw new BuyerError(e instanceof Error?e.message:'Invalid details.')}}

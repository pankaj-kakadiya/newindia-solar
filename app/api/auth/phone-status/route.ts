import {NextResponse} from 'next/server'
export async function GET(){
 let available=false
 try{const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 if(url&&key){const r=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(5000)});if(r.ok){const j=await r.json();available=j.external?.phone===true}}}catch{}
 return NextResponse.json({available},{headers:{'Cache-Control':'no-store'}})
}

import {supabase} from './supabase'
export async function buyerFetch(path:string,options:RequestInit={}){
 const {data}=await supabase.auth.getSession(),token=data.session?.access_token
 if(!token)throw Error('Please sign in to your account.')
 const response=await fetch(`/api/buyer/${path}`,{...options,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...options.headers}})
 const json=await response.json().catch(()=>({}))
 if(!response.ok)throw Error(json.error||'Request failed. Please try again.')
 return json
}

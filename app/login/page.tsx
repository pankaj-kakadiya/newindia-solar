'use client'
import {FormEvent,Suspense,useEffect,useState} from 'react'
import Link from 'next/link'
import {useRouter,useSearchParams} from 'next/navigation'
import {supabase} from '../../lib/supabase'

function LoginContent(){
  const router=useRouter(); const search=useSearchParams();
  const [mode,setMode]=useState<'login'|'signup'>('login'); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState('')
  useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(data.user)router.replace(search.get('next')||'/')})},[router,search])
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMsg('');const f=new FormData(e.currentTarget);const email=String(f.get('email')||'');const password=String(f.get('password')||'');
    const result=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password,options:{data:{full_name:String(f.get('name')||'')}}});
    setBusy(false); if(result.error){setMsg(result.error.message);return} if(mode==='signup'&&!result.data.session){setMsg('Account created. Please verify your email, then sign in.');setMode('login');return} router.replace(search.get('next')||'/');router.refresh();
  }
  return <main className="container formPage"><div className="authCard"><span className="eyebrow darkEye">NEW INDIA SOLAR ACCOUNT</span><h1>{mode==='login'?'Sign in':'Create account'}</h1><p>Sign in to place secure orders, save custom ACDB/DCDB builds and track orders.</p><form className="rfqForm" onSubmit={submit}>{mode==='signup'&&<label>Full Name<input name="name" required/></label>}<label>Email<input name="email" type="email" required/></label><label>Password<input name="password" type="password" minLength={6} required/></label><button className="btn btnPrimary fullBtn" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign In':'Create Account'}</button></form>{msg&&<p className="formMessage">{msg}</p>}<button className="textButton" onClick={()=>{setMode(mode==='login'?'signup':'login');setMsg('')}}>{mode==='login'?'New customer? Create account':'Already registered? Sign in'}</button><Link className="bulkLink center" href="/shop">← Back to shop</Link></div></main>
}

export default function Login(){
  return <Suspense fallback={<main className="container formPage"><div className="authCard"><p>Loading account…</p></div></main>}><LoginContent/></Suspense>
}

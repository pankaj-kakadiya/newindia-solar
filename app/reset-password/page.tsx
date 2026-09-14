'use client'
import {FormEvent,useEffect,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {ShieldCheck} from 'lucide-react'
import {supabase} from '../../lib/supabase'

export default function ResetPassword(){
 const router=useRouter();const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('Checking reset link…')
 useEffect(()=>{let mounted=true;supabase.auth.getSession().then(({data})=>{if(!mounted)return;if(data.session){setReady(true);setMsg('')}else setMsg('Open this page from the password reset link sent to your email.')});const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{if((event==='PASSWORD_RECOVERY'||event==='SIGNED_IN')&&session){setReady(true);setMsg('')}});return()=>{mounted=false;listener.subscription.unsubscribe()}},[])
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMsg('');const f=new FormData(e.currentTarget);const password=String(f.get('password')||'');const confirm=String(f.get('confirm')||'');if(password.length<8){setBusy(false);setMsg('Use at least 8 characters.');return}if(password!==confirm){setBusy(false);setMsg('Passwords do not match.');return}const {error}=await supabase.auth.updateUser({password});setBusy(false);if(error){setMsg(error.message);return}setMsg('Password updated successfully. Redirecting to admin…');setTimeout(()=>router.replace('/admin'),1000)}
 return <main className="adminLoginPage"><div className="adminLoginCard"><div className="adminLoginIcon"><ShieldCheck/></div><span className="adminEyebrow">NEW INDIA SOLAR</span><h1>Create New Password</h1><p>Set a new password for your New India Solar admin account.</p>{ready?<form onSubmit={submit}><label>New Password<input name="password" type="password" minLength={8} required autoComplete="new-password"/></label><label>Confirm Password<input name="confirm" type="password" minLength={8} required autoComplete="new-password"/></label>{msg&&<div className="adminError">{msg}</div>}<button disabled={busy}>{busy?'Updating…':'Update password'}</button></form>:<div className="adminError">{msg}</div>}<Link className="textButton" href="/admin/login">← Back to admin sign in</Link></div></main>
}

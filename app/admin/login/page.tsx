'use client'

import Image from 'next/image'
import Link from 'next/link'
import {FormEvent,useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {ArrowRight,Eye,EyeOff,Factory,KeyRound,LockKeyhole,Mail,ShieldCheck,Sparkles} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

export default function Login(){
 const router=useRouter()
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [resetMode,setResetMode]=useState(false)
 const [showPassword,setShowPassword]=useState(false)

 useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(data.user)router.replace('/admin')})},[router])

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage('')
  const form=new FormData(e.currentTarget),email=String(form.get('email')||'').trim()
  if(resetMode){
   const redirectTo=`${window.location.origin}/reset-password`
   const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo})
   setBusy(false)
   if(error){setMessage(error.message);return}
   setMessage('Password reset link sent. Check your inbox and spam folder.');return
  }
  const {error}=await supabase.auth.signInWithPassword({email,password:String(form.get('password'))})
  setBusy(false)
  if(error){setMessage(error.message);return}
  router.replace('/admin');router.refresh()
 }

 return <main className="adminLoginV2">
  <div className="adminLoginGlow loginGlowOne"/><div className="adminLoginGlow loginGlowTwo"/>
  <section className="adminLoginShell">
   <aside className="adminLoginVisual">
    <div className="adminLoginVisualTop">
     <div className="adminLoginLogo" aria-label="New India Solar Components Pvt Ltd">
      <Image src="/new-india-solar-full-logo.webp" alt="New India Solar Components Pvt Ltd" fill sizes="(max-width: 820px) 260px, 340px" priority/>
     </div>
     <span className="adminLoginKicker"><Sparkles size={14}/> Private operations portal</span>
     <h1>Power every solar operation from one command center.</h1>
     <p>Secure access to sales, inventory, assembly, finance and business intelligence for New India Solar.</p>
    </div>
    <div className="adminLoginFeatures">
     <div><span><Factory size={18}/></span><section><b>Production Control</b><small>ACDB, DCDB and combo assembly</small></section></div>
     <div><span><ShieldCheck size={18}/></span><section><b>Role-Protected Access</b><small>Permissions matched to every team member</small></section></div>
     <div><span><KeyRound size={18}/></span><section><b>Secure Sessions</b><small>Password and MFA-ready account security</small></section></div>
    </div>
    <div className="adminLoginVisualFoot"><i/><span>Powering India&apos;s Solar Installations.</span></div>
   </aside>

   <section className="adminLoginFormPanel">
    <div className="adminLoginMobileLogo">
     <Image src="/new-india-solar-full-logo.webp" alt="New India Solar Components Pvt Ltd" fill sizes="260px" priority/>
    </div>
    <div className="adminLoginSecure"><ShieldCheck size={15}/> Secure admin access</div>
    <div className="adminLoginHeading">
     <span>{resetMode?'ACCOUNT RECOVERY':'WELCOME BACK'}</span>
     <h2>{resetMode?'Reset your password':'Sign in to Control Center'}</h2>
     <p>{resetMode?'Enter your admin email and we will send a secure recovery link.':'Use your authorized New India Solar account to continue.'}</p>
    </div>
    <form className="adminLoginForm" onSubmit={submit}>
     <label><span>User ID</span><div className="adminLoginInput"><Mail size={18}/><input name="email" type="email" required autoComplete="email" placeholder="User ID"/></div></label>
     {!resetMode&&<label><span>Password</span><div className="adminLoginInput"><LockKeyhole size={18}/><input name="password" type={showPassword?'text':'password'} required autoComplete="current-password" placeholder="Password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>}
     {message&&<div className={message.startsWith('Password reset')?'adminLoginMessage success':'adminLoginMessage'} role="status">{message}</div>}
     <button className="adminLoginSubmit" disabled={busy}>{busy?'Please wait…':resetMode?'Send secure reset link':'Sign in securely'}<ArrowRight size={18}/></button>
    </form>
    <button type="button" className="adminLoginTextButton" onClick={()=>{setResetMode(!resetMode);setMessage('')}}>{resetMode?'← Back to secure sign in':'Forgot your password?'}</button>
    <div className="adminLoginTrust"><LockKeyhole size={14}/><span>Encrypted session · Authorized staff only</span></div>
    <Link className="adminLoginStoreLink" href="/">Return to newindiasolar.com</Link>
   </section>
  </section>
 </main>
}

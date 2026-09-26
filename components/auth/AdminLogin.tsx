'use client'
import Image from 'next/image'
import Link from 'next/link'
import {FormEvent,useEffect,useRef,useState} from 'react'
import {useRouter,useSearchParams} from 'next/navigation'
import {ArrowRight,Eye,EyeOff,Factory,KeyRound,LockKeyhole,Mail,ShieldCheck,Sparkles} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {AdminLoginStep,MfaState,adminLoginStep,readMfaState,safeAdminReturnTo} from '../../lib/mfa'
import MfaChallenge from './MfaChallenge'
import AdminPasswordForm from './AdminPasswordForm'
import AccountSecurityPanel from './AccountSecurityPanel'

export default function AdminLogin(){
 const router=useRouter(),search=useSearchParams()
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[resetMode,setResetMode]=useState(false),[showPassword,setShowPassword]=useState(false)
 const [step,setStep]=useState<AdminLoginStep|'signin'|'checking'|'error'>('checking'),[mfa,setMfa]=useState<MfaState|null>(null)
 const version=useRef(0)
 async function checkSession(){
  const request=++version.current
  setStep('checking');setMessage('')
  try{
   const {data:{user}}=await supabase.auth.getUser()
   if(request!==version.current)return
   if(!user){setMfa(null);setStep('signin');return}
   const {data:profile,error}=await supabase.from('profiles').select('role,staff_status,must_change_password,mfa_required').eq('id',user.id).maybeSingle()
   if(error)throw error
   if(request!==version.current)return
   if(!['admin','staff'].includes(profile?.role||'')||profile?.staff_status!=='active'){
    await supabase.auth.signOut({scope:'local'});setStep('signin');setMessage('This account does not have active admin access.');return
   }
   const state=await readMfaState(supabase)
   if(request!==version.current)return
   const nextStep=adminLoginStep(profile,state)
   setMfa(state)
   if(nextStep!=='ready'){setStep(nextStep);return}
   const {data:access,error:accessError}=await supabase.rpc('get_my_admin_access')
   if(accessError)throw accessError
   if(request!==version.current)return
   if(!access)throw Error('Admin access could not be verified.')
   if(access.session_ready===false){
    await supabase.auth.signOut({scope:'local'});setStep('signin');setMessage('Your session expired. Please sign in again.');return
   }
   router.replace(safeAdminReturnTo(search.get('next')));router.refresh()
  }catch(error:any){if(request===version.current){setStep('error');setMessage(error.message||'Could not verify account security. Please retry.')}}
 }
 useEffect(()=>{
  checkSession()
  const {data}=supabase.auth.onAuthStateChange(event=>{
   // The submitted forms control progress. An Auth session alone is not a
   // completed application login, so SIGNED_IN must never open the dashboard.
   if(event==='SIGNED_OUT'){version.current++;setMfa(null);setStep('signin')}
  })
  return()=>{version.current++;data.subscription.unsubscribe()}
 },[])
 async function switchAccount(){
  version.current++;setBusy(true);setMessage('')
  try{
   const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error
   setMfa(null);setResetMode(false);setStep('signin')
  }catch(error:any){setMessage(error.message)}finally{setBusy(false)}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget),email=String(form.get('email')||'').trim()
  setBusy(true);setMessage('')
  try{
   if(resetMode){
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`})
    if(error)throw error
    setMessage('Password reset link sent. Check your inbox and spam folder.');return
   }
   const {error}=await supabase.auth.signInWithPassword({email,password:String(form.get('password')||'')})
   if(error)throw error
   await checkSession()
  }catch(error:any){setMessage(error.message||'Could not sign in. Please retry.')}finally{setBusy(false)}
 }
 const heading=step==='verify'?'Verify your login':step==='password'?'Create your private password':step==='enroll'?'Set up two-step verification':step==='checking'?'Checking your login':step==='error'?'Finish signing in':resetMode?'Reset your password':'Sign in to Control Center'
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
     <div><span><KeyRound size={18}/></span><section><b>Secure Sessions</b><small>Password and authenticator verification</small></section></div>
    </div>
    <div className="adminLoginVisualFoot"><i/><span>Powering India&apos;s Solar Installations.</span></div>
   </aside>

   <section className="adminLoginFormPanel">
    <div className="adminLoginMobileLogo">
     <Image src="/new-india-solar-full-logo.webp" alt="New India Solar Components Pvt Ltd" fill sizes="260px" priority/>
    </div>
    <div className="adminLoginSecure"><ShieldCheck size={15}/> Secure admin access</div>
    <div className="adminLoginHeading">
     <span>{step==='signin'?(resetMode?'ACCOUNT RECOVERY':'WELCOME BACK'):'SECURE SIGN IN'}</span>
     <h2>{heading}</h2>
     <p>{step==='signin'?(resetMode?'Enter your admin email and we will send a secure recovery link.':'Use your authorized New India Solar account to continue.'):'Complete the required steps here before entering the dashboard.'}</p>
    </div>
    {step==='signin'&&<form className="adminLoginForm" onSubmit={submit}>
     <label><span>User ID</span><div className="adminLoginInput"><Mail size={18}/><input name="email" type="email" required autoComplete="email" placeholder="User ID"/></div></label>
     {!resetMode&&<label><span>Password</span><div className="adminLoginInput"><LockKeyhole size={18}/><input name="password" type={showPassword?'text':'password'} required autoComplete="current-password" placeholder="Password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>}
     <button className="adminLoginSubmit" disabled={busy}>{busy?'Please wait…':resetMode?'Send secure reset link':'Sign in securely'}<ArrowRight size={18}/></button>
    </form>}
    {step==='checking'&&<p role="status">Checking secure access…</p>}
    {step==='verify'&&mfa&&<div className="adminLoginSecurity"><MfaChallenge factors={mfa.factors} onVerified={checkSession}/></div>}
    {step==='password'&&<div className="adminLoginSecurity"><AdminPasswordForm required onComplete={checkSession}/></div>}
    {step==='enroll'&&<div className="adminLoginSecurity"><AccountSecurityPanel setupOnly onComplete={checkSession}/></div>}
    {message&&<div className={message.startsWith('Password reset')?'adminLoginMessage success':'adminLoginMessage'} role="status">{message}</div>}
    {step==='error'&&<button className="adminLoginSubmit" disabled={busy} onClick={checkSession}>Retry security check</button>}
    {step==='signin'?<button type="button" className="adminLoginTextButton" onClick={()=>{setResetMode(!resetMode);setMessage('')}}>{resetMode?'← Back to secure sign in':'Forgot your password?'}</button>:<button type="button" className="adminLoginTextButton" disabled={busy} onClick={switchAccount}>Sign out / use another account</button>}
    <div className="adminLoginTrust"><LockKeyhole size={14}/><span>Encrypted session · Authorized staff only</span></div>
    <Link className="adminLoginStoreLink" href="/">Return to newindiasolar.com</Link>
   </section>
  </section>
 </main>
}

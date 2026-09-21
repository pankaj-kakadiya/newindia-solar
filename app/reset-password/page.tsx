'use client'
import {FormEvent,useEffect,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {supabase} from '../../lib/supabase'
import {MfaState,needsMfaChallenge,readMfaState} from '../../lib/mfa'
import {validateTemporaryPassword} from '../../lib/teamUser'
import MfaChallenge from '../../components/auth/MfaChallenge'

export default function ResetPassword(){
  const router=useRouter()
  const [state,setState]=useState<MfaState|null>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('Checking reset link…'),[saved,setSaved]=useState(false)
  async function load(){
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)throw Error('Open this page from the password reset link sent to your email.')
    const next=await readMfaState(supabase);setState(next);setMsg('');return next
  }
  useEffect(()=>{
    let active=true
    const refresh=()=>load().catch(error=>{if(active)setMsg(error.message)})
    refresh()
    const {data}=supabase.auth.onAuthStateChange(event=>{
      if(['PASSWORD_RECOVERY','SIGNED_IN'].includes(event))setTimeout(()=>{if(active)refresh()},0)
      if(event==='SIGNED_OUT'){setState(null);setMsg('Your session expired. Request another reset link.')}
    })
    return()=>{active=false;data.subscription.unsubscribe()}
  },[])
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget,f=new FormData(form)
    const password=String(f.get('password')||''),confirm=String(f.get('confirm')||'')
    setBusy(true);setMsg('')
    try{
      const validation=validateTemporaryPassword(password)
      if(validation)throw Error(validation.replace('Temporary password','New password'))
      if(password!==confirm)throw Error('Passwords do not match.')
      const mfa=await readMfaState(supabase)
      if(needsMfaChallenge(mfa)){setState(mfa);throw Error('Verify your authenticator before changing the password.')}
      const {error}=await supabase.auth.updateUser({password});if(error)throw error
      const {data:{user}}=await supabase.auth.getUser()
      const {data:profile,error:profileError}=await supabase.from('profiles').select('role').eq('id',user?.id).single()
      if(profileError)throw profileError
      const internal=['admin','staff'].includes(profile?.role)
      if(internal){const {error}=await supabase.rpc('complete_initial_password_change');if(error)throw error}
      const {error:signOutError}=await supabase.auth.signOut({scope:'others'})
      form.reset();setSaved(true)
      setMsg(signOutError?'Password updated. Sign out other devices from Account Security.':'Password updated successfully.')
      setTimeout(()=>router.replace(internal?'/admin':'/account'),900)
    }catch(error:any){setMsg(error.message||'Could not update your password.')}finally{setBusy(false)}
  }
  return <main className="adminLoginPage"><div className="adminLoginCard"><span className="adminEyebrow">NEW INDIA SOLAR</span><h1>Create new password</h1><p>Use a unique password with at least 12 characters.</p>
    {state&&needsMfaChallenge(state)?<MfaChallenge factors={state.factors} onVerified={async()=>{await load()}}/>:state&&!saved?<form onSubmit={submit}><label>New password<input name="password" type="password" minLength={12} required autoComplete="new-password"/></label><label>Confirm password<input name="confirm" type="password" minLength={12} required autoComplete="new-password"/></label><button disabled={busy}>{busy?'Updating…':'Update password'}</button></form>:null}
    {msg&&<p role="status">{msg}</p>}<Link className="textButton" href="/admin/login">Back to sign in</Link>
  </div></main>
}

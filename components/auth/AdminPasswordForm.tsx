'use client'
import {FormEvent,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {validateTemporaryPassword} from '../../lib/teamUser'

export default function AdminPasswordForm({required=false,onComplete}:{required?:boolean;onComplete?:()=>void|Promise<void>}){
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [success,setSuccess]=useState(false)
  const [nonce,setNonce]=useState(''),[reauthSent,setReauthSent]=useState(false)

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    // React clears currentTarget after dispatch; retain the form across awaits.
    const formElement=e.currentTarget
    setBusy(true);setMessage('');setSuccess(false)
    const form=new FormData(formElement)
    const current=String(form.get('current')||'')
    const next=String(form.get('next')||'')
    const confirm=String(form.get('confirm')||'')
    const passwordError=validateTemporaryPassword(next)
    if(passwordError){setBusy(false);setMessage(passwordError.replace('Temporary password','New password'));return}
    if(next!==confirm){setBusy(false);setMessage('New passwords do not match.');return}
    const {data:{user}}=await supabase.auth.getUser()
    if(!user?.email){setBusy(false);setMessage('Session expired. Sign in again.');return}
    // Validate the current password within the update. A second password sign-in
    // would replace the verified AAL2 session with a password-only AAL1 session.
    const {error}=await supabase.auth.updateUser({password:next,current_password:current,...(nonce?{nonce}:{})})
    if(error){
      if(error.code==='reauthentication_needed'){
        const {error:reauthError}=await supabase.auth.reauthenticate()
        setReauthSent(!reauthError);setMessage(reauthError?reauthError.message:'Enter the security code sent to your email or phone, then submit again.')
      }else setMessage(error.code==='current_password_mismatch'?'Current password is incorrect.':error.message)
      setBusy(false);return
    }
    const {error:completeError}=await supabase.rpc('complete_initial_password_change')
    if(completeError){setBusy(false);setMessage(completeError.message);return}
    const {error:signOutError}=await supabase.auth.signOut({scope:'others'})
    setBusy(false);setSuccess(true);setMessage(signOutError?'Password changed. Other devices could not be signed out; retry from Account Security.':'Password changed successfully. Other device sessions were signed out.')
    formElement.reset()
    setNonce('');setReauthSent(false)
    if(onComplete)await onComplete()
  }

  return <section>{!required&&<div className="adminPageHead"><div><span className="adminEyebrow">ACCOUNT SECURITY</span><h1>{required?'Create Your Private Password':'Change Password'}</h1><p>{required?'Your temporary password worked. Replace it before entering the admin system.':'Update the password for the signed-in admin account.'}</p></div></div>}<div className="adminSecurityCard"><form className="adminSecurityForm" onSubmit={submit}><label>Current Password<input name="current" type="password" required autoComplete="current-password"/></label><label>New Password<input name="next" type="password" minLength={12} required autoComplete="new-password"/></label><label>Confirm New Password<input name="confirm" type="password" minLength={12} required autoComplete="new-password"/></label>{reauthSent&&<label>Security code<input name="nonce" value={nonce} onChange={e=>setNonce(e.target.value.trim())} autoComplete="one-time-code" required/></label>}{message&&<div className={success?'adminSecuritySuccess':'adminError'}>{message}</div>}<button className="btn btnPrimary" disabled={busy}>{busy?'Updating…':'Change Password'}</button></form></div></section>
}

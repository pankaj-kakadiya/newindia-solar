'use client'
import {FormEvent,useState} from 'react'
import {useRouter,useSearchParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase'
import {validateTemporaryPassword} from '../../../lib/teamUser'

export default function ChangePassword(){
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [success,setSuccess]=useState(false)
  const router=useRouter(),required=useSearchParams().get('required')==='1'

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    setBusy(true);setMessage('');setSuccess(false)
    const form=new FormData(e.currentTarget)
    const current=String(form.get('current')||'')
    const next=String(form.get('next')||'')
    const confirm=String(form.get('confirm')||'')
    const passwordError=validateTemporaryPassword(next)
    if(passwordError){setBusy(false);setMessage(passwordError.replace('Temporary password','New password'));return}
    if(next!==confirm){setBusy(false);setMessage('New passwords do not match.');return}
    const {data:{user}}=await supabase.auth.getUser()
    if(!user?.email){setBusy(false);setMessage('Session expired. Sign in again.');return}
    const {error:signInError}=await supabase.auth.signInWithPassword({email:user.email,password:current})
    if(signInError){setBusy(false);setMessage('Current password is incorrect.');return}
    const {error}=await supabase.auth.updateUser({password:next})
    if(error){setBusy(false);setMessage(error.message);return}
    const {error:completeError}=await supabase.rpc('complete_initial_password_change')
    if(completeError){setBusy(false);setMessage(completeError.message);return}
    await supabase.auth.signOut({scope:'others'})
    setBusy(false);setSuccess(true);setMessage('Password changed successfully. Other device sessions were signed out.')
    e.currentTarget.reset()
    if(required)setTimeout(()=>router.replace('/admin'),900)
  }

  return <section><div className="adminPageHead"><div><span className="adminEyebrow">ACCOUNT SECURITY</span><h1>{required?'Create Your Private Password':'Change Password'}</h1><p>{required?'Your temporary password worked. Replace it before entering the admin system.':'Update the password for the signed-in admin account.'}</p></div></div><div className="adminSecurityCard"><form className="adminSecurityForm" onSubmit={submit}><label>Current Password<input name="current" type="password" required autoComplete="current-password"/></label><label>New Password<input name="next" type="password" minLength={12} required autoComplete="new-password"/></label><label>Confirm New Password<input name="confirm" type="password" minLength={12} required autoComplete="new-password"/></label>{message&&<div className={success?'adminSecuritySuccess':'adminError'}>{message}</div>}<button className="btn btnPrimary" disabled={busy}>{busy?'Updating…':'Change Password'}</button></form></div></section>
}

'use client'
import {FormEvent,useState} from 'react'
import {supabase} from '../../../lib/supabase'

export default function ChangePassword(){
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [success,setSuccess]=useState(false)

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    setBusy(true);setMessage('');setSuccess(false)
    const form=new FormData(e.currentTarget)
    const current=String(form.get('current')||'')
    const next=String(form.get('next')||'')
    const confirm=String(form.get('confirm')||'')
    if(next.length<8){setBusy(false);setMessage('New password must be at least 8 characters.');return}
    if(next!==confirm){setBusy(false);setMessage('New passwords do not match.');return}
    const {data:{user}}=await supabase.auth.getUser()
    if(!user?.email){setBusy(false);setMessage('Session expired. Sign in again.');return}
    const {error:signInError}=await supabase.auth.signInWithPassword({email:user.email,password:current})
    if(signInError){setBusy(false);setMessage('Current password is incorrect.');return}
    const {error}=await supabase.auth.updateUser({password:next})
    setBusy(false)
    if(error){setMessage(error.message);return}
    setSuccess(true);setMessage('Password changed successfully.')
    e.currentTarget.reset()
  }

  return <section><div className="adminPageHead"><div><span className="adminEyebrow">ACCOUNT SECURITY</span><h1>Change Password</h1><p>Update the password for the signed-in admin account.</p></div></div><div className="adminSecurityCard"><form className="adminSecurityForm" onSubmit={submit}><label>Current Password<input name="current" type="password" required autoComplete="current-password"/></label><label>New Password<input name="next" type="password" minLength={8} required autoComplete="new-password"/></label><label>Confirm New Password<input name="confirm" type="password" minLength={8} required autoComplete="new-password"/></label>{message&&<div className={success?'adminSecuritySuccess':'adminError'}>{message}</div>}<button className="btn btnPrimary" disabled={busy}>{busy?'Updating…':'Change Password'}</button></form></div></section>
}

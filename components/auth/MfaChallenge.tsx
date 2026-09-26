'use client'
import {FormEvent,useState} from 'react'
import {supabase} from '../../lib/supabase'
import type {MfaFactor} from '../../lib/mfa'

export default function MfaChallenge({factors,onVerified}:{factors:MfaFactor[];onVerified:()=>void|Promise<void>}){
  const verified=factors.filter(f=>f.factor_type==='totp'&&f.status==='verified')
  const [selected,setSelected]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const factorId=verified.some(f=>f.id===selected)?selected:verified[0]?.id
  async function submit(event:FormEvent){
    event.preventDefault();setError('')
    if(!factorId||!/^\d{6}$/.test(code)){setError('Enter the 6-digit code from your authenticator.');return}
    setBusy(true)
    try{
      const {error}=await supabase.auth.mfa.challengeAndVerify({factorId,code})
      if(error)throw error
      setCode('');await onVerified()
    }catch(error:any){setError(error.message||'Could not verify the code. Try the latest code.');setCode('')}
    finally{setBusy(false)}
  }
  return <section className="adminSecurityCard"><h2>Verify your authenticator</h2><p>Open your authenticator app and enter its current code to finish signing in.</p>
    {verified.length?<form className="adminSecurityForm" onSubmit={submit}>
      {verified.length>1&&<label>Authenticator<select value={factorId} onChange={e=>{setSelected(e.target.value);setCode('')}}>{verified.map((factor,i)=><option key={factor.id} value={factor.id}>{factor.friendly_name||`Authenticator ${i+1}`}</option>)}</select></label>}
      <label>Authenticator code<input name="code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus/></label>
      {error&&<p className="adminError" role="alert">{error}</p>}
      <button className="btn btnPrimary" disabled={busy}>{busy?'Verifying…':'Verify & continue'}</button>
    </form>:<p role="alert">No supported authenticator is available. Contact your account administrator for recovery.</p>}
    <details><summary>Lost access to your authenticator?</summary><p>Use another authenticator linked to this account. If none is available, contact your company administrator for an identity-verified reset. The owner administrator must use the Supabase project recovery process. A password reset alone does not remove 2FA.</p></details>
  </section>
}

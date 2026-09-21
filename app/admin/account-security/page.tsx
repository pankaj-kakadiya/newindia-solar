'use client'
import {FormEvent,useEffect,useState} from 'react'
import Link from 'next/link'
import {useRouter,useSearchParams} from 'next/navigation'
import {supabase} from '../../../lib/supabase'
import {MfaState,needsMfaChallenge,readMfaState} from '../../../lib/mfa'
import MfaChallenge from '../../../components/auth/MfaChallenge'

export default function AccountSecurity(){
  const router=useRouter(),required=useSearchParams().get('required')==='1'
  const [state,setState]=useState<MfaState|null>(null),[policy,setPolicy]=useState(false),[mustChange,setMustChange]=useState(false)
  const [pending,setPending]=useState<{id:string;qr:string;secret:string}|null>(null),[code,setCode]=useState(''),[name,setName]=useState('')
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false)
  async function load(){
    const {data:{user},error}=await supabase.auth.getUser()
    if(error||!user)throw Error('Your session expired. Sign in again.')
    const [mfa,profile]=await Promise.all([readMfaState(supabase),supabase.from('profiles').select('mfa_required,must_change_password').eq('id',user.id).single()])
    if(profile.error)throw profile.error
    setState(mfa);setPolicy(Boolean(profile.data.mfa_required));setMustChange(Boolean(profile.data.must_change_password));setFailed(false)
    return {mfa,policy:Boolean(profile.data.mfa_required),mustChange:Boolean(profile.data.must_change_password)}
  }
  async function refresh(){try{await load()}catch(error:any){setFailed(true);setMessage(error.message)}}
  useEffect(()=>{refresh()},[])
  async function verified(){
    const next=await load()
    if(next.mfa.currentLevel!=='aal2')throw Error('Verification did not complete. Please try again.')
    setMessage('Authenticator verified. This session is protected.')
    if(required||next.mustChange)router.replace(next.mustChange?'/admin/change-password?required=1':'/admin')
  }
  async function enroll(){
    setBusy(true);setMessage('')
    try{
      const current=await load()
      if(needsMfaChallenge(current.mfa))throw Error('Verify your existing authenticator before adding another.')
      const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:name.trim()||`New India Solar ${Date.now()}`})
      if(error)throw error
      setPending({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});setCode('');await load()
    }catch(error:any){setMessage(error.message)}finally{setBusy(false)}
  }
  async function activate(event:FormEvent){
    event.preventDefault();setBusy(true);setMessage('')
    try{
      if(!pending||!/^\d{6}$/.test(code))throw Error('Enter the 6-digit code from your authenticator.')
      const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:pending.id,code})
      if(error)throw error
      setPending(null);setCode('');setName('');await verified()
    }catch(error:any){setMessage(error.message);setCode('')}finally{setBusy(false)}
  }
  async function remove(id:string){
    if(!window.confirm('Remove this authenticator from your account?'))return
    setBusy(true);setMessage('')
    try{
      const current=await load(),factor=current.mfa.factors.find(f=>f.id===id)
      if(factor?.status==='verified'&&current.mfa.currentLevel!=='aal2')throw Error('Verify your authenticator before removing it.')
      if(factor?.status==='verified'&&current.policy&&current.mfa.factors.filter(f=>f.status==='verified').length<=1)throw Error('2FA is required. Add and verify a replacement before removing the last authenticator.')
      const {error}=await supabase.auth.mfa.unenroll({factorId:id});if(error)throw error
      if(pending?.id===id){setPending(null);setCode('')}
      const {error:refreshError}=await supabase.auth.refreshSession();if(refreshError)throw refreshError
      await load();setMessage('Authenticator removed.')
    }catch(error:any){setMessage(error.message)}finally{setBusy(false)}
  }
  async function signOut(others:boolean){
    setBusy(true);setMessage('')
    try{const {error}=await supabase.auth.signOut({scope:others?'others':'local'});if(error)throw error;if(others)setMessage('Other device refresh sessions signed out.');else router.replace('/admin/login')}
    catch(error:any){setMessage(error.message)}finally{setBusy(false)}
  }
  const challenge=state&&needsMfaChallenge(state),verifiedCount=state?.factors.filter(f=>f.status==='verified').length||0
  return <section><div className="adminPageHead"><div><span className="adminEyebrow">ACCOUNT SECURITY</span><h1>Login & Device Security</h1><p>{required?'Complete account security to continue.':'Protect your account with an authenticator and manage device sessions.'}</p></div><button className="btn" disabled={busy} onClick={refresh}>Refresh</button></div>
    {message&&<p className="adminError" role="status">{message}</p>}
    {failed?<button className="btn" onClick={refresh}>Retry security check</button>:!state?<p>Loading account security…</p>:<>
      <div className="adminSecurityCard"><h2>{state.currentLevel==='aal2'?'Session protected by 2FA':'Password-only session'}</h2><p>{verifiedCount} verified authenticator{verifiedCount===1?'':'s'}{policy?' · 2FA required by your administrator':''}</p></div>
      {challenge?<MfaChallenge factors={state.factors} onVerified={verified}/>:<>
        <div className="adminSecurityCard"><h2>Authenticator apps</h2><p>Use Google Authenticator, Microsoft Authenticator, 1Password, Authy or another TOTP app. Add a second authenticator as a backup.</p>
          {state.factors.map(factor=><div className="adminSecurityFactor" key={factor.id}><span><b>{factor.friendly_name||'Authenticator'}</b><small> {factor.status==='verified'?'Verified':'Setup incomplete — cancel and start again if you no longer see the QR code'}</small></span><button className="btn" disabled={busy||(policy&&factor.status==='verified'&&verifiedCount<=1)} onClick={()=>remove(factor.id)}>{factor.status==='verified'?'Remove':'Cancel setup'}</button></div>)}
          {pending?<form className="adminSecurityForm" onSubmit={activate}>
            <p>1. Scan this QR code. Keep the setup key private.</p><img src={pending.qr} width={220} height={220} alt="Scan with your authenticator app"/>
            <details><summary>Enter a setup key manually</summary><code style={{overflowWrap:'anywhere'}}>{pending.secret}</code></details>
            <label>2. Enter the 6-digit code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/></label>
            <button className="btn btnPrimary" disabled={busy}>{busy?'Verifying…':'Verify & activate'}</button><button type="button" className="btn" disabled={busy} onClick={()=>remove(pending.id)}>Cancel setup</button>
          </form>:<div className="adminSecurityForm"><label>Device name (optional)<input value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="My phone or backup device"/></label><button className="btn btnPrimary" disabled={busy} onClick={enroll}>Add authenticator</button></div>}
          {policy&&verifiedCount===1&&<p>Add and verify a replacement before removing your last authenticator.</p>}
        </div>
        <div className="adminSecurityCard"><h2>Session controls</h2><button className="btn btnPrimary" disabled={busy} onClick={()=>signOut(true)}>Sign out other devices</button> <Link className="btn" href={mustChange?'/admin/change-password?required=1':'/admin/change-password'}>Change password</Link> {(!policy||state.currentLevel==='aal2')&&<Link className="btn" href="/admin">Continue to dashboard</Link>}</div>
      </>}
    </>}
    <button className="btn" disabled={busy} onClick={()=>signOut(false)}>Sign out</button>
  </section>
}

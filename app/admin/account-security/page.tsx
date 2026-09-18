'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import {KeyRound,LogOut,RefreshCw,ShieldCheck,Smartphone} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

type Factor={id:string;friendly_name?:string;status:string;factor_type:string}

export default function AccountSecurityPage(){
 const [factors,setFactors]=useState<Factor[]>([]),[aal,setAal]=useState('aal1'),[qr,setQr]=useState(''),[secret,setSecret]=useState(''),[pendingId,setPendingId]=useState(''),[code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function load(){
  const [{data:list,error},{data:levels}]=await Promise.all([supabase.auth.mfa.listFactors(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()])
  if(error){setMessage(error.message);return}
  setFactors((list?.all||[]) as Factor[]);setAal(levels?.currentLevel||'aal1')
 }
 useEffect(()=>{load()},[])
 async function enroll(){
  setBusy(true);setMessage('')
  const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'New India Solar Authenticator'})
  setBusy(false)
  if(error){setMessage(error.message);return}
  setPendingId(data.id);setQr(data.totp.qr_code);setSecret(data.totp.secret);setMessage('Scan the QR code, then enter the 6-digit code to finish setup.')
 }
 async function verify(){
  if(!pendingId||!/^[0-9]{6}$/.test(code))return
  setBusy(true);const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:pendingId,code});setBusy(false)
  if(error){setMessage(error.message);return}
  setQr('');setSecret('');setPendingId('');setCode('');setMessage('Authenticator verified. This session now has high-assurance access.');await load()
 }
 async function remove(id:string){
  if(!confirm('Remove this authenticator from your account?'))return
  setBusy(true);const {error}=await supabase.auth.mfa.unenroll({factorId:id});setBusy(false)
  if(error){setMessage(error.message);return}setMessage('Authenticator removed.');await load()
 }
 async function signOutOthers(){setBusy(true);const {error}=await supabase.auth.signOut({scope:'others'});setBusy(false);setMessage(error?error.message:'All other device sessions were signed out. This device remains signed in.')}
 return <section>
  <div className="adminPageHead"><div><span className="adminEyebrow">ACCOUNT SECURITY</span><h1>Login & Device Security</h1><p>Protect your admin account with an authenticator and control active device sessions.</p></div><button className="btn" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
  {message&&<div className="accessMessage" role="status"><ShieldCheck size={16}/>{message}</div>}
  <div className="accessStats"><article><span><ShieldCheck/></span><div><small>Current Session</small><strong>{aal==='aal2'?'Verified':'Password only'}</strong><p>{aal==='aal2'?'Two-factor assurance active':'Complete authenticator verification'}</p></div></article><article><span><Smartphone/></span><div><small>Authenticators</small><strong>{factors.filter(f=>f.status==='verified').length}</strong><p>Verified TOTP factors</p></div></article></div>
  <div className="accessTeamLayout">
   <section className="accessPanel"><div className="accessPanelHead"><div><h2>Authenticator App</h2><p>Use Google Authenticator, Microsoft Authenticator, 1Password, Authy, or another TOTP app.</p></div><Smartphone/></div>
    {factors.length?<div className="overrideRows">{factors.map(f=><div key={f.id}><span><b>{f.friendly_name||'Authenticator'}</b><small>{f.factor_type.toUpperCase()} · {f.status}</small></span><em className={f.status==='verified'?'allow':'deny'}>{f.status.toUpperCase()}</em><button onClick={()=>remove(f.id)} disabled={busy}>Remove</button></div>)}</div>:<p className="overrideEmpty">No authenticator is enrolled yet.</p>}
    {!pendingId&&<button className="accessPrimary" onClick={enroll} disabled={busy}><Smartphone size={15}/> Add Authenticator</button>}
    {qr&&<div className="adminSecurityForm"><img src={qr} alt="Authenticator setup QR code" width={220} height={220}/><label>Manual setup key<input readOnly value={secret}/></label><label>6-digit verification code<input inputMode="numeric" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}/></label><button className="accessPrimary" onClick={verify} disabled={busy||code.length!==6}>Verify & Activate</button></div>}
   </section>
   <section className="accessPanel"><div className="accessPanelHead"><div><h2>Session Controls</h2><p>Immediately invalidate refresh sessions on every other browser and device.</p></div><LogOut/></div><button className="accessPrimary" onClick={signOutOthers} disabled={busy}><LogOut size={15}/> Sign Out Other Devices</button><div className="accessSecurityNote"><KeyRound size={17}/><span>For best protection, also use a unique 12+ character password and never share an authenticator code.</span></div><Link className="accessPrimary" href="/admin/change-password"><KeyRound size={15}/> Change Password</Link></section>
  </div>
 </section>
}

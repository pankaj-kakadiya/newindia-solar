'use client'
import {FormEvent,useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {indianPhone} from '../lib/buyer-account'
export default function PhoneOtp({link=false,onSuccess}:{link?:boolean;onSuccess:()=>void}){
 const [available,setAvailable]=useState<boolean|null>(null),[phone,setPhone]=useState(''),[sent,setSent]=useState(false),[otp,setOtp]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[until,setUntil]=useState(0),[remaining,setRemaining]=useState(0)
 useEffect(()=>{fetch('/api/auth/phone-status',{cache:'no-store'}).then(r=>r.json()).then(j=>setAvailable(j.available===true)).catch(()=>setAvailable(false))},[])
 useEffect(()=>{const timer=setInterval(()=>setRemaining(Math.max(0,Math.ceil((until-Date.now())/1000))),1000);return()=>clearInterval(timer)},[until])
 async function send(){
  const normalized=indianPhone(phone);if(!normalized){setMessage('Enter a valid 10-digit Indian mobile number.');return}
  setBusy(true);setMessage('')
  try{const result=link?await supabase.auth.updateUser({phone:normalized}):await supabase.auth.signInWithOtp({phone:normalized,options:{shouldCreateUser:true}})
   if(result.error)throw result.error
   setPhone(normalized);setSent(true);setUntil(Date.now()+60000);setRemaining(60);setMessage('OTP sent. Check your SMS messages.')
  }catch(e:any){setMessage(e.message||'Could not send OTP. Please try again.')}finally{setBusy(false)}
 }
 async function verify(e:FormEvent){e.preventDefault();if(!sent){await send();return}setBusy(true);setMessage('')
  try{const {error}=await supabase.auth.verifyOtp({phone:indianPhone(phone)!,token:otp,type:link?'phone_change':'sms'});if(error)throw error;onSuccess()}
  catch(e:any){setMessage(e.message||'OTP could not be verified.')}finally{setBusy(false)}
 }
 return <section className="buyerOtp">{available===null?<p>Checking mobile sign-in…</p>:!available?<p role="status">Mobile OTP sign-in is not available yet. Please use email sign-in.</p>:<form className="authForm" onSubmit={verify}><label>Mobile number<input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} disabled={sent||busy} placeholder="10-digit mobile number" required/></label>{sent&&<label>One-time password<input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/></label>}<button className="nisPrimaryBtn" disabled={busy}>{busy?'Please wait…':sent?'Verify OTP':link?'Send verification OTP':'Send OTP'}</button>{sent&&<div className="buyerActions"><button type="button" disabled={busy||remaining>0} onClick={send}>{remaining>0?`Resend in ${remaining}s`:'Resend OTP'}</button><button type="button" disabled={busy} onClick={()=>{setSent(false);setOtp('');setMessage('')}}>Change number</button></div>}</form>}{message&&<p role="status">{message}</p>}{!link&&available&&<p className="buyerHint">Already have an email account? Sign in with email first and link your mobile from Profile to keep your order history together.</p>}</section>
}

'use client'

import {useEffect,useRef,useState} from 'react'
import {usePathname,useRouter} from 'next/navigation'
import {Clock3} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {moduleForAdminPath} from '../../lib/adminAccess'
import {ACTIVE_KEY,idleState,sessionEndMessage} from '../../lib/adminSession'

/**
 * Keeps an admin session honest while pages are open:
 *  - a heartbeat every minute tells the database whether the person was active (the database then
 *    enforces the idle timeout, one session per person and the maximum session length);
 *  - after `idleMinutes` without keyboard, mouse or touch, a 60-second warning, then sign-out;
 *  - every page opened is recorded in the activity log.
 * Activity is shared across tabs through localStorage, so working in one tab keeps the others alive.
 */
export default function AdminSessionWatch({userId,idleMinutes,trackPages}:{userId:string;idleMinutes:number;trackPages:boolean}){
 const router=useRouter(),path=usePathname()
 const [warning,setWarning]=useState<number|null>(null)
 const lastBeat=useRef(0),ending=useRef(false)
 const key=`${ACTIVE_KEY}-${userId}`
 const readActive=()=>{try{return Number(window.localStorage.getItem(key))||Date.now()}catch{return Date.now()}}
 const markActive=()=>{try{window.localStorage.setItem(key,String(Date.now()))}catch{}}

 async function endSession(reason:string){
  if(ending.current)return
  ending.current=true
  if(reason==='idle'||reason==='logout')await Promise.resolve(supabase.rpc('end_admin_session',{p_reason:reason})).catch(()=>{})
  await supabase.auth.signOut({scope:'local'}).catch(()=>{})
  try{window.sessionStorage.clear()}catch{}
  router.replace(`/admin/login?reason=${encodeURIComponent(reason)}`)
 }
 async function beat(force=false){
  if(ending.current)return
  const active=readActive()>lastBeat.current||force
  lastBeat.current=Date.now()
  const {data,error}=await supabase.rpc('admin_session_heartbeat',{p_active:active})
  if(error)return // network blips must not sign anyone out
  const status=(data as any)?.status
  if(status&&status!=='ok'&&status!=='not_staff')await endSession(status)
 }

 useEffect(()=>{
  markActive()
  let last=0
  const onActivity=()=>{const now=Date.now();if(now-last>5000){last=now;markActive()}}
  const events=['mousemove','mousedown','keydown','scroll','touchstart','wheel']
  for(const e of events)window.addEventListener(e,onActivity,{passive:true})
  const onVisible=()=>{if(document.visibilityState==='visible')beat()}
  document.addEventListener('visibilitychange',onVisible)
  beat(true)
  const hb=window.setInterval(()=>beat(),60_000)
  const tick=window.setInterval(()=>{
   const s=idleState(readActive(),Date.now(),idleMinutes)
   if(s.expired){setWarning(null);endSession('idle')}else setWarning(s.warnSeconds)
  },1000)
  return()=>{for(const e of events)window.removeEventListener(e,onActivity);document.removeEventListener('visibilitychange',onVisible);window.clearInterval(hb);window.clearInterval(tick)}
 },[userId,idleMinutes])

 useEffect(()=>{
  if(!trackPages)return
  void Promise.resolve(supabase.rpc('log_admin_activity',{p_event:'page_view',p_module:moduleForAdminPath(path),p_path:path})).catch(()=>{})
 },[path,trackPages])

 if(warning==null)return null
 return <div className="sessionWarnBackdrop" role="alertdialog" aria-labelledby="sessionWarnTitle">
  <div className="sessionWarn">
   <Clock3 size={26}/>
   <h2 id="sessionWarnTitle">Still there?</h2>
   <p>{sessionEndMessage('idle-soon',warning)}</p>
   <div><button className="adminBtn" onClick={()=>{markActive();setWarning(null);beat(true)}}>Stay signed in</button><button className="adminBtn ghost" onClick={()=>endSession('logout')}>Sign out now</button></div>
  </div>
 </div>
}

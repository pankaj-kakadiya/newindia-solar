'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {usePathname} from 'next/navigation'
import {Headphones,MessageCircle,X} from 'lucide-react'
import {supabase} from '../../lib/supabase'
export default function SupportLauncher(){
 const path=usePathname(),[open,setOpen]=useState(false),[signedIn,setSignedIn]=useState(false)
 useEffect(()=>{supabase.auth.getUser().then(({data})=>setSignedIn(Boolean(data.user)));const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSignedIn(Boolean(s?.user)));return()=>data.subscription.unsubscribe()},[])
 useEffect(()=>setOpen(false),[path])
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[open])
 if(path.startsWith('/admin')||path==='/account/support'||path.startsWith('/login'))return null
 return <div className={`supportLauncher ${open?'open':''}`}><button type="button" className="supportLauncherButton" onClick={()=>setOpen(v=>!v)} aria-label={open?'Close support':'Open support chat'} aria-expanded={open} aria-controls="support-launcher-panel">{open?<X/>:<MessageCircle/>}<span>Support</span></button>{open&&<aside id="support-launcher-panel" role="dialog" aria-label="Support chat"><span><Headphones/> New India Solar Support</span><h2>How can we help?</h2><p>Chat with our team about products, orders, payments, delivery or technical questions.</p><Link href={signedIn?'/account/support':'/login?next=/account/support'}>{signedIn?'Open support chat':'Sign in to start chat'}</Link><small>Your conversations are available inside your account.</small></aside>}</div>
}

'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {usePathname} from 'next/navigation'
import {LockKeyhole,MessageCircle,X} from 'lucide-react'
import {supabase} from '../../lib/supabase'
export default function SupportLauncher(){
 const path=usePathname(),[open,setOpen]=useState(false),[signedIn,setSignedIn]=useState(false)
 useEffect(()=>{supabase.auth.getUser().then(({data})=>setSignedIn(Boolean(data.user)));const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSignedIn(Boolean(s?.user)));return()=>data.subscription.unsubscribe()},[])
 if(path.startsWith('/admin')||path==='/account/support'||path.startsWith('/login'))return null
 return <div className={`supportLauncher ${open?'open':''}`}><button className="supportLauncherButton" onClick={()=>setOpen(v=>!v)} aria-label={open?'Close support':'Open secure support'}>{open?<X/>:<MessageCircle/>}<span>Support</span></button>{open&&<aside><span><LockKeyhole/> End-to-end encrypted</span><h2>How can we help?</h2><p>Chat privately with New India Solar for product, order, payment, delivery or technical support.</p><Link href={signedIn?'/account/support':'/login?next=/account/support'}>{signedIn?'Open secure chat':'Sign in to chat securely'}</Link><small>Your message content is encrypted in your browser.</small></aside>}</div>
}

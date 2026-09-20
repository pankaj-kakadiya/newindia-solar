'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'
import {usePathname} from 'next/navigation'
import {MessageCircle} from 'lucide-react'
import {supabase} from '../../lib/supabase'

export default function SupportLauncher(){
 const path=usePathname()
 const [signedIn,setSignedIn]=useState(false)
 useEffect(()=>{supabase.auth.getUser().then(({data})=>setSignedIn(Boolean(data.user)));const {data}=supabase.auth.onAuthStateChange((_event,session)=>setSignedIn(Boolean(session?.user)));return()=>data.subscription.unsubscribe()},[])
 if(path.startsWith('/admin')||path==='/account/support'||path.startsWith('/login'))return null
 const href=signedIn?'/account/support':'/login?next=/account/support'
 return <div className="supportLauncher"><Link className="supportLauncherButton" href={href} aria-label="Open New India Solar support chat"><span className="supportLauncherPulse"/><MessageCircle/><span><b>Chat support</b><small>Online</small></span></Link></div>
}

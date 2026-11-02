'use client'

import {useEffect} from 'react'
import {Check,TriangleAlert,X} from 'lucide-react'

/**
 * Success and error messages as small notifications in the top-right corner, above drawers,
 * so they are seen whatever is open. Success clears after 4 s, errors after 9 s or on ×.
 */
export default function Toasts({msg,err,onClear}:{msg:string;err:string;onClear:(kind:'msg'|'err')=>void}){
 useEffect(()=>{if(!msg)return;const t=window.setTimeout(()=>onClear('msg'),4000);return()=>window.clearTimeout(t)},[msg])
 useEffect(()=>{if(!err)return;const t=window.setTimeout(()=>onClear('err'),9000);return()=>window.clearTimeout(t)},[err])
 if(!msg&&!err)return null
 return <div className="campToasts" aria-live="polite">
  {err&&<div className="campToast error" role="alert"><TriangleAlert size={17}/><span>{err}</span><button type="button" aria-label="Dismiss" onClick={()=>onClear('err')}><X size={15}/></button></div>}
  {msg&&<div className="campToast ok" role="status"><Check size={17}/><span>{msg}</span><button type="button" aria-label="Dismiss" onClick={()=>onClear('msg')}><X size={15}/></button></div>}
 </div>
}

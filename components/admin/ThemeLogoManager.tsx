'use client'

import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import {CheckCircle2,ImageUp,Link as LinkIcon,RotateCcw,Upload} from 'lucide-react'
import {supabase} from '../../lib/supabase'

const DEFAULT_LOGO='/new-india-solar-logo.webp'
const ALLOWED=['image/png','image/jpeg','image/webp','image/svg+xml']
const MAX=5*1024*1024

type LogoTarget='all'|'headerLogoUrl'|'footerLogoUrl'|'mobileLogoUrl'|'faviconUrl'|'emailLogoUrl'|'invoiceLogoUrl'
const TARGETS:{value:LogoTarget;label:string;help:string}[]=[
  {value:'all',label:'Master Logo — Everywhere',help:'Header, footer, mobile menu, favicon, email and invoice'},
  {value:'headerLogoUrl',label:'Desktop Header',help:'Main website navigation header'},
  {value:'footerLogoUrl',label:'Footer',help:'Website footer brand block'},
  {value:'mobileLogoUrl',label:'Mobile Menu',help:'Drawer / mobile navigation'},
  {value:'faviconUrl',label:'Browser Favicon',help:'Browser tab icon'},
  {value:'emailLogoUrl',label:'Email Logo',help:'Transactional email branding'},
  {value:'invoiceLogoUrl',label:'Invoice Logo',help:'GST invoice / PDF branding'}
]

export default function ThemeLogoManager(){
  const [branding,setBranding]=useState<any>({logoUrl:DEFAULT_LOGO})
  const [manual,setManual]=useState(DEFAULT_LOGO)
  const [target,setTarget]=useState<LogoTarget>('all')
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState(false)

  const current=useMemo(()=>target==='all'?(branding.logoUrl||DEFAULT_LOGO):(branding[target]||branding.logoUrl||DEFAULT_LOGO),[branding,target])
  const selectedTarget=TARGETS.find(x=>x.value===target)!

  useEffect(()=>{let alive=true;(async()=>{const {data}=await supabase.from('theme_settings').select('settings').eq('key','storefront').maybeSingle();const b=data?.settings?.branding||{};if(alive){setBranding(b);setManual(b.logoUrl||DEFAULT_LOGO)}})();return()=>{alive=false}},[])
  useEffect(()=>{setManual(current)},[target,current])
  useEffect(()=>()=>{if(preview.startsWith('blob:'))URL.revokeObjectURL(preview)},[preview])

  function selectFile(e:ChangeEvent<HTMLInputElement>){
    const chosen=e.target.files?.[0]||null;setMessage('');setError(false)
    if(!chosen){setFile(null);return}
    if(!ALLOWED.includes(chosen.type)){setError(true);setMessage('Use PNG, JPG, WEBP or SVG.');e.target.value='';return}
    if(chosen.size>MAX){setError(true);setMessage('Logo must be 5 MB or smaller.');e.target.value='';return}
    if(preview.startsWith('blob:'))URL.revokeObjectURL(preview)
    setFile(chosen);setPreview(URL.createObjectURL(chosen))
  }

  function nextBranding(old:any,url:string){
    const base={...old,logoAlt:old?.logoAlt||'New India Solar Components Pvt Ltd'}
    if(target==='all')return {...base,logoUrl:url,headerLogoUrl:url,footerLogoUrl:url,mobileLogoUrl:url,faviconUrl:url,emailLogoUrl:url,invoiceLogoUrl:url}
    return {...base,[target]:url}
  }

  async function updateThemeLogo(url:string){
    const {data,error:readError}=await supabase.from('theme_settings').select('settings').eq('key','storefront').single()
    if(readError)throw readError
    const settings=data?.settings||{}
    const nextB=nextBranding(settings.branding||{},url)
    const next={...settings,branding:nextB}
    const {data:{user}}=await supabase.auth.getUser()
    const {error:updateError}=await supabase.from('theme_settings').update({settings:next,updated_by:user?.id||null}).eq('key','storefront')
    if(updateError)throw updateError
    setBranding(nextB)
  }

  async function upload(){
    if(!file)return
    setBusy(true);setMessage('');setError(false)
    try{
      const {data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('Your session has expired. Sign in again.')
      const body=new FormData();body.append('file',file);body.append('target',target)
      const res=await fetch('/api/admin/theme/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body})
      const json=await res.json().catch(()=>({}))
      if(!res.ok)throw new Error(json.error||'Could not upload logo.')
      const url=json.url
      await updateThemeLogo(url)
      setManual(url);setFile(null);setPreview('');setMessage(target==='all'?'Master logo published to every brand surface.':`${selectedTarget.label} logo published.`)
    }catch(e:any){setError(true);setMessage(e?.message||'Could not upload logo.')}
    finally{setBusy(false)}
  }

  async function applyManual(){
    const url=manual.trim();if(!url){setError(true);setMessage('Enter a logo URL or public path.');return}
    setBusy(true);setError(false);setMessage('')
    try{await updateThemeLogo(url);setMessage(target==='all'?'Master logo path published everywhere.':`${selectedTarget.label} logo path published.`)}catch(e:any){setError(true);setMessage(e?.message||'Could not update logo.')}finally{setBusy(false)}
  }

  async function restore(){
    setBusy(true);setError(false);setMessage('')
    try{await updateThemeLogo(DEFAULT_LOGO);setManual(DEFAULT_LOGO);setPreview('');setFile(null);setMessage(target==='all'?'Official default logo restored everywhere.':`Official default restored for ${selectedTarget.label}.`)}catch(e:any){setError(true);setMessage(e?.message||'Could not restore logo.')}finally{setBusy(false)}
  }

  return <section className="themeLogoManager">
    <div className="themeLogoTitle"><div className="themeLogoIcon"><ImageUp size={21}/></div><div><span>BRAND ASSET MANAGER</span><h2>Change Logo</h2><p>Upload one master logo everywhere or assign separate files for the header, footer, mobile menu, favicon, emails and invoices.</p></div></div>
    <div className="themeLogoTargetRow"><label><span>Apply logo to</span><select value={target} onChange={e=>{setTarget(e.target.value as LogoTarget);setFile(null);setPreview('');setMessage('')}}>{TARGETS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select><small>{selectedTarget.help}</small></label></div>
    <div className="themeLogoGrid">
      <div className="themeLogoPreview"><small>CURRENT / NEW LOGO PREVIEW</small><div><img src={preview||current} alt="Store logo preview"/></div><span>Recommended: wide transparent PNG/WEBP or SVG • max 5 MB</span></div>
      <div className="themeLogoControls">
        <label className="themeLogoDrop"><Upload size={20}/><b>{file?file.name:'Choose logo file'}</b><span>PNG, JPG, WEBP or SVG</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={selectFile}/></label>
        <button className="themeLogoPrimary" disabled={!file||busy} onClick={upload}><Upload size={16}/>{busy?'Publishing…':target==='all'?'Upload & Publish Everywhere':'Upload & Publish'}</button>
        <div className="themeLogoOr"><span>OR</span></div>
        <label className="themeLogoUrl"><span><LinkIcon size={14}/> Logo URL / Public Path</span><div><input value={manual} onChange={e=>setManual(e.target.value)} placeholder="/logo.svg or https://..."/><button disabled={busy} onClick={applyManual}>Apply</button></div></label>
        <button className="themeLogoRestore" disabled={busy} onClick={restore}><RotateCcw size={15}/> Restore official default for this selection</button>
        {message&&<div className={error?'themeLogoMessage error':'themeLogoMessage'}>{!error&&<CheckCircle2 size={16}/>}<span>{message}</span></div>}
      </div>
    </div>
  </section>
}

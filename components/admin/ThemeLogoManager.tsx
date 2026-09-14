'use client'

import {ChangeEvent,useEffect,useState} from 'react'
import {CheckCircle2,ImageUp,Link as LinkIcon,RotateCcw,Upload} from 'lucide-react'
import {supabase} from '../../lib/supabase'

const DEFAULT_LOGO='/new-india-solar-logo.webp'
const ALLOWED=['image/png','image/jpeg','image/webp','image/svg+xml']
const MAX=5*1024*1024

export default function ThemeLogoManager(){
  const [current,setCurrent]=useState(DEFAULT_LOGO)
  const [manual,setManual]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState(false)

  useEffect(()=>{let alive=true;(async()=>{const {data}=await supabase.from('theme_settings').select('settings').eq('key','storefront').maybeSingle();const url=data?.settings?.branding?.logoUrl||DEFAULT_LOGO;if(alive){setCurrent(url);setManual(url)}})();return()=>{alive=false}},[])
  useEffect(()=>()=>{if(preview.startsWith('blob:'))URL.revokeObjectURL(preview)},[preview])

  function selectFile(e:ChangeEvent<HTMLInputElement>){
    const chosen=e.target.files?.[0]||null;setMessage('');setError(false)
    if(!chosen){setFile(null);return}
    if(!ALLOWED.includes(chosen.type)){setError(true);setMessage('Use PNG, JPG, WEBP or SVG.');e.target.value='';return}
    if(chosen.size>MAX){setError(true);setMessage('Logo must be 5 MB or smaller.');e.target.value='';return}
    if(preview.startsWith('blob:'))URL.revokeObjectURL(preview)
    setFile(chosen);setPreview(URL.createObjectURL(chosen))
  }

  async function updateThemeLogo(url:string){
    const {data,error:readError}=await supabase.from('theme_settings').select('settings').eq('key','storefront').single()
    if(readError)throw readError
    const settings=data?.settings||{}
    const next={...settings,branding:{...(settings.branding||{}),logoUrl:url,logoAlt:settings.branding?.logoAlt||'New India Solar Components Pvt Ltd'}}
    const {data:{user}}=await supabase.auth.getUser()
    const {error:updateError}=await supabase.from('theme_settings').update({settings:next,updated_by:user?.id||null}).eq('key','storefront')
    if(updateError)throw updateError
  }

  async function upload(){
    if(!file)return
    setBusy(true);setMessage('');setError(false)
    try{
      const ext=(file.name.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,'')
      const path=`branding/logo-${Date.now()}.${ext}`
      const {error:uploadError}=await supabase.storage.from('theme-assets').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false})
      if(uploadError)throw uploadError
      const {data:urlData}=supabase.storage.from('theme-assets').getPublicUrl(path)
      const url=urlData.publicUrl
      await updateThemeLogo(url)
      setCurrent(url);setManual(url);setFile(null);setPreview('');setMessage('Logo uploaded and published to header + footer.')
    }catch(e:any){setError(true);setMessage(e?.message||'Could not upload logo.')}
    finally{setBusy(false)}
  }

  async function applyManual(){
    const url=manual.trim();if(!url){setError(true);setMessage('Enter a logo URL or public path.');return}
    setBusy(true);setError(false);setMessage('')
    try{await updateThemeLogo(url);setCurrent(url);setMessage('Logo path published to header + footer.')}catch(e:any){setError(true);setMessage(e?.message||'Could not update logo.')}finally{setBusy(false)}
  }

  async function restore(){
    setBusy(true);setError(false);setMessage('')
    try{await updateThemeLogo(DEFAULT_LOGO);setCurrent(DEFAULT_LOGO);setManual(DEFAULT_LOGO);setPreview('');setFile(null);setMessage('Official default logo restored.')}catch(e:any){setError(true);setMessage(e?.message||'Could not restore logo.')}finally{setBusy(false)}
  }

  return <section className="themeLogoManager">
    <div className="themeLogoTitle"><div className="themeLogoIcon"><ImageUp size={21}/></div><div><span>BRAND ASSET</span><h2>Change Store Logo</h2><p>Upload a new master logo here. It publishes automatically to the desktop header, mobile menu and footer.</p></div></div>
    <div className="themeLogoGrid">
      <div className="themeLogoPreview"><small>CURRENT / NEW LOGO PREVIEW</small><div><img src={preview||current} alt="Store logo preview"/></div><span>Recommended: wide transparent PNG/WEBP or SVG • max 5 MB</span></div>
      <div className="themeLogoControls">
        <label className="themeLogoDrop"><Upload size={20}/><b>{file?file.name:'Choose logo file'}</b><span>PNG, JPG, WEBP or SVG</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={selectFile}/></label>
        <button className="themeLogoPrimary" disabled={!file||busy} onClick={upload}><Upload size={16}/>{busy?'Publishing…':'Upload & Publish Logo'}</button>
        <div className="themeLogoOr"><span>OR</span></div>
        <label className="themeLogoUrl"><span><LinkIcon size={14}/> Logo URL / Public Path</span><div><input value={manual} onChange={e=>setManual(e.target.value)} placeholder="/logo.svg or https://..."/><button disabled={busy} onClick={applyManual}>Apply</button></div></label>
        <button className="themeLogoRestore" disabled={busy} onClick={restore}><RotateCcw size={15}/> Restore official default</button>
        {message&&<div className={error?'themeLogoMessage error':'themeLogoMessage'}>{!error&&<CheckCircle2 size={16}/>}<span>{message}</span></div>}
      </div>
    </div>
  </section>
}

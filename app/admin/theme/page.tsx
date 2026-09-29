'use client'

import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {Check,Code2,Eye,Image as ImageIcon,MonitorCog,Palette,RotateCcw,Save,Type,Upload,WandSparkles} from 'lucide-react'
import {supabase} from '../../../lib/supabase'
import {defaultTheme,mergeTheme,StoreTheme} from '../../../components/ThemeProvider'

const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v))

type BrandKey=keyof StoreTheme['branding']

const presets:{name:string;note:string;theme:Partial<StoreTheme>}[]=[
  {name:'New India Default',note:'Official industrial navy + energy green',theme:{}},
  {name:'Midnight Solar',note:'Dark premium storefront',theme:{colors:{...defaultTheme.colors,background:'#07131F',surface:'#0D1B2A',text:'#F4F7F5',muted:'#AAB9C4',border:'#263847',headerBg:'#0A1824',footerBg:'#02080D',heroStart:'#02080D',heroEnd:'#0E3824'}}},
  {name:'Clean Industrial',note:'Bright B2B catalogue look',theme:{colors:{...defaultTheme.colors,navy:'#132230',navy2:'#233A4B',primary:'#18864A',primary2:'#2EAA4F',surface:'#F7F9F8',background:'#FFFFFF',heroStart:'#132230',heroEnd:'#1C5035'}}},
  {name:'Solar Gold Accent',note:'Green core with stronger solar-gold emphasis',theme:{colors:{...defaultTheme.colors,gold:'#FFB703',orange:'#F77F00',primary:'#178B4B',primary2:'#26A85B',heroEnd:'#4A3B08'}}}
]

function ColorField({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="themeColorField"><span>{label}</span><div><input type="color" value={/^#[0-9A-F]{6}$/i.test(value)?value:'#000000'} onChange={e=>onChange(e.target.value.toUpperCase())}/><input value={value} onChange={e=>onChange(e.target.value)} /></div></label>}
function NumberField({label,value,onChange,min,max,step=1,suffix}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number;step?:number;suffix?:string}){return <label className="themeField"><span>{label}</span><div className="themeNumber"><input type="number" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))}/>{suffix&&<small>{suffix}</small>}</div></label>}
export default function ThemeAdmin(){
  const [theme,setTheme]=useState<StoreTheme>(clone(defaultTheme));const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [uploading,setUploading]=useState('');const [message,setMessage]=useState('');const [jsonText,setJsonText]=useState('');const [updatedAt,setUpdatedAt]=useState('')
  useEffect(()=>{(async()=>{const {data,error}=await supabase.from('theme_settings').select('settings,updated_at').eq('key','storefront').single();if(error){setMessage(error.message)}else if(data){const merged=mergeTheme(data.settings);setTheme(merged);setJsonText(JSON.stringify(merged,null,2));setUpdatedAt(data.updated_at||'')}setLoading(false)})()},[])
  useEffect(()=>{setJsonText(JSON.stringify(theme,null,2))},[theme])

  const previewVars=useMemo(()=>({'--p':theme.colors.primary,'--navy':theme.colors.navy,'--bg':theme.colors.background,'--surface':theme.colors.surface,'--text':theme.colors.text,'--muted':theme.colors.muted,'--border':theme.colors.border,'--radius':`${theme.layout.cardRadius}px`,'--btnRadius':`${theme.layout.buttonRadius}px`,'--head':theme.typography.headingFont,'--body':theme.typography.bodyFont} as React.CSSProperties),[theme])
  const setColor=(k:keyof StoreTheme['colors'],v:string)=>setTheme(t=>({...t,colors:{...t.colors,[k]:v}}))
  const setBrand=(k:BrandKey,v:string)=>setTheme(t=>({...t,branding:{...t.branding,[k]:v}}))
  const setType=(k:keyof StoreTheme['typography'],v:string|number)=>setTheme(t=>({...t,typography:{...t.typography,[k]:v}}))
  const setLayout=(k:keyof StoreTheme['layout'],v:number)=>setTheme(t=>({...t,layout:{...t.layout,[k]:v}}))

  async function save(){setSaving(true);setMessage('');const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from('theme_settings').upsert({key:'storefront',settings:theme,updated_by:user?.id||null},{onConflict:'key'});setSaving(false);if(error){setMessage(error.message);return}setUpdatedAt(new Date().toISOString());setMessage('Theme saved. Storefront changes are now live.')}
  async function uploadLogo(key:BrandKey,file?:File|null){if(!file)return;setUploading(key);setMessage('');const {data:{session}}=await supabase.auth.getSession();if(!session){setUploading('');setMessage('Your session has expired. Sign in again.');return}const body=new FormData();body.append('file',file);body.append('target',key);const res=await fetch('/api/admin/theme/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body});const json=await res.json().catch(()=>({}));if(!res.ok){setUploading('');setMessage(json.error||'Could not upload logo.');return}setBrand(key,json.url);setUploading('');setMessage('Logo uploaded. Check the preview, then click Save & Publish.')}
  function fileChange(key:BrandKey,e:ChangeEvent<HTMLInputElement>){uploadLogo(key,e.target.files?.[0]);e.target.value=''}
  function usePrimaryForAll(){setTheme(t=>({...t,branding:{...t.branding,headerLogoUrl:t.branding.logoUrl,footerLogoUrl:t.branding.logoUrl,mobileLogoUrl:t.branding.logoUrl,faviconUrl:t.branding.logoUrl,emailLogoUrl:t.branding.logoUrl,invoiceLogoUrl:t.branding.logoUrl}}));setMessage('Primary logo copied to all logo positions. Save to publish.')}
  function applyJson(){try{const parsed=JSON.parse(jsonText);setTheme(mergeTheme(parsed));setMessage('Theme JSON applied to editor. Save to publish.')}catch{setMessage('Theme JSON is not valid. Check commas, quotes and braces.')}}
  function applyPreset(p:(typeof presets)[number]){const base=clone(defaultTheme);setTheme(mergeTheme({...base,...p.theme,colors:{...base.colors,...p.theme.colors},branding:{...base.branding,...p.theme.branding},typography:{...base.typography,...p.theme.typography},layout:{...base.layout,...p.theme.layout},header:{...base.header,...p.theme.header}}));setMessage(`${p.name} loaded. Save to publish.`)}
  function restoreDefaults(){setTheme(clone(defaultTheme));setMessage('Official default theme restored in editor. Save to publish.')}

  const logoFields:{key:BrandKey;label:string;note:string}[]=[
    {key:'logoUrl',label:'Primary Logo',note:'Master fallback logo used when a specific logo is empty.'},
    {key:'headerLogoUrl',label:'Header Logo',note:'Shown in desktop website header.'},
    {key:'footerLogoUrl',label:'Footer Logo',note:'Shown in the dark footer brand block.'},
    {key:'mobileLogoUrl',label:'Mobile Logo',note:'Shown inside mobile drawer/header.'},
    {key:'faviconUrl',label:'Favicon',note:'Browser tab icon. Square PNG/WEBP recommended.'},
    {key:'emailLogoUrl',label:'Email Logo',note:'Saved for future order and auth email templates.'},
    {key:'invoiceLogoUrl',label:'Invoice / PDF Logo',note:'Saved for future GST invoice and quotation PDF.'}
  ]

  if(loading)return <div className="themeAdmin"><div className="themeLoading">Loading theme file…</div></div>
  return <div className="themeAdmin">
    <div className="themeAdminHead"><div><span className="adminEyebrow">STOREFRONT DESIGN SYSTEM</span><h1>Theme File</h1><p>Control branding, logos, colors, typography, sizing, header, layout and advanced CSS from one admin screen.</p>{updatedAt&&<small>Last saved: {new Date(updatedAt).toLocaleString()}</small>}</div><div className="themeHeadActions"><Link href="/" target="_blank"><Eye size={16}/> Preview Storefront</Link><button className="themeSave" onClick={save} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save & Publish'}</button></div></div>
    {message&&<div className="themeMessage"><Check size={16}/>{message}</div>}

    <section className="themePresetSection"><div className="themeSectionTitle"><WandSparkles size={18}/><div><h2>Quick Presets</h2><p>Start from a complete visual direction, then fine-tune every token below.</p></div></div><div className="themePresets">{presets.map(p=><button key={p.name} onClick={()=>applyPreset(p)}><b>{p.name}</b><span>{p.note}</span></button>)}</div></section>

    <div className="themeLayout">
      <div className="themeControls">
        <section className="themePanel"><div className="themeSectionTitle"><ImageIcon size={18}/><div><h2>Logo Manager</h2><p>Upload or paste URL for header, footer, mobile, favicon, email and invoice logos.</p></div></div><div className="themeLogoGrid">
          {logoFields.map(f=><div className="themeLogoCard" key={f.key}><div className="themeLogoPreview"><img src={theme.branding[f.key]||theme.branding.logoUrl} alt={f.label}/></div><div className="themeLogoInfo"><b>{f.label}</b><span>{f.note}</span><input value={theme.branding[f.key]||''} onChange={e=>setBrand(f.key,e.target.value)} placeholder="/logo.webp or https://..."/><label className="themeUploadBtn"><Upload size={15}/>{uploading===f.key?'Uploading…':'Upload image'}<input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/x-icon" onChange={e=>fileChange(f.key,e)} disabled={!!uploading}/></label></div></div>)}
        </div><div className="themeInlineActions"><button onClick={usePrimaryForAll}><ImageIcon size={15}/> Use Primary Logo Everywhere</button><button onClick={()=>{setBrand('logoUrl','/new-india-solar-logo.webp');setBrand('headerLogoUrl','/new-india-solar-logo.webp');setBrand('footerLogoUrl','/new-india-solar-logo.webp');setBrand('mobileLogoUrl','/new-india-solar-logo.webp');setMessage('Official logo restored in editor. Save to publish.')}}><RotateCcw size={15}/> Restore Official Logo</button></div></section>

        <section className="themePanel"><div className="themeSectionTitle"><MonitorCog size={18}/><div><h2>Brand & Header</h2><p>Company identity and storefront header content.</p></div></div><div className="themeFormGrid">
          <label className="themeField full"><span>Company Name</span><input value={theme.branding.companyName} onChange={e=>setBrand('companyName',e.target.value)}/></label>
          <label className="themeField full"><span>Tagline / Topbar Message</span><input value={theme.branding.tagline} onChange={e=>setBrand('tagline',e.target.value)}/></label>
          <label className="themeField full"><span>Brand Promise</span><input value={theme.branding.promise} onChange={e=>setBrand('promise',e.target.value)}/></label>
          <label className="themeField full"><span>Logo Alt Text</span><input value={theme.branding.logoAlt} onChange={e=>setBrand('logoAlt',e.target.value)}/></label>
          <label className="themeSwitch"><input type="checkbox" checked={theme.header.showTopbar} onChange={e=>setTheme(t=>({...t,header:{...t.header,showTopbar:e.target.checked}}))}/><span>Show top announcement bar</span></label>
          <label className="themeSwitch"><input type="checkbox" checked={theme.header.sticky} onChange={e=>setTheme(t=>({...t,header:{...t.header,sticky:e.target.checked}}))}/><span>Sticky header</span></label>
          <label className="themeField full"><span>Topbar Items — separated by |</span><input value={theme.header.topbarItems.join(' | ')} onChange={e=>setTheme(t=>({...t,header:{...t.header,topbarItems:e.target.value.split('|').map(x=>x.trim()).filter(Boolean)}}))}/></label>
        </div></section>

        <section className="themePanel"><div className="themeSectionTitle"><Palette size={18}/><div><h2>Colors</h2><p>Core palette used across the storefront.</p></div></div><div className="themeColorGrid">
          <ColorField label="Primary Green" value={theme.colors.primary} onChange={v=>setColor('primary',v)}/><ColorField label="Secondary Green" value={theme.colors.primary2} onChange={v=>setColor('primary2',v)}/><ColorField label="Deep Navy" value={theme.colors.navy} onChange={v=>setColor('navy',v)}/><ColorField label="Navy Secondary" value={theme.colors.navy2} onChange={v=>setColor('navy2',v)}/><ColorField label="Solar Gold" value={theme.colors.gold} onChange={v=>setColor('gold',v)}/><ColorField label="Orange Accent" value={theme.colors.orange} onChange={v=>setColor('orange',v)}/><ColorField label="Page Background" value={theme.colors.background} onChange={v=>setColor('background',v)}/><ColorField label="Soft Surface" value={theme.colors.surface} onChange={v=>setColor('surface',v)}/><ColorField label="Main Text" value={theme.colors.text} onChange={v=>setColor('text',v)}/><ColorField label="Muted Text" value={theme.colors.muted} onChange={v=>setColor('muted',v)}/><ColorField label="Borders" value={theme.colors.border} onChange={v=>setColor('border',v)}/><ColorField label="Header Background" value={theme.colors.headerBg} onChange={v=>setColor('headerBg',v)}/><ColorField label="Topbar Background" value={theme.colors.topbarBg} onChange={v=>setColor('topbarBg',v)}/><ColorField label="Topbar Text" value={theme.colors.topbarText} onChange={v=>setColor('topbarText',v)}/><ColorField label="Hero Start" value={theme.colors.heroStart} onChange={v=>setColor('heroStart',v)}/><ColorField label="Hero End" value={theme.colors.heroEnd} onChange={v=>setColor('heroEnd',v)}/><ColorField label="Footer Background" value={theme.colors.footerBg} onChange={v=>setColor('footerBg',v)}/><ColorField label="Footer Text" value={theme.colors.footerText} onChange={v=>setColor('footerText',v)}/><ColorField label="Success" value={theme.colors.success} onChange={v=>setColor('success',v)}/><ColorField label="Danger" value={theme.colors.danger} onChange={v=>setColor('danger',v)}/>
        </div></section>

        <section className="themePanel"><div className="themeSectionTitle"><Type size={18}/><div><h2>Typography</h2><p>Fonts, scale, weight and tracking.</p></div></div><div className="themeFormGrid">
          <label className="themeField full"><span>Body Font Stack</span><input value={theme.typography.bodyFont} onChange={e=>setType('bodyFont',e.target.value)}/></label><label className="themeField full"><span>Heading Font Stack</span><input value={theme.typography.headingFont} onChange={e=>setType('headingFont',e.target.value)}/></label><NumberField label="Base Font Size" value={theme.typography.baseSize} onChange={v=>setType('baseSize',v)} min={12} max={22} suffix="px"/><NumberField label="Body Weight" value={theme.typography.bodyWeight} onChange={v=>setType('bodyWeight',v)} min={300} max={800} step={100}/><NumberField label="Heading Weight" value={theme.typography.headingWeight} onChange={v=>setType('headingWeight',v)} min={400} max={900} step={100}/><NumberField label="Letter Spacing" value={theme.typography.letterSpacing} onChange={v=>setType('letterSpacing',v)} min={-2} max={4} step={.1} suffix="px"/>
        </div></section>

        <section className="themePanel"><div className="themeSectionTitle"><MonitorCog size={18}/><div><h2>Layout & Logo Size</h2><p>Global widths, spacing, radii and logo proportions.</p></div></div><div className="themeFormGrid"><NumberField label="Container Width" value={theme.layout.containerWidth} onChange={v=>setLayout('containerWidth',v)} min={960} max={1800} suffix="px"/><NumberField label="Section Spacing" value={theme.layout.sectionSpacing} onChange={v=>setLayout('sectionSpacing',v)} min={20} max={140} suffix="px"/><NumberField label="Card Radius" value={theme.layout.cardRadius} onChange={v=>setLayout('cardRadius',v)} min={0} max={40} suffix="px"/><NumberField label="Button Radius" value={theme.layout.buttonRadius} onChange={v=>setLayout('buttonRadius',v)} min={0} max={40} suffix="px"/><NumberField label="Input Radius" value={theme.layout.inputRadius} onChange={v=>setLayout('inputRadius',v)} min={0} max={40} suffix="px"/><NumberField label="Header Height" value={theme.layout.headerHeight} onChange={v=>setLayout('headerHeight',v)} min={56} max={120} suffix="px"/><NumberField label="Header Logo Width" value={theme.layout.logoWidth} onChange={v=>setLayout('logoWidth',v)} min={100} max={520} suffix="px"/><NumberField label="Footer Logo Width" value={theme.layout.footerLogoWidth} onChange={v=>setLayout('footerLogoWidth',v)} min={120} max={620} suffix="px"/><NumberField label="Mobile Logo Width" value={theme.layout.mobileLogoWidth} onChange={v=>setLayout('mobileLogoWidth',v)} min={90} max={320} suffix="px"/><NumberField label="Shadow Opacity" value={theme.layout.shadowOpacity} onChange={v=>setLayout('shadowOpacity',v)} min={0} max={.5} step={.01}/></div></section>

        <section className="themePanel"><div className="themeSectionTitle"><Code2 size={18}/><div><h2>Custom CSS</h2><p>Advanced override layer. This lets you change storefront styling without source files.</p></div></div><textarea className="themeCode" spellCheck={false} value={theme.customCss} onChange={e=>setTheme(t=>({...t,customCss:e.target.value}))} placeholder={'.nisHero h1 { font-size: 64px; }\n.productCard { border-width: 2px; }'}/><div className="themeWarning">Custom CSS runs only on storefront routes, not inside /admin.</div></section>

        <section className="themePanel"><div className="themeSectionTitle"><Code2 size={18}/><div><h2>Raw Theme JSON</h2><p>The complete theme file. Power users can edit every saved property directly.</p></div></div><textarea className="themeCode themeJson" spellCheck={false} value={jsonText} onChange={e=>setJsonText(e.target.value)}/><div className="themeInlineActions"><button onClick={applyJson}><Code2 size={15}/> Apply JSON to Editor</button><button onClick={restoreDefaults}><RotateCcw size={15}/> Restore Official Defaults</button></div></section>
      </div>

      <aside className="themePreview" style={previewVars}><div className="themePreviewLabel">LIVE STYLE PREVIEW</div><div className="themePreviewTop">{theme.branding.tagline}</div><div className="themePreviewNav"><img src={theme.branding.headerLogoUrl||theme.branding.logoUrl} alt="Header preview logo"/><div><span>Products</span><span>Customize</span><span>Bulk Order</span></div></div><div className="themePreviewHero"><small>SOLAR BOS • PROTECTION</small><h2>Reliable solar components.</h2><p>ACDB, DCDB and BOS components built for India’s solar installations.</p><button>Shop Products</button></div><div className="themePreviewCards"><div>ACDB</div><div>DCDB</div><div>SPD</div></div><div className="themePreviewFooter"><img src={theme.branding.footerLogoUrl||theme.branding.logoUrl} alt="Footer preview logo"/><span>{theme.branding.promise}</span></div></aside>
    </div>
  </div>
}

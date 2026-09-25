import starter from './builder-starter.json'
import {buildLayers, imageSource, spriteFor} from './configurator-visuals'
export type BuilderCode='ACDB'|'DCDB'
export type Selection=Record<string,{id:string;qty:number}[]>
export type Catalog={template:any;groups:any[];components:Record<string,any>;enclosures:Record<string,any>;slots:any[];rules?:any[]}
export const AC_REFERENCES=[['01','oreit','grey-c32'],['02','schutz','siemens-c32'],['03','empower','grey-c32'],['04','schutz','empower-c32a'],['05','finder','siemens-c32'],['06','sighter','siemens-c32'],['07','winsurge','grey-c32'],['08','fonix','grey-c32'],['09','sighter','grey-c32'],['10','fonix','empower-c32a'],['11','oreit','siemens-c32'],['12','empower','siemens-c32'],['13','sighter','empower-c32a'],['15','schutz','grey-c32'],['16','winsurge','grey-c32'],['17','empower','empower-c32a'],['18','finder','grey-c32'],['19','finder','empower-c32a'],['20','fonix','siemens-c32'],['21','itally','siemens-c32']]
// Only the sixteen complete, CRC-verified members of the uploaded DCDB ZIP.
export const DC_REFERENCES=[['01','finder','empower-c32a'],['02','empower','empower-c32a'],['03','empower','siemens-32a'],['04','finder','siemens-32a'],['05','sighter','siemens-32a'],['06','orbit','empower-c32a'],['07','fonix','siemens-32a'],['08','empower','lauritz-knudsen-c32'],['09','orbit','siemens-32a'],['10','sighter','lauritz-knudsen-c32'],['11','schutz','empower-c32a'],['12','orbit','lauritz-knudsen-c32'],['13','schutz','siemens-32a'],['14','fonix','lauritz-knudsen-c32'],['15','itally','siemens-32a'],['16','fonix','empower-c32a']]
export function references(code:BuilderCode){return (code==='ACDB'?AC_REFERENCES:DC_REFERENCES).map(([id,spd,mcb])=>({id,spd:`${code==='ACDB'?'ac':'dc'}-spd-${spd}`,mcb:`${code==='ACDB'?'ac':'dc'}-mcb-${mcb}`}))}
export function uploadedCatalog(code:BuilderCode):Catalog {
 const data:Catalog=JSON.parse(JSON.stringify(starter[code]))
 for(const slot of data.slots){
  if(slot.slot_key==='nis_v1_mcb'){slot.x_pct=477/1086*100;slot.width_pct=225/1086*100;slot.settings.fit='contain-top'}
  if(['nis_v1_spd','nis_v1_terminal'].includes(slot.slot_key))slot.settings.fit='contain-top'
 }
 return data
}
export function indexValues(data:Catalog):Record<string,any>{return Object.fromEntries(data.groups.flatMap(g=>g.configurator_option_values.map((v:any)=>[v.id,{...v,group:g}])))}
export function defaults(data:Catalog):Selection {return Object.fromEntries(data.groups.map(g=>[g.option_key,g.configurator_option_values.filter((v:any)=>v.metadata?.default===true).slice(0,g.option_type==='multi'?200:1).map((v:any)=>({id:v.id,qty:Math.min(Number(g.max_quantity)||1,Math.max(Number(g.min_quantity)||1,Number(v.metadata?.default_quantity)||1))}))]))}
export function presetSelection(data:Catalog,code:BuilderCode,id:string):Selection|null{
 const preset=references(code).find(p=>p.id===id);if(!preset)return null
 const out=defaults(data)
 for(const asset of [preset.spd,preset.mcb]){
  let found=false
  for(const g of data.groups){const v=g.configurator_option_values.find((v:any)=>data.components[v.component_id]?.visual_settings?.asset_id===asset);if(v){out[g.option_key]=[{id:v.id,qty:1}];found=true;break}}
  if(!found)return null
 }
 return out
}
export function selectionIssues(data:Catalog,selection:Selection,code:BuilderCode):string[]{
 const issues:string[]=[],seen=new Set<string>(),values=indexValues(data)
 if(!selection||typeof selection!=='object'||Array.isArray(selection))return ['Invalid saved selection.']
 for(const key of Object.keys(selection))if(!data.groups.some(g=>g.option_key===key))issues.push('An unknown component group was selected.')
 for(const g of data.groups){
  const list=selection[g.option_key]||[]
  if(!Array.isArray(list)){issues.push(`Invalid ${g.label} selection.`);continue}
  if(g.required&&!list.length)issues.push(`Choose ${g.label}.`)
  if(g.option_type!=='multi'&&list.length>1)issues.push(`Choose only one ${g.label}.`)
  for(const s of list){
   const v=values[s?.id]
   if(!v||v.group.option_key!==g.option_key||seen.has(s.id)){issues.push('An option is missing, duplicated or in the wrong group.');continue}seen.add(s.id)
   const item=data.components[v.component_id]||data.enclosures[v.enclosure_id]
   if((v.component_id||v.enclosure_id)&&(!item||!imageSource(item)))issues.push(`Image or component missing: ${v.label}.`)
   const asset=spriteFor(item?.visual_settings) as any
   if(asset?.domain&&asset.domain!=='shared'&&asset.domain!==(code==='ACDB'?'AC':'DC'))issues.push(`Wrong AC/DC visual category: ${v.label}.`)
   if(!Number.isInteger(s.qty)||s.qty<(Number(g.min_quantity)||1)||s.qty>(Number(g.max_quantity)||1)||(!g.allow_quantity&&s.qty!==1))issues.push(`Invalid quantity: ${v.label}.`)
  }
 }
 if(issues.length)return [...new Set(issues)]
 const enclosureIds=(selection.enclosure||[]).map(s=>values[s.id]?.enclosure_id).filter(Boolean)
 if(enclosureIds.length!==1||!data.enclosures[enclosureIds[0]])issues.push('Select one available enclosure.')
 if(issues.length)return [...new Set(issues)]
 const selectedEnclosure=data.enclosures[enclosureIds[0]]
 if(selectedEnclosure.supported_types?.length&&!selectedEnclosure.supported_types.includes(code.toLowerCase()))issues.push('This enclosure does not support this builder type.')
 const slots=data.slots.filter(s=>s.enclosure_id===enclosureIds[0]&&s.is_active!==false),layers=buildLayers(data.groups,selection,values,data.components,slots)
 for(const list of Object.values(selection))for(const s of list){const v=values[s.id];if(v?.component_id&&layers.filter(l=>l.key.startsWith(`${s.id}-`)).length!==s.qty)issues.push(`The preview has insufficient mapped positions for ${v.label}.`)}
 for(const slot of slots){const [x,y,w,h]=[slot.x_pct,slot.y_pct,slot.width_pct,slot.height_pct].map(Number);if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>100||y+h>100)issues.push('A preview slot is outside the enclosure. Ask our team to review the layout.')}
 for(const rule of data.rules||[]){
  if(rule.enclosure_id&&rule.enclosure_id!==enclosureIds[0])continue
  let qty=0
  for(const [key,list] of Object.entries(selection)){if(rule.option_key&&rule.option_key!==key)continue;if(rule.slot_key&&!slots.some(s=>s.slot_key===rule.slot_key&&s.option_key===key))continue;for(const pick of list)if(values[pick.id]?.component_id===rule.component_id)qty+=pick.qty}
  if(qty>0&&(!rule.allowed||qty<Number(rule.min_qty)||qty>Number(rule.max_qty)))issues.push('A selected component violates the admin compatibility or quantity rules.')
 }
 return [...new Set(issues)]
}
export function previewLayers(data:Catalog,selection:Selection){
 const values=indexValues(data),enclosure=values[selection.enclosure?.[0]?.id]?.enclosure_id
 return buildLayers(data.groups,selection,values,data.components,data.slots.filter(s=>s.enclosure_id===enclosure&&s.is_active!==false))
}
export function summary(data:Catalog,selection:Selection,code:BuilderCode,reference=''){
 const values=indexValues(data)
 return [`NEW INDIA SOLAR — ${code} visual quotation request`,reference?`Reference layout: ${code}-${reference}`:'Custom visual selection','',...data.groups.flatMap(g=>(selection[g.option_key]||[]).map(s=>{const v=values[s.id],item=data.components[v?.component_id]||data.enclosures[v?.enclosure_id];return `${g.label}: ${v?.label||'Unavailable'} | Quantity: ${s.qty} visual assembly | Asset: ${item?.visual_settings?.asset_id||item?.sku||s.id}`})),'','Price, availability, markings, physical fit and electrical design require confirmation.','Illustrative wire layers are not cable-length quantities or an installation drawing.'].join('\n')
}
export function readDraft(raw:string|null,data:Catalog,code:BuilderCode):{selection:Selection;reference:string}|null{
 try{if(!raw||raw.length>50000)return null;const d=JSON.parse(raw);if(d.version!==2||d.code!==code||!Number.isFinite(d.savedAt)||d.savedAt>Date.now()+60000||Date.now()-d.savedAt>30*86400000||selectionIssues(data,d.selection,code).length)return null;return {selection:d.selection,reference:references(code).some(p=>p.id===d.reference)?d.reference:''}}catch{return null}
}
export function fileDownload(content:string,filename:string,type='text/plain'){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)
}

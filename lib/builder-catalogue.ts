import type {Catalog, Selection} from './builder-buyer'
import {defaults} from './builder-buyer'

/** Shared by the buyer and admin publication check; never falls back to fixtures. */
export async function loadBuilderCatalogue(client:any, slug:string, signal:AbortSignal, includeDraft=false):Promise<Catalog> {
 let query=client.from('configurator_templates').select('id,name,slug,type,preview_settings,is_active').eq('slug',slug)
 if(!includeDraft)query=query.eq('is_active',true)
 const {data:template,error}=await query.abortSignal(signal).maybeSingle()
 if(error)throw error
 if(!template)throw new Error('This builder is not published yet. Please request a quotation while our team prepares the catalogue.')
 const [options,slots,rules]=await Promise.all([
  client.from('configurator_options').select('id,option_key,label,option_type,sort_order,required,allow_quantity,min_quantity,max_quantity,settings,configurator_option_values(id,label,value,component_id,enclosure_id,metadata,sort_order,is_active)').eq('template_id',template.id).order('sort_order').abortSignal(signal),
  client.from('configurator_visual_slots').select('*').eq('template_id',template.id).eq('is_active',true).order('slot_index').abortSignal(signal),
  client.from('configurator_component_compatibility').select('*').eq('template_id',template.id).abortSignal(signal)
 ])
 if(options.error||slots.error||rules.error)throw new Error('Could not load the complete builder catalogue. Please retry.')
 const groups=(options.data||[]).filter((g:any)=>g.settings?.buyer_visible!==false).map((g:any)=>({...g,configurator_option_values:(g.configurator_option_values||[]).filter((v:any)=>v.is_active===true).sort((a:any,b:any)=>a.sort_order-b.sort_order)}))
 const componentIds=[...new Set(groups.flatMap((g:any)=>g.configurator_option_values.map((v:any)=>v.component_id).filter(Boolean)))]
 const enclosureIds=[...new Set(groups.flatMap((g:any)=>g.configurator_option_values.map((v:any)=>v.enclosure_id).filter(Boolean)))]
 const [components,enclosures]=await Promise.all([
  componentIds.length?client.from('components').select('id,name,sku,category,unit,image_url,visual_role,visual_settings,specifications').in('id',componentIds).eq('is_active',true).abortSignal(signal):{data:[]},
  enclosureIds.length?client.from('enclosures').select('id,name,sku,dimensions_mm,image_url,inside_image_url,visual_settings,supported_types').in('id',enclosureIds).eq('is_active',true).abortSignal(signal):{data:[]}
 ])
 if(components.error||enclosures.error)throw new Error('Could not load builder components. Please retry.')
 const cs=Object.fromEntries((components.data||[]).map((c:any)=>[c.id,c])),es=Object.fromEntries((enclosures.data||[]).filter((e:any)=>!e.supported_types?.length||e.supported_types.includes(template.type)).map((e:any)=>[e.id,e]))
 for(const group of groups)group.configurator_option_values=group.configurator_option_values.filter((v:any)=>(!v.component_id||cs[v.component_id])&&(!v.enclosure_id||es[v.enclosure_id]))
 return {template,groups,components:cs,enclosures:es,slots:slots.data||[],rules:rules.data||[]}
}

/** Keep surviving choices on refresh, remove withdrawn options, apply defaults only to new groups. */
export function reconcileSelection(data:Catalog, previous:Selection):Selection {
 const initial=defaults(data)
 return Object.fromEntries(data.groups.map(g=>[g.option_key,previous[g.option_key]===undefined?initial[g.option_key]:previous[g.option_key].filter(p=>g.configurator_option_values.some((v:any)=>v.id===p.id)).slice(0,g.option_type==='multi'?200:1)]))
}

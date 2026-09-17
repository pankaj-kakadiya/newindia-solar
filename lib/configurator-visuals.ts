import pack from './builder-assets.json'

export type Sprite = {id:string;src:string;label:string;sourceRectPx:number[];imageSizePx:{width:number;height:number}}
export type VisualSlot = {x_pct:number;y_pct:number;width_pct:number;height_pct:number;z_index:number;rotation_deg?:number;settings?:Record<string,any>;option_key?:string;slot_index?:number}
export type PreviewLayer = {key:string;component:any;slot:VisualSlot}
export const builderAssets = pack.assets as Sprite[]
export function spriteFor(settings?:Record<string,any>):Sprite|undefined {return builderAssets.find(a=>a.id===settings?.asset_id)}
export function imageSource(item:any):string {return spriteFor(item?.visual_settings)?.src || item?.inside_image_url || item?.image_url || ''}
export function safeImageSource(src:string):boolean {
 if(typeof src!=='string'||/[\\\s\u0000-\u001f]/.test(src))return false
 if(src.startsWith('/')&&!src.startsWith('//'))return true
 try{const u=new URL(src);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}
}
export function sourceRectangle(sprite:Sprite|undefined,width:number,height:number):number[]{
 if(!sprite)return [0,0,width,height]
 const [x,y,w,h]=sprite.sourceRectPx
 return [x,y,w,h].every(Number.isFinite)&&x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height?[x,y,w,h]:[0,0,width,height]
}
export function fitRectangle(source:number[],target:number[],fit='contain'):number[]{
 const [,,sw,sh]=source;const [x,y,w,h]=target
 if(fit==='fill')return target
 const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale
 return [x+(w-dw)/2,fit==='contain-top'?y:y+(h-dh)/2,dw,dh]
}
export function buildLayers(groups:any[],selections:Record<string,{id:string;qty:number}[]>,values:Record<string,any>,components:Record<string,any>,slots:any[]):PreviewLayer[]{
 const out:PreviewLayer[]=[];const used=new Set<string>()
 for(const group of groups)for(const chosen of selections[group.option_key]||[]){
  const value=values[chosen.id],component=components[value?.component_id]
  if(!component||!imageSource(component))continue
  const assetId=component.visual_settings?.asset_id
  const candidates=slots.filter(s=>s.option_key===group.option_key&&(s.settings?.match_asset!==true||s.settings.asset_id===assetId)).sort((a,b)=>a.slot_index-b.slot_index)
  let placed=0
  for(const slot of candidates){const key=slot.id||`${slot.option_key}:${slot.slot_index}`;if(used.has(key)||placed>=chosen.qty)continue;used.add(key);out.push({key:`${chosen.id}-${placed++}`,component,slot})}
 }
 return out.sort((a,b)=>a.slot.z_index-b.slot.z_index)
}
export function requiresQuote(template:any,items:any[]):boolean{return template?.preview_settings?.commerce_mode==='quote'||items.some(item=>!item||item.visual_settings?.pricing_status==='quote_required'||!(Number(item.selling_price)>0))}
export function quoteDraft(code:string,summary:string,selections:unknown){return {version:1,product:code,summary:summary.slice(0,12000),selections,createdAt:Date.now()}}

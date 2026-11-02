'use client'

import {useEffect,useId,useMemo,useRef,useState} from 'react'
import {CAMPAIGN_GEO,VENUE_TYPES,bilingual,canonicalTaluka,findVillage,searchVillages,squashPlace,talukasFor,venueTypeLabel,type VillageRow} from '../../../lib/gujarat-places'

export type Place={district:string;taluka:string;village:string}

/**
 * Village search box: type part of the name in English or Gujarati and pick from the list.
 * Works the same in every browser (no <datalist>), with arrow keys, Enter and Escape.
 */
function VillageSearch({value,options,showTaluka,disabled,required,onType,onPick}:{value:string;options:VillageRow[];showTaluka:boolean;disabled?:boolean;required?:boolean;onType:(t:string)=>void;onPick:(v:VillageRow)=>void}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(0)
 const id=useId(),box=useRef<HTMLDivElement>(null)
 const results=useMemo(()=>searchVillages(options,value,60),[options,value])
 useEffect(()=>{setActive(0)},[value])
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[open])
 const pick=(v:VillageRow)=>{onPick(v);setOpen(false)}
 return <div className="placeSearch" ref={box}>
  <input disabled={disabled} required={required} role="combobox" aria-expanded={open&&results.length>0} aria-controls={`${id}-list`} aria-autocomplete="list" autoComplete="off" spellCheck={false}
   placeholder={options.length?`Search ${options.length.toLocaleString('en-IN')} villages (English / ગુજરાતી)`:'Type the village name'} value={value}
   onFocus={()=>setOpen(true)} onChange={e=>{onType(e.target.value);setOpen(true)}}
   onKeyDown={e=>{if(!results.length)return;if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(a=>Math.min(a+1,results.length-1))}else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0))}else if(e.key==='Enter'&&open){e.preventDefault();pick(results[active])}else if(e.key==='Escape')setOpen(false)}}/>
  {open&&results.length>0&&<ul id={`${id}-list`} role="listbox" className="placeSearchList">
   {results.map((v,i)=><li key={v.id||`${v.taluka}-${v.name_en}`} role="option" aria-selected={i===active} className={i===active?'active':''} onMouseEnter={()=>setActive(i)} onMouseDown={e=>{e.preventDefault();pick(v)}}>
    <b>{v.name_en}</b>{v.name_gu&&<span lang="gu">{v.name_gu}</span>}{showTaluka&&<small>{v.taluka}</small>}
   </li>)}
  </ul>}
  {open&&value.trim()&&!results.length&&options.length>0&&<div className="placeSearchList empty">No village matches “{value.trim()}”. It will be added as a new village when you save.</div>}
 </div>
}

/** District → taluka → village pickers. Villages are searched in English or Gujarati from the village directory. */
export function PlaceFields({value,villages,onChange,required=false,disabled=false}:{value:Place;villages:VillageRow[];onChange:(p:Place)=>void;required?:boolean;disabled?:boolean}){
 const talukas=talukasFor(value.district)
 const taluka=canonicalTaluka(value.district,value.taluka)||value.taluka
 const options=useMemo(()=>villages.filter(v=>v.district===value.district&&(!taluka||v.taluka===taluka)),[villages,value.district,taluka])
 const match=value.village?findVillage(villages,value.district,taluka||null,value.village):null
 return <>
  <label><span>District{required?' *':''}</span><select disabled={disabled} value={value.district} onChange={e=>onChange({district:e.target.value,taluka:'',village:''})}>{Object.entries(CAMPAIGN_GEO).map(([en,d])=><option key={en} value={en}>{bilingual(en,d.gu)}</option>)}</select></label>
  <label><span>Taluka</span>{talukas.length?<select disabled={disabled} value={taluka} onChange={e=>onChange({...value,taluka:e.target.value,village:''})}><option value="">All talukas</option>{talukas.map(([en,gu])=><option key={en} value={en}>{bilingual(en,gu)}</option>)}{value.taluka&&!canonicalTaluka(value.district,value.taluka)&&<option value={value.taluka}>{value.taluka}</option>}</select>:<input disabled={disabled} value={value.taluka} onChange={e=>onChange({...value,taluka:e.target.value})}/>}</label>
  <div className="campVillageField placeField"><span>Village{required?' *':''}</span>
   <VillageSearch value={value.village} options={options} showTaluka={!taluka} disabled={disabled} required={required}
    onType={t=>onChange({...value,taluka,village:t})}
    onPick={v=>onChange({...value,taluka:v.taluka,village:v.name_en})}/>
   {value.village&&<small className={match?'campHint ok':'campHint'}>{match?`${bilingual(match.name_en,match.name_gu)} · ${match.taluka}`:'New village: it will be added to the directory when you save.'}</small>}
  </div>
 </>
}

export type VenueChoice={venue_id:string;venue:string;new_type:string;new_name:string}

/** Venues saved for the chosen village (and, below them, others in the same taluka), or a new one saved once for later camps. */
export function VenueFields({place,venues,value,onChange,disabled=false}:{place:Place;venues:any[];value:VenueChoice;onChange:(v:VenueChoice)=>void;disabled?:boolean}){
 const v0=squashPlace(place.village)
 const here=venues.filter(v=>v.district===place.district&&v0&&squashPlace(v.village)===v0)
 const nearby=venues.filter(v=>v.district===place.district&&!here.includes(v)&&(!place.taluka||!v.taluka||v.taluka===place.taluka))
 const chosen=venues.find(v=>v.id===value.venue_id)
 const select=value.venue_id||(value.new_name!==''||value.new_type!==''?'__new':'')
 const label=(v:any)=>`${v.name} · ${VENUE_TYPES.find(t=>t.key===v.venue_type)?.label||v.venue_type}`
 return <>
  <label><span>Venue</span><select disabled={disabled||!place.village} value={select} onChange={e=>{const id=e.target.value;if(id==='__new')onChange({venue_id:'',venue:'',new_type:'panchayat_office',new_name:''});else{const v=venues.find(x=>x.id===id);onChange({venue_id:id,venue:v?.name||'',new_type:'',new_name:''})}}}>
   <option value="">{place.village?(here.length?`Choose a saved venue (${here.length})`:'No saved venue in this village yet'):'Pick the village first'}</option>
   {here.length>0&&<optgroup label={`In ${place.village}`}>{here.map(v=><option key={v.id} value={v.id}>{label(v)}</option>)}</optgroup>}
   {nearby.length>0&&<optgroup label={place.taluka?`Elsewhere in ${place.taluka}`:`Elsewhere in ${place.district}`}>{nearby.map(v=><option key={v.id} value={v.id}>{label(v)} · {v.village}</option>)}</optgroup>}
   {chosen&&!here.includes(chosen)&&!nearby.includes(chosen)&&<option value={chosen.id}>{chosen.name}</option>}
   <option value="__new">+ Add a new venue</option>
  </select>{!value.venue_id&&!select&&value.venue&&<small className="campHint">Earlier venue text: {value.venue}</small>}{chosen&&<small className="campHint ok">{venueTypeLabel(chosen.venue_type)} · {chosen.village}{chosen.contact_name?` · ${chosen.contact_name}`:''}{chosen.contact_phone?` ${chosen.contact_phone}`:''}</small>}</label>
  {select==='__new'&&<><label><span>New venue type</span><select disabled={disabled} value={value.new_type} onChange={e=>onChange({...value,new_type:e.target.value})}>{VENUE_TYPES.map(t=><option key={t.key} value={t.key}>{t.label} ({t.gu})</option>)}</select></label><label><span>New venue name</span><input disabled={disabled} value={value.new_name} onChange={e=>onChange({...value,new_name:e.target.value})} placeholder="e.g. Prathmik Shala, Khambha"/></label></>}
 </>
}

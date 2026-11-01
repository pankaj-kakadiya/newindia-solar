'use client'

import {useId,useMemo} from 'react'
import {CAMPAIGN_GEO,VENUE_TYPES,bilingual,canonicalTaluka,findVillage,talukasFor,venueTypeLabel,type VillageRow} from '../../../lib/gujarat-places'

export type Place={district:string;taluka:string;village:string}

/** District → taluka → village pickers. Villages autosuggest in English or Gujarati from the village directory. */
export function PlaceFields({value,villages,onChange,required=false,disabled=false}:{value:Place;villages:VillageRow[];onChange:(p:Place)=>void;required?:boolean;disabled?:boolean}){
 const listId=useId()
 const talukas=talukasFor(value.district)
 const options=useMemo(()=>villages.filter(v=>v.district===value.district&&(!value.taluka||v.taluka===value.taluka)).sort((a,b)=>a.taluka.localeCompare(b.taluka)||a.name_en.localeCompare(b.name_en)),[villages,value.district,value.taluka])
 const match=value.village?findVillage(villages,value.district,value.taluka||null,value.village):null
 function setVillage(text:string){
  const hit=findVillage(villages,value.district,value.taluka||null,text)
  // A Gujarati entry or a pick from another taluka resolves to the directory's English name and taluka.
  onChange(hit?{...value,village:hit.name_en,taluka:value.taluka||hit.taluka}:{...value,village:text})
 }
 return <>
  <label><span>District{required?' *':''}</span><select disabled={disabled} value={value.district} onChange={e=>onChange({district:e.target.value,taluka:'',village:''})}>{Object.entries(CAMPAIGN_GEO).map(([en,d])=><option key={en} value={en}>{bilingual(en,d.gu)}</option>)}</select></label>
  <label><span>Taluka</span>{talukas.length?<select disabled={disabled} value={canonicalTaluka(value.district,value.taluka)||value.taluka} onChange={e=>onChange({...value,taluka:e.target.value,village:''})}><option value="">Select taluka</option>{talukas.map(([en,gu])=><option key={en} value={en}>{bilingual(en,gu)}</option>)}{value.taluka&&!canonicalTaluka(value.district,value.taluka)&&<option value={value.taluka}>{value.taluka}</option>}</select>:<input disabled={disabled} value={value.taluka} onChange={e=>onChange({...value,taluka:e.target.value})}/>}</label>
  <label className="campVillageField"><span>Village{required?' *':''}</span><input disabled={disabled} list={listId} autoComplete="off" placeholder={options.length?'Type in English or ગુજરાતી':'Type the village name'} value={value.village} onChange={e=>setVillage(e.target.value)}/>
   <datalist id={listId}>{options.slice(0,800).map(v=><option key={v.id||`${v.taluka}-${v.name_en}`} value={v.name_en} label={[v.name_gu,value.taluka?'':v.taluka].filter(Boolean).join(' · ')}/>)}</datalist>
   {value.village&&<small className={match?'campHint ok':'campHint'}>{match?bilingual(match.name_en,match.name_gu)+(value.taluka?'':` · ${match.taluka}`):'New village: it will be added to the directory when you save.'}</small>}
  </label>
 </>
}

export type VenueChoice={venue_id:string;venue:string;new_type:string;new_name:string}

/** Saved venues for the chosen village, or a new one that is saved once and reused for later camps. */
export function VenueFields({place,venues,value,onChange,disabled=false}:{place:Place;venues:any[];value:VenueChoice;onChange:(v:VenueChoice)=>void;disabled?:boolean}){
 const key=(s:string)=>String(s||'').trim().toLowerCase()
 const here=venues.filter(v=>v.district===place.district&&key(v.village)===key(place.village))
 const chosen=venues.find(v=>v.id===value.venue_id)
 const select=value.venue_id||(value.new_name!==''||value.new_type!==''?'__new':'')
 return <>
  <label><span>Venue</span><select disabled={disabled||!place.village} value={select} onChange={e=>{const id=e.target.value;if(id==='__new')onChange({venue_id:'',venue:'',new_type:'panchayat_office',new_name:''});else{const v=venues.find(x=>x.id===id);onChange({venue_id:id,venue:v?.name||'',new_type:'',new_name:''})}}}>
   <option value="">{place.village?(here.length?'Choose a saved venue':'No saved venue yet'):'Pick the village first'}</option>
   {here.map(v=><option key={v.id} value={v.id}>{v.name} · {VENUE_TYPES.find(t=>t.key===v.venue_type)?.label||v.venue_type}</option>)}
   {chosen&&!here.includes(chosen)&&<option value={chosen.id}>{chosen.name}</option>}
   <option value="__new">+ Add a new venue</option>
  </select>{!value.venue_id&&!select&&value.venue&&<small className="campHint">Earlier venue text: {value.venue}</small>}{chosen&&<small className="campHint ok">{venueTypeLabel(chosen.venue_type)}{chosen.contact_name?` · ${chosen.contact_name}`:''}{chosen.contact_phone?` ${chosen.contact_phone}`:''}</small>}</label>
  {select==='__new'&&<><label><span>New venue type</span><select disabled={disabled} value={value.new_type} onChange={e=>onChange({...value,new_type:e.target.value})}>{VENUE_TYPES.map(t=><option key={t.key} value={t.key}>{t.label} ({t.gu})</option>)}</select></label><label><span>New venue name</span><input disabled={disabled} value={value.new_name} onChange={e=>onChange({...value,new_name:e.target.value})} placeholder="e.g. Prathmik Shala, Khambha"/></label></>}
 </>
}

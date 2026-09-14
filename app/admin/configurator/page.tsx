'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'
import {Boxes,Image,Layers3,Link2,PackageSearch,Settings2,SlidersHorizontal,WandSparkles} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

export default function ConfiguratorAdmin(){
  const [s,setS]=useState({templates:0,enclosures:0,components:0,slots:0,configs:0})
  useEffect(()=>{Promise.all([
    supabase.from('configurator_templates').select('id',{count:'exact',head:true}),
    supabase.from('enclosures').select('id',{count:'exact',head:true}),
    supabase.from('components').select('id',{count:'exact',head:true}),
    supabase.from('configurator_visual_slots').select('id',{count:'exact',head:true}),
    supabase.from('custom_configurations').select('id',{count:'exact',head:true})
  ]).then(([a,b,c,d,e])=>setS({templates:a.count||0,enclosures:b.count||0,components:c.count||0,slots:d.count||0,configs:e.count||0}))},[])
  return <div className="cfgAdmin"><div className="adminPageHead"><div><span className="adminEyebrow">VISUAL BUILDER CONTROL CENTER</span><h1>Configurator</h1><p>Manage enclosure templates, transparent component PNGs, buyer options, slot positions, compatibility and saved ACDB/DCDB builds.</p></div></div><div className="cfgAdminStats"><b>{s.templates}<span>Builders</span></b><b>{s.enclosures}<span>Enclosures</span></b><b>{s.components}<span>Components</span></b><b>{s.slots}<span>Visual Slots</span></b><b>{s.configs}<span>Saved Builds</span></b></div><div className="cfgAdminCards"><Link href="/admin/configurator/templates"><Boxes/><div><h2>Templates & Enclosures</h2><p>Upload final empty-box PNGs and control box specifications.</p></div></Link><Link href="/admin/configurator/components"><Image/><div><h2>Component PNG Library</h2><p>Manage MCB, MCCB, SPD, terminal, wire, fuse and other visual assets.</p></div></Link><Link href="/admin/configurator/options"><Link2/><div><h2>Builder Option Linking</h2><p>Link uploaded components and enclosures to ACDB/DCDB choices buyers can select.</p></div></Link><Link href="/admin/configurator/slot-mapping"><Layers3/><div><h2>Slot Mapping</h2><p>Define exactly where each selected component appears inside each enclosure.</p></div></Link><Link href="/admin/configurator/rules"><SlidersHorizontal/><div><h2>Compatibility Rules</h2><p>Control which component can be used with each ACDB/DCDB box.</p></div></Link><Link href="/admin/configurator/configurations"><PackageSearch/><div><h2>Customer Configurations</h2><p>Review saved builds, BOM snapshots, pricing and production data.</p></div></Link><Link href="/customize" target="_blank"><WandSparkles/><div><h2>Open Buyer Builder</h2><p>Preview the customer-facing ACDB/DCDB configurator.</p></div></Link></div><div className="cfgAdminNote"><Settings2/><div><b>Step 2 engine is database-driven.</b><span>Upload the final enclosure PNG, upload your MCB/SPD/wire/terminal PNGs, link them to buyer options, and the live preview updates without another deployment.</span></div></div></div>
}

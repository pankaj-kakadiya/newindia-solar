'use client'

import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {Check,KeyRound,Save,ShieldCheck,UserPlus,Users,X} from 'lucide-react'
import {supabase} from '../../../lib/supabase'

const ACTIONS=[['view','View'],['create','Add'],['edit','Edit'],['delete','Delete'],['export','Export']] as const
type Member={user_id:string;email:string|null;full_name:string|null;role:string;admin_role:string;staff_status:string;job_title:string|null;last_sign_in_at:string|null}

/** Who can work on the PM Surya Ghar village campaign, with what rights, and how many households each owns. */
export default function TeamTab({leads,flash,setErr}:{leads:any[];flash:(m:string)=>void;setErr:(m:string)=>void}){
 const [team,setTeam]=useState<Member[]>([]),[roles,setRoles]=useState<any[]>([]),[rolePerms,setRolePerms]=useState<any[]>([]),[overrides,setOverrides]=useState<any[]>([])
 const [loading,setLoading]=useState(true),[denied,setDenied]=useState(false),[onlyCampaign,setOnlyCampaign]=useState(true),[edit,setEdit]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false)

 async function load(){
  setLoading(true)
  const [t,r,p,o]=await Promise.all([supabase.rpc('admin_list_team'),supabase.from('admin_role_definitions').select('role_key,name,description,sort_order').order('sort_order'),supabase.from('admin_role_permissions').select('role_key,can_view,can_create,can_edit,can_delete,can_export').eq('module_key','campaigns'),supabase.from('admin_user_permissions').select('user_id,action_key,allowed,expires_at').eq('module_key','campaigns')])
  setLoading(false)
  if(t.error){setDenied(true);return}
  setTeam((t.data||[]) as Member[]);setRoles(r.data||[]);setRolePerms(p.data||[]);setOverrides((o.data||[]).filter((x:any)=>!x.expires_at||Date.parse(x.expires_at)>Date.now()))
  setEdit(Object.fromEntries(((t.data||[]) as Member[]).map(m=>[m.user_id,m.admin_role||'general'])))
 }
 useEffect(()=>{load()},[])

 const rights=(m:Member,roleKey=m.admin_role)=>Object.fromEntries(ACTIONS.map(([a])=>{
  if(m.role==='admin')return [a,true]
  const o=overrides.find(x=>x.user_id===m.user_id&&x.action_key===a)
  if(o)return [a,Boolean(o.allowed)]
  const rp=rolePerms.find(x=>x.role_key===roleKey)
  return [a,Boolean(rp?.[`can_${a}`])]
 })) as Record<string,boolean>
 const owned=useMemo(()=>{const m=new Map<string,number>();for(const l of leads)if(l.assigned_to)m.set(l.assigned_to,(m.get(l.assigned_to)||0)+1);return m},[leads])
 const people=team.filter(m=>m.role==='admin'||m.role==='staff').filter(m=>!onlyCampaign||rights(m).view||['campaign_manager','field_executive'].includes(edit[m.user_id]))
 const roleName=(k:string)=>roles.find(r=>r.role_key===k)?.name||k

 async function saveRole(m:Member){
  setBusy(true)
  const {error}=await supabase.rpc('admin_set_staff_access',{p_user_id:m.user_id,p_admin_role:edit[m.user_id],p_staff_status:m.staff_status,p_job_title:m.job_title||null})
  setBusy(false)
  if(error){setErr(error.message);return}
  flash(`${m.full_name||m.email} is now ${roleName(edit[m.user_id])}.`);load()
 }

 if(loading)return <section className="adminPanel"><p className="emptyCell">Loading the campaign team…</p></section>
 if(denied)return <section className="adminPanel campPanel"><h2><Users size={18}/>Campaign team</h2><p className="muted">Only the Owner Admin (or someone with Security access) can see and change the campaign team.</p></section>
 const manager=roles.find(r=>r.role_key==='campaign_manager'),field=roles.find(r=>r.role_key==='field_executive')
 return <>
  <section className="adminPanel campPanel teamIntro"><h2><ShieldCheck size={18}/>PM Surya Ghar campaign roles</h2>
   <div className="teamRoles">
    {[manager,field].filter(Boolean).map(r=><article key={r.role_key}><b>{r.name}</b><p>{r.description}</p><div className="teamRights">{ACTIONS.map(([a,label])=>{const ok=Boolean(rolePerms.find(x=>x.role_key===r.role_key)?.[`can_${a}`]);return <span key={a} className={ok?'on':'off'}>{ok?<Check size={12}/>:<X size={12}/>}{label}</span>})}</div></article>)}
    {!manager&&<p className="muted">Run the campaign_team_roles database update in Supabase to add the Campaign Manager and Field Executive roles.</p>}
   </div>
   <div className="teamLinks"><Link className="adminBtn" href="/admin/access"><UserPlus size={16}/>Add a team member</Link><Link className="adminBtn ghost" href="/admin/access"><KeyRound size={16}/>Fine-tune rights (Role Matrix / per person)</Link></div>
  </section>

  <section className="adminPanel campPanel"><h2><Users size={18}/>Campaign team ({people.length})</h2>
   <label className="campCheck"><input type="checkbox" checked={onlyCampaign} onChange={e=>setOnlyCampaign(e.target.checked)}/>Only people with campaign access</label>
   <div className="adminTableWrap"><table className="adminTable teamTable"><thead><tr><th>Person</th><th>Role</th><th>Campaign rights</th><th className="num">Households owned</th><th>Last sign-in</th><th></th></tr></thead><tbody>
    {people.map(m=>{const r=rights(m,edit[m.user_id]);const changed=edit[m.user_id]!==m.admin_role;return <tr key={m.user_id}>
     <td><b>{m.full_name||m.email}</b><span className="tableSub">{m.email}{m.job_title?` · ${m.job_title}`:''}{m.staff_status!=='active'?` · ${m.staff_status}`:''}</span></td>
     <td>{m.role==='admin'?<span className="vendBadge active">Owner Admin</span>:<select aria-label={`Role for ${m.full_name||m.email}`} value={edit[m.user_id]} onChange={e=>setEdit(x=>({...x,[m.user_id]:e.target.value}))}>{roles.filter(x=>x.role_key!=='admin').map(x=><option key={x.role_key} value={x.role_key}>{x.name}</option>)}</select>}</td>
     <td><div className="teamRights">{ACTIONS.map(([a,label])=><span key={a} className={r[a]?'on':'off'}>{r[a]?<Check size={12}/>:<X size={12}/>}{label}</span>)}</div>{overrides.some(x=>x.user_id===m.user_id)&&<span className="tableSub">Has individual rules (Access → All Users)</span>}</td>
     <td className="num">{owned.get(m.user_id)||'—'}</td>
     <td>{m.last_sign_in_at?new Date(m.last_sign_in_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Never'}</td>
     <td>{m.role!=='admin'&&changed&&<button className="adminBtn" disabled={busy} onClick={()=>saveRole(m)}><Save size={15}/>Save</button>}</td>
    </tr>})}
    {!people.length&&<tr><td colSpan={6} className="emptyCell">Nobody has campaign access yet. Give a team member the Campaign Manager or Field Executive role.</td></tr>}
   </tbody></table></div>
   <p className="muted campFoot">Changing a role takes effect on the person&apos;s next page load. Households are owned through the &quot;Owner&quot; field on each household.</p>
  </section>
 </>
}

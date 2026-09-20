'use client'

import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {Bot,CheckCircle2,ChevronRight,Headphones,LockKeyhole,MessageCircle,RefreshCw,Send,Sparkles,Users,X} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {QuickAnswer,supportQuickAnswers} from './support-content'

type Conversation={id:string;buyer_id:string;team_id:string;assigned_to:string|null;category:string;priority:string;status:string;subject_ciphertext:string;subject_iv:string;last_message_at:string;created_at:string}
type Message={id:string;conversation_id:string;sender_id:string;ciphertext:string;iv:string;created_at:string;deleted_at:string|null}
type Roster={team_id:string;user_id:string;display_name:string;email:string;team_role:string;is_active:boolean;crypto_ready:boolean}
const PLAIN_MARKER='account-chat-v1'
const priorityOptions=['low','normal','high','urgent']
const statusOptions=['open','pending_buyer','pending_team','resolved','closed']

function title(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase())}
function when(value:string){return new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}
function conversationTitle(conversation:Conversation){return conversation.subject_iv===PLAIN_MARKER?conversation.subject_ciphertext:'Previous secure conversation'}
function messageText(message:Message){if(message.deleted_at)return'Message removed';return message.iv===PLAIN_MARKER?message.ciphertext:'Previous encrypted message is not available in simplified chat.'}

export default function SecureSupportWorkspace({mode}:{mode:'buyer'|'admin'}){
 const [userId,setUserId]=useState('')
 const [conversations,setConversations]=useState<Conversation[]>([])
 const [selectedId,setSelectedId]=useState('')
 const [messages,setMessages]=useState<(Message&{plain:string})[]>([])
 const [draft,setDraft]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [showTeam,setShowTeam]=useState(false)
 const [roster,setRoster]=useState<Roster[]>([])
 const [memberEmail,setMemberEmail]=useState('')
 const [memberRole,setMemberRole]=useState('agent')
 const [answerHistory,setAnswerHistory]=useState<QuickAnswer[]>([])
 const selected=conversations.find(x=>x.id===selectedId)||null

 const loadConversations=useCallback(async()=>{
  const {data,error}=await supabase.from('support_conversations').select('*').order('last_message_at',{ascending:false})
  if(error){setNotice(error.message);return}
  const rows=(data||[]) as Conversation[]
  setConversations(rows)
  if(mode==='admin')setSelectedId(current=>current||rows[0]?.id||'')
 },[mode])
 const loadRoster=useCallback(async()=>{if(mode!=='admin')return;const {data,error}=await supabase.rpc('support_admin_roster');if(error)setNotice(error.message);else setRoster((data||[]) as Roster[])},[mode])
 const loadMessages=useCallback(async(conversationId:string)=>{const {data,error}=await supabase.from('support_messages').select('*').eq('conversation_id',conversationId).order('created_at');if(error){setNotice(error.message);return}setMessages(((data||[]) as Message[]).map(message=>({...message,plain:messageText(message)})));await supabase.rpc('support_mark_read',{p_conversation_id:conversationId})},[])

 useEffect(()=>{let live=true;supabase.auth.getUser().then(async({data})=>{if(!live)return;const uid=data.user?.id||'';setUserId(uid);if(uid)await Promise.all([loadConversations(),loadRoster()]);setLoading(false)});return()=>{live=false}},[loadConversations,loadRoster])
 useEffect(()=>{if(selectedId)loadMessages(selectedId);else setMessages([])},[selectedId,loadMessages])
 useEffect(()=>{if(!userId)return;const channel=supabase.channel(`account-support-${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'support_messages'},()=>{loadConversations();if(selectedId)loadMessages(selectedId)}).on('postgres_changes',{event:'*',schema:'public',table:'support_conversations'},()=>loadConversations()).subscribe();return()=>{supabase.removeChannel(channel)}},[userId,selectedId,loadConversations,loadMessages])

 async function connectAgent(){
  if(busy)return
  setBusy(true)
  const context=answerHistory.at(-1)
  try{
   const {data:team,error:teamError}=await supabase.from('support_teams').select('id').eq('is_active',true).limit(1).single()
   if(teamError)throw teamError
   const initialMessage=context?`I would like to talk with a support agent on priority. I was viewing: ${context.question}`:'I would like to talk with a support agent on priority.'
   const {data:id,error}=await supabase.rpc('support_create_simple_conversation',{p_team_id:team.id,p_category:context?.category||'general',p_priority:'high',p_subject:context?.subject||'Priority support request',p_initial_message:initialMessage})
   if(error)throw error
   await loadConversations()
   setSelectedId(id)
   setNotice('Priority support started. A team member can reply here in realtime.')
  }catch(error:any){setNotice(error.message||'Could not connect to an agent. Please try again.')}finally{setBusy(false)}
 }
 async function send(event:FormEvent){event.preventDefault();if(!selected||!draft.trim())return;setBusy(true);try{const {error}=await supabase.from('support_messages').insert({conversation_id:selected.id,sender_id:userId,ciphertext:draft.trim(),iv:PLAIN_MARKER});if(error)throw error;setDraft('');await Promise.all([loadMessages(selected.id),loadConversations()])}catch(error:any){setNotice(error.message||'Message could not be sent.')}finally{setBusy(false)}}
 async function assign(field:'status'|'priority'|'assigned_to',value:string|null){if(!selected)return;const args={p_conversation_id:selected.id,p_assigned_to:field==='assigned_to'?value:selected.assigned_to,p_status:field==='status'?value:selected.status,p_priority:field==='priority'?value:selected.priority};const {error}=await supabase.rpc('support_assign_conversation',args);if(error)setNotice(error.message);else{await loadConversations();setNotice('Conversation updated.')}}
 async function setMemberAccess(email:string,role:string,active:boolean){if(!roster[0]?.team_id){setNotice('Support team not available.');return}setBusy(true);const {error}=await supabase.rpc('support_set_team_member',{p_team_id:roster[0].team_id,p_email:email,p_team_role:role,p_is_active:active});setBusy(false);if(error)setNotice(error.message);else{setMemberEmail('');await loadRoster();setNotice(active?'Support access granted.':'Support access revoked.')}}
 const assignedName=useMemo(()=>roster.find(x=>x.user_id===selected?.assigned_to)?.display_name||'Unassigned',[roster,selected])

 if(loading)return <div className="supportState"><RefreshCw className="spin"/> Loading support…</div>
 if(!userId)return <section className="supportState"><LockKeyhole/><h1>Sign in for support</h1><p>Your support conversations are available only inside your New India Solar account.</p><Link href="/login?next=/account/support">Sign in to continue</Link></section>
 return <div className={`supportWorkspace ${mode}`}>
  <header className="supportTop"><div><span><Headphones/> {mode==='admin'?'SUPPORT OPERATIONS':'NEW INDIA SOLAR SUPPORT'}</span><h1>{mode==='admin'?'Support Desk':'How can we help?'}</h1><p>{mode==='admin'?'Assign, reply and manage buyer conversations.':'Get an instant answer or connect directly with our support team.'}</p></div><div className="supportTopActions">{mode==='admin'?<button onClick={()=>setShowTeam(true)}><Users/> Team access</button>:<button onClick={()=>setSelectedId('')}><Sparkles/> Instant help</button>}</div></header>
  {notice&&<div className="supportNotice"><CheckCircle2/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss message"><X/></button></div>}
  <div className="supportGrid">
   <aside className="supportInbox"><b>{mode==='admin'?'CONVERSATIONS':'SUPPORT'}</b>{mode==='buyer'&&<button className={!selectedId?'active supportInstantTab':''} onClick={()=>setSelectedId('')}><span><Sparkles/> Instant answers</span><small>Fast help · No form required</small><em className="supportStatus online">Online</em></button>}{conversations.length?conversations.map(conversation=><button key={conversation.id} className={selectedId===conversation.id?'active':''} onClick={()=>setSelectedId(conversation.id)}><span>{conversationTitle(conversation)}</span><small>{title(conversation.category)} · {when(conversation.last_message_at)}</small><em className={`supportStatus ${conversation.status} ${conversation.priority==='high'||conversation.priority==='urgent'?'priority':''}`}>{conversation.priority==='high'||conversation.priority==='urgent'?'Priority':title(conversation.status)}</em></button>):mode==='admin'&&<div className="supportEmpty"><MessageCircle/><p>No conversations yet.</p></div>}</aside>
   <section className="supportThread">{selected?<><div className="supportThreadHead"><div><span>{title(selected.category)} · {selected.priority} priority</span><h2>{conversationTitle(selected)}</h2>{mode==='admin'?<small>Assigned: {assignedName}</small>:<small className="supportLive"><i/> Support team conversation</small>}</div>{mode==='admin'&&<div className="supportControls"><select value={selected.assigned_to||''} onChange={event=>assign('assigned_to',event.target.value||null)}><option value="">Unassigned</option>{roster.filter(item=>item.is_active).map(item=><option key={item.user_id} value={item.user_id}>{item.display_name}</option>)}</select><select value={selected.priority} onChange={event=>assign('priority',event.target.value)}>{priorityOptions.map(item=><option key={item}>{title(item)}</option>)}</select><select value={selected.status} onChange={event=>assign('status',event.target.value)}>{statusOptions.map(item=><option key={item}>{title(item)}</option>)}</select></div>}</div><div className="supportMessages">{messages.map(message=><article key={message.id} className={message.sender_id===userId?'mine':'theirs'}><b>{message.sender_id===userId?'You':mode==='admin'?(message.sender_id===selected.buyer_id?'Buyer':'Support teammate'):'New India Solar Support'}</b><p>{message.plain}</p><time>{when(message.created_at)}</time></article>)}</div><form className="supportComposer" onSubmit={send}><textarea value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Type your message…" maxLength={12000}/><button disabled={busy||!draft.trim()}><Send/> Send message</button></form></>:mode==='buyer'?<div className="supportBot"><div className="supportBotHead"><span><Bot/></span><div><b>New India Solar Assistant</b><small><i/> Online now</small></div></div><div className="supportBotMessages"><article className="theirs"><b>SUPPORT ASSISTANT</b><p>Hi! I can help you right away. Choose a common question below, or connect with a support agent for personal help.</p></article>{answerHistory.map((item,index)=><div className="supportBotExchange" key={`${item.question}-${index}`}><article className="mine"><b>YOU</b><p>{item.question}</p></article><article className="theirs"><b>SUPPORT ASSISTANT</b><p>{item.answer}</p></article></div>)}</div><div className="supportQuick"><span>CHOOSE A QUICK QUESTION</span><div>{supportQuickAnswers.map(item=><button key={item.question} onClick={()=>setAnswerHistory(history=>[...history,item])}>{item.question}<ChevronRight/></button>)}</div></div><div className="supportAgentCta"><span><Headphones/></span><div><b>Need personal help?</b><p>Start a priority conversation with our support team. No form or setup required.</p></div><button onClick={connectAgent} disabled={busy}>{busy?<RefreshCw className="spin"/>:<MessageCircle/>}{busy?'Connecting…':'Talk to an agent'}</button></div></div>:<div className="supportEmpty large"><MessageCircle/><h2>Select a conversation</h2><p>Buyer messages will appear here.</p></div>}</section>
  </div>
  {showTeam&&<div className="supportModal"><div className="supportTeamPanel"><button className="close" onClick={()=>setShowTeam(false)} aria-label="Close"><X/></button><span>SUPPORT TEAM ACCESS</span><h2>Agents and supervisors</h2><div className="supportAddMember"><input type="email" value={memberEmail} onChange={event=>setMemberEmail(event.target.value)} placeholder="Team member email"/><select value={memberRole} onChange={event=>setMemberRole(event.target.value)}><option value="agent">Agent</option><option value="supervisor">Supervisor</option></select><button disabled={busy||!memberEmail} onClick={()=>setMemberAccess(memberEmail,memberRole,true)}>Grant access</button></div><div className="supportRoster">{roster.map(item=><div key={item.user_id}><span><b>{item.display_name}</b><small>{item.email} · {title(item.team_role)}</small></span><div className="supportMemberActions"><em className={item.is_active?'active':'inactive'}>{item.is_active?'Active':'Revoked'}</em><button onClick={()=>setMemberAccess(item.email,item.team_role,!item.is_active)}>{item.is_active?'Revoke':'Restore'}</button></div></div>)}</div></div></div>}
 </div>
}

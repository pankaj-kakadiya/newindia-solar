'use client'

import {FormEvent,useCallback,useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Bot,ChevronLeft,ChevronRight,Headphones,MessageCircle,RefreshCw,Send,X} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {QuickAnswer,supportQuickAnswers} from './support-content'

type SupportMessage={id:string;sender_id:string;ciphertext:string;iv:string;created_at:string;deleted_at:string|null}
const PLAIN_MARKER='account-chat-v1'

function messageText(message:SupportMessage){if(message.deleted_at)return'Message removed';return message.iv===PLAIN_MARKER?message.ciphertext:'Previous secure message is available in your support history.'}
function messageTime(value:string){return new Date(value).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}

export default function SupportLauncher(){
 const path=usePathname()
 if(path.startsWith('/admin')||path==='/account/support'||path.startsWith('/login'))return null
 return <SupportPopup path={path}/>
}

function SupportPopup({path}:{path:string}){
 const [open,setOpen]=useState(false)
 const [signedIn,setSignedIn]=useState(false)
 const [userId,setUserId]=useState('')
 const [view,setView]=useState<'bot'|'agent'>('bot')
 const [answers,setAnswers]=useState<QuickAnswer[]>([])
 const [conversationId,setConversationId]=useState('')
 const [messages,setMessages]=useState<SupportMessage[]>([])
 const [draft,setDraft]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const messagesRef=useRef<HTMLDivElement>(null)

 const loadMessages=useCallback(async(id:string)=>{
  const {data,error}=await supabase.from('support_messages').select('id,sender_id,ciphertext,iv,created_at,deleted_at').eq('conversation_id',id).order('created_at')
  if(error){setNotice(error.message);return}
  setMessages((data||[]) as SupportMessage[])
  await supabase.rpc('support_mark_read',{p_conversation_id:id})
 },[])

 useEffect(()=>{if(!open)return;supabase.auth.getUser().then(({data})=>{setSignedIn(Boolean(data.user));setUserId(data.user?.id||'')});const {data}=supabase.auth.onAuthStateChange((_event,session)=>{setSignedIn(Boolean(session?.user));setUserId(session?.user?.id||'')});return()=>data.subscription.unsubscribe()},[open])
 useEffect(()=>{if(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('support')==='1')setOpen(true)},[])
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[open])
 useEffect(()=>{if(!open||!conversationId||!userId)return;const channel=supabase.channel(`support-popup-${conversationId}`).on('postgres_changes',{event:'*',schema:'public',table:'support_messages',filter:`conversation_id=eq.${conversationId}`},()=>loadMessages(conversationId)).subscribe();return()=>{supabase.removeChannel(channel)}},[open,conversationId,userId,loadMessages])
 useEffect(()=>{if(messagesRef.current)messagesRef.current.scrollTop=messagesRef.current.scrollHeight},[messages,answers,view])

 async function connectAgent(){
  if(!signedIn||busy)return
  setBusy(true);setNotice('')
  const context=answers.at(-1)
  try{
   const {data:existing,error:existingError}=await supabase.from('support_conversations').select('id').eq('priority','high').in('status',['open','pending_buyer','pending_team']).order('last_message_at',{ascending:false}).limit(1).maybeSingle()
   if(existingError)throw existingError
   let id=existing?.id||''
   if(!id){
    const {data:team,error:teamError}=await supabase.from('support_teams').select('id').eq('is_active',true).limit(1).single()
    if(teamError)throw teamError
    const initialMessage=context?`I would like to talk with a support agent on priority. I was viewing: ${context.question}`:'I would like to talk with a support agent on priority.'
    const {data:newId,error}=await supabase.rpc('support_create_simple_conversation',{p_team_id:team.id,p_category:context?.category||'general',p_priority:'high',p_subject:context?.subject||'Priority support request',p_initial_message:initialMessage})
    if(error)throw error
    id=newId
   }
   setConversationId(id);setView('agent');await loadMessages(id)
  }catch(error:any){setNotice(error.message||'Could not connect to the support team.')}finally{setBusy(false)}
 }
 async function send(event:FormEvent){
  event.preventDefault();if(!conversationId||!draft.trim()||busy)return
  setBusy(true);setNotice('')
  try{const {error}=await supabase.from('support_messages').insert({conversation_id:conversationId,sender_id:userId,ciphertext:draft.trim(),iv:PLAIN_MARKER});if(error)throw error;setDraft('');await loadMessages(conversationId)}catch(error:any){setNotice(error.message||'Message could not be sent.')}finally{setBusy(false)}
 }
 function closePopup(){setOpen(false)}
 const loginHref=`/login?next=${encodeURIComponent(`${path}?support=1`)}`

 return <div className={`supportLauncher ${open?'open':''}`}>
  {open&&<button className="supportPopupBackdrop" aria-label="Close support chat" onClick={closePopup}/>}
  {open&&<aside className="supportPopup" role="dialog" aria-modal="false" aria-label="New India Solar support chat">
   <header className="supportPopupHead"><span><Headphones/></span><div><b>{view==='agent'?'Priority Support':'New India Solar Support'}</b><small><i/> {view==='agent'?'Team conversation':'Online · Instant help'}</small></div><div>{view==='agent'&&<button onClick={()=>setView('bot')} aria-label="Back to instant answers"><ChevronLeft/></button>}<button onClick={closePopup} aria-label="Close support chat"><X/></button></div></header>
   {view==='bot'?<><div className="supportPopupChat" ref={messagesRef}><article className="bot"><span><Bot/></span><div><b>Support Assistant</b><p>Hi! Choose a quick question for an instant answer, or talk directly with our support team.</p></div></article>{answers.map((item,index)=><div className="supportPopupExchange" key={`${item.question}-${index}`}><article className="buyer"><p>{item.question}</p></article><article className="bot"><span><Bot/></span><div><b>Support Assistant</b><p>{item.answer}</p></div></article></div>)}</div><section className="supportPopupQuick"><span>QUICK QUESTIONS</span>{supportQuickAnswers.map(item=><button key={item.question} onClick={()=>setAnswers(history=>[...history,item])}>{item.question}<ChevronRight/></button>)}</section><footer className="supportPopupAgent"><div><Headphones/><span><b>Need personal help?</b><small>Connect on priority—no form required.</small></span></div>{signedIn?<button onClick={connectAgent} disabled={busy}>{busy?<RefreshCw className="spin"/>:<MessageCircle/>}{busy?'Connecting…':'Talk to an agent'}</button>:<Link href={loginHref}><MessageCircle/> Sign in to talk to an agent</Link>}{notice&&<p>{notice}</p>}</footer></>:<><div className="supportPopupAgentStatus"><span><i/> Priority conversation active</span><small>Your support team can reply here in realtime.</small></div><div className="supportPopupMessages" ref={messagesRef}>{messages.map(message=><article key={message.id} className={message.sender_id===userId?'buyer':'agent'}><b>{message.sender_id===userId?'You':'New India Solar Support'}</b><p>{messageText(message)}</p><time>{messageTime(message.created_at)}</time></article>)}{!messages.length&&!busy&&<div className="supportPopupWaiting"><RefreshCw/><p>Preparing your priority conversation…</p></div>}</div>{notice&&<div className="supportPopupNotice">{notice}</div>}<form className="supportPopupComposer" onSubmit={send}><textarea aria-label="Message to support" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Type your message…" maxLength={12000}/><button disabled={busy||!draft.trim()} aria-label="Send message"><Send/></button></form></>}
  </aside>}
  <button type="button" className="supportLauncherButton" onClick={()=>setOpen(value=>!value)} aria-label={open?'Close New India Solar support chat':'Open New India Solar support chat'} aria-expanded={open}><span className="supportLauncherPulse"/><MessageCircle/><span><b>Chat support</b><small>Online</small></span></button>
 </div>
}

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const id=n=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const ADMIN=id(1),STAFF=id(2)

test('one session per person, idle timeout, maximum length, owner sign-out and activity log',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/admin-mfa-schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20260921171535_complete_admin_mfa_flow.sql',import.meta.url),'utf8'))
  await db.exec(`alter table public.profiles add column if not exists full_name text;
   create table public.campaign_targets(id uuid primary key default gen_random_uuid(),label text);
   grant select,insert,update,delete on public.campaign_targets to authenticated;
   insert into auth.users(id,email) values('${ADMIN}','owner@nis.in'),('${STAFF}','staff@nis.in');
   insert into public.profiles(id,role,admin_role,staff_status,full_name) values('${ADMIN}','admin','admin','active','Owner'),('${STAFF}','staff','finance','active','Ravi');`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261103120000_admin_sessions_activity.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261103120000_admin_sessions_activity.sql',import.meta.url),'utf8'))
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows
  const session=async(sid,uid,hoursAgo=0)=>q(`insert into auth.sessions(id,user_id,created_at,updated_at,aal) values($1,$2,now()-make_interval(hours=>$3),now(),'aal1')`,[sid,uid,hoursAgo])
  async function as(uid,sid,fn){await db.exec('begin');try{await q("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:uid,session_id:sid,aal:'aal1',role:'authenticated'})]);await db.exec('set local role authenticated');return await fn()}finally{await db.exec('commit')}}
  const beat=(uid,sid,active=true)=>as(uid,sid,async()=>(await q('select public.admin_session_heartbeat($1) r',[active]))[0].r)
  const ready=(uid,sid)=>as(uid,sid,async()=>(await q('select (public.get_my_admin_access()->>$1) s',['session_status']))[0].s)

  const S1=id(101),S2=id(102),S3=id(103),S4=id(104),A1=id(201)
  await session(S1,STAFF,1)
  assert.equal((await beat(STAFF,S1)).status,'ok','first heartbeat registers the session')
  assert.equal((await q("select count(*)::int c from public.admin_activity where event='login' and user_id=$1",[STAFF]))[0].c,1)

  await session(S2,STAFF,0)
  assert.equal(await ready(STAFF,S1),'replaced','an older device is replaced by a newer sign-in')
  assert.equal((await beat(STAFF,S2)).status,'ok')
  assert.equal((await beat(STAFF,S1)).status,'ended','the old session stays ended')
  assert.equal(await as(STAFF,S1,async()=>(await q('select count(*)::int c from public.admin_security_settings'))[0].c),0,'an ended session reads nothing')

  await q(`update nis_security.admin_sessions set last_active_at=now()-interval '40 minutes' where session_id=$1`,[S2])
  assert.equal((await beat(STAFF,S2,false)).status,'idle','30 minutes without activity signs out')
  assert.equal((await q("select count(*)::int c from public.admin_activity where event='auto_logout'"))[0].c,1)
  assert.equal((await beat(STAFF,S2,true)).status,'ended','activity after the timeout does not revive the session')

  await session(S3,STAFF,13)
  assert.equal(await ready(STAFF,S3),'expired','sessions older than 12 hours expire')

  await session(A1,ADMIN,0)
  await beat(ADMIN,A1)
  await session(S4,STAFF,0)
  assert.equal((await beat(STAFF,S4)).status,'ok')
  await as(STAFF,S4,async()=>{await q("select public.log_admin_activity('page_view','campaigns','/admin/campaigns')");await q("insert into public.campaign_targets(label) values('300 registrations')")})
  const rows=await q("select event,module_key,description from public.admin_activity where user_id=$1 and event in('page_view','create') order by id",[STAFF])
  assert.deepEqual(rows.map(r=>r.event),['page_view','create'])
  assert.match(rows[1].description,/Added targets 300 registrations/)
  await assert.rejects(as(STAFF,S4,()=>q("select public.log_admin_activity('delete')")),/Unsupported activity/)
  assert.equal(await as(STAFF,S4,async()=>(await q('select count(*)::int c from public.admin_activity'))[0].c),0,'staff without security access cannot read the log')
  await assert.rejects(as(STAFF,S4,()=>q("insert into public.admin_activity(event) values('login')")),/permission denied/,'nobody writes the log directly')
  await assert.rejects(as(STAFF,S4,()=>q('select public.save_admin_security_settings(60,24,false,false)')),/Administrator access required/)

  assert.ok(await as(ADMIN,A1,async()=>(await q('select count(*)::int c from public.admin_activity'))[0].c)>3,'the owner reads the log')
  await as(ADMIN,A1,()=>q('select public.admin_force_logout($1)',[STAFF]))
  assert.equal(await ready(STAFF,S4),'revoked','owner sign-out ends every existing session')
  assert.equal((await as(ADMIN,A1,async()=>q('select * from public.admin_list_sessions(7)'))).length,4,'S1, S2, the owner and S4 were registered; the expired S3 never was')
  await as(ADMIN,A1,()=>q('select public.save_admin_security_settings(60,24,false,true,null)'))
  assert.deepEqual((await q('select idle_timeout_minutes,max_session_hours,single_session from public.admin_security_settings'))[0],{idle_timeout_minutes:60,max_session_hours:24,single_session:false})
  await assert.rejects(as(ADMIN,A1,()=>q('select public.save_admin_security_settings(1,24,true,true)')),/check constraint/,'idle timeout has a sensible minimum')
  // Automation account: idle and old, still accepted; the owner cannot be one.
  const BOT=id(3),B1=id(105)
  await db.exec(`insert into auth.users(id,email) values('${BOT}','bot@nis.in'); insert into public.profiles(id,role,admin_role,staff_status) values('${BOT}','staff','finance','active')`)
  await assert.rejects(as(ADMIN,A1,()=>q('select public.save_admin_security_settings(30,12,true,true,$1)',[ADMIN])),/must be a staff account/)
  await as(ADMIN,A1,()=>q('select public.save_admin_security_settings(30,12,true,true,$1)',[BOT]))
  await session(B1,BOT,30)
  assert.equal((await beat(BOT,B1)).status,'ok')
  await q(`update nis_security.admin_sessions set last_active_at=now()-interval '20 hours' where session_id=$1`,[B1])
  assert.equal((await beat(BOT,B1,false)).status,'ok','the automation account is not signed out for inactivity or age')
 }finally{await db.close()}
})

test('the session update also applies on a database without the earlier MFA update',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/admin-mfa-schema.sql',import.meta.url),'utf8'))
  await db.exec(`insert into auth.users(id,email) values('${STAFF}','staff@nis.in'); insert into public.profiles(id,role,admin_role,staff_status) values('${STAFF}','staff','finance','active');
   insert into auth.sessions(id,user_id,created_at,updated_at) values('${id(301)}','${STAFF}',now()-interval '1 hour',now()),('${id(302)}','${STAFF}',now(),now());`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261103120000_admin_sessions_activity.sql',import.meta.url),'utf8'))
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows
  async function as(sid,fn){await db.exec('begin');try{await q("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:STAFF,session_id:sid,aal:'aal1'})]);await db.exec('set local role authenticated');return await fn()}finally{await db.exec('commit')}}
  assert.equal(await as(id(302),async()=>(await q("select public.has_admin_permission('finance','view') ok"))[0].ok),true,'newest session works')
  assert.equal(await as(id(301),async()=>(await q("select public.has_admin_permission('finance','view') ok"))[0].ok),false,'older device is refused')
  // Applying the MFA update afterwards still works (it replaces the placeholder with the real check).
  await db.exec(await readFile(new URL('../supabase/migrations/20260921171535_complete_admin_mfa_flow.sql',import.meta.url),'utf8'))
  assert.equal(await as(id(302),async()=>(await q("select public.has_admin_permission('finance','view') ok"))[0].ok),true)
 }finally{await db.close()}
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const ADMIN=id(1),SALES=id(2),GENERAL=id(3),BUYER=id(4),SUSPENDED=id(5)
const migrations=new URL('../supabase/migrations/',import.meta.url)
const migration=async suffix=>readFile(new URL((await readdir(migrations)).find(name=>name.endsWith(suffix)),migrations),'utf8')

test('campaign data is limited to staff with the campaigns permission',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('./fixtures/catalogue-cost-permissions.sql',import.meta.url),'utf8'))
  await db.exec(`
   create table public.admin_modules(module_key text primary key,label text,description text,route text,sort_order int);
   alter table public.admin_role_permissions add primary key(role_key,module_key);
   insert into profiles values ('${ADMIN}','admin',null,'active'),('${SALES}','staff','sales','active'),('${GENERAL}','staff','general','active'),('${BUYER}','customer',null,'active'),('${SUSPENDED}','admin',null,'suspended');
  `)
  await db.exec(await migration('_surya_ghar_village_campaign.sql'))
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows
  async function as(who,fn){await db.exec('begin');try{await q("select set_config('request.jwt.claim.sub',$1,true)",[who]);await db.exec('set local role authenticated');return await fn()}finally{await db.exec('rollback')}}
  const fails=async(who,sql)=>as(who,async()=>{try{await q(sql);return false}catch{return true}})

  assert.equal((await q("select count(*)::int c from campaign_targets"))[0].c,4,'seeded campaign targets')
  assert.deepEqual((await q("select can_view,can_create,can_edit,can_delete,can_export from admin_role_permissions where role_key='sales' and module_key='campaigns'"))[0],{can_view:true,can_create:true,can_edit:true,can_delete:false,can_export:true})

  const created=await as(ADMIN,async()=>{
   const [camp]=await q("insert into campaign_camps(camp_code,village,district,status) values('C01','Khambha','Amreli','completed') returning id")
   const [lead]=await q("insert into campaign_leads(camp_id,full_name,mobile,district,system_kw,category) values($1,'Ramesh Patel','9825012345','Amreli',2.18,'sc') returning id",[camp.id])
   await q("update campaign_leads set stage='registered' where id=$1",[lead.id])
   return (await q("select activity_type,message from campaign_lead_activities where lead_id=$1 order by created_at,activity_type",[lead.id]))
  })
  assert.deepEqual(created.map(r=>r.activity_type).sort(),['stage_change','system'],'stage changes are logged')

  await db.exec("insert into campaign_leads(full_name,district) values('Seed household','Bhavnagar')")
  assert.equal(await as(SALES,async()=>(await q('select count(*)::int c from campaign_leads'))[0].c),1,'sales can read leads')
  assert.equal(await as(SALES,async()=>(await q("update campaign_leads set stage='survey_done' returning id")).length),1,'sales can edit leads')
  assert.equal(await as(SALES,async()=>(await q('delete from campaign_leads returning id')).length),0,'sales cannot delete leads')
  for(const who of [GENERAL,BUYER,SUSPENDED])assert.equal(await as(who,async()=>(await q('select count(*)::int c from campaign_leads'))[0].c),0,`${who} sees no leads`)
  assert.equal(await fails(GENERAL,"insert into campaign_leads(full_name) values('x')"),true,'general staff cannot add leads')
  assert.equal(await fails(BUYER,"insert into campaign_camps(camp_code,village) values('X','Y')"),true,'buyers cannot add camps')
  assert.equal(await fails(SALES,"insert into campaign_lead_activities(lead_id,message,created_by) select id,'spoof','${ADMIN}' from campaign_leads limit 1"),true,'activity author cannot be spoofed')

  assert.equal(await fails(ADMIN,"insert into campaign_leads(full_name,mobile) values('Bad mobile','12345')"),true,'mobile must be 10 digits')
  assert.equal(await fails(ADMIN,"insert into campaign_leads(full_name,system_kw) values('Too big',25)"),true,'system size is bounded')
  await db.exec("insert into campaign_leads(full_name,consumer_number) values('First','PG-001')")
  assert.equal(await fails(ADMIN,"insert into campaign_leads(full_name,consumer_number) values('Duplicate',' pg-001 ')"),true,'one lead per electricity connection')

  const anonDenied=await (async()=>{await db.exec('begin');try{await db.exec('set local role anon');await q('select 1 from campaign_leads limit 1');return false}catch{return true}finally{await db.exec('rollback')}})()
  assert.equal(anonDenied,true,'anonymous role has no table access')
 }finally{await db.close()}
})

test('village directory and saved venues follow the campaigns permission',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('./fixtures/catalogue-cost-permissions.sql',import.meta.url),'utf8'))
  await db.exec(`
   create table public.admin_modules(module_key text primary key,label text,description text,route text,sort_order int);
   alter table public.admin_role_permissions add primary key(role_key,module_key);
   insert into profiles values ('${ADMIN}','admin',null,'active'),('${SALES}','staff','sales','active'),('${GENERAL}','staff','general','active');
  `)
  await db.exec(await migration('_surya_ghar_village_campaign.sql'))
  await db.exec(await migration('_campaign_villages_venues.sql'))
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows
  async function as(who,fn){await db.exec('begin');try{await q("select set_config('request.jwt.claim.sub',$1,true)",[who]);await db.exec('set local role authenticated');return await fn()}finally{await db.exec('rollback')}}
  const fails=async(who,sql)=>as(who,async()=>{try{await q(sql);return false}catch{return true}})

  await db.exec("insert into geo_villages(district,taluka,name_en,name_gu,lgd_code,source) values('Amreli','Khambha','Khambha','ખાંભા','515470','lgd')")
  await db.exec("insert into campaign_venues(district,taluka,village,venue_type,name) values('Amreli','Khambha','Khambha','gov_school','Prathmik Shala')")
  assert.equal(await as(SALES,async()=>(await q('select count(*)::int c from geo_villages'))[0].c),1,'sales reads villages')
  assert.equal(await as(SALES,async()=>(await q("insert into geo_villages(district,taluka,name_en) values('Amreli','Dhari','Dalkhaniya') returning id")).length),1,'sales adds villages')
  assert.equal(await as(SALES,async()=>(await q("insert into campaign_venues(district,village,venue_type,name) values('Amreli','Dhari','temple','Ram Mandir') returning id")).length),1,'sales adds venues')
  assert.equal(await as(SALES,async()=>(await q('delete from campaign_venues returning id')).length),0,'sales cannot delete venues')
  assert.equal(await as(GENERAL,async()=>(await q('select count(*)::int c from geo_villages'))[0].c),0,'general staff sees no villages')
  assert.equal(await fails(GENERAL,"insert into campaign_venues(district,village,name) values('Amreli','X','Y')"),true,'general staff cannot add venues')
  assert.equal(await fails(ADMIN,"insert into geo_villages(district,taluka,name_en) values('Amreli','khambha',' KHAMBHA ')"),false,'trimmed-name duplicates differ only by spaces are distinct rows')
  assert.equal(await fails(ADMIN,"insert into geo_villages(district,taluka,name_en) values('Amreli','KHAMBHA','khambha')"),true,'one village name per taluka')
  assert.equal(await fails(ADMIN,"insert into campaign_venues(district,village,name) values('Amreli','KHAMBHA','prathmik shala')"),true,'a venue is saved once per village')
  assert.equal(await fails(ADMIN,"insert into campaign_venues(district,village,venue_type,name) values('Amreli','Khambha','stadium','X')"),true,'venue types are fixed')
  const linked=await as(ADMIN,async()=>{const [v]=await q("select id from campaign_venues limit 1");await q("insert into campaign_camps(camp_code,village,district,venue_id,venue) values('C01','Khambha','Amreli',$1,'Prathmik Shala')",[v.id]);await q('delete from campaign_venues where id=$1',[v.id]);return (await q("select venue_id,venue from campaign_camps where camp_code='C01'"))[0]})
  assert.deepEqual(linked,{venue_id:null,venue:'Prathmik Shala'},'deleting a venue keeps the camp and its venue name')
 }finally{await db.close()}
})

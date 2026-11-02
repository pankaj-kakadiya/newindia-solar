import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const ADMIN=id(1),SALES=id(2),GENERAL=id(3)
const migrations=new URL('../supabase/migrations/',import.meta.url)
const migration=async suffix=>readFile(new URL((await readdir(migrations)).find(name=>name.endsWith(suffix)),migrations),'utf8')

test('vendors follow the campaigns permission and households can be assigned',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('./fixtures/catalogue-cost-permissions.sql',import.meta.url),'utf8'))
  await db.exec(`create table public.admin_modules(module_key text primary key,label text,description text,route text,sort_order int);
   alter table public.admin_role_permissions add primary key(role_key,module_key);
   insert into profiles values ('${ADMIN}','admin',null,'active'),('${SALES}','staff','sales','active'),('${GENERAL}','staff','general','active');`)
  await db.exec(await migration('_surya_ghar_village_campaign.sql'))
  await db.exec(await migration('_campaign_vendors.sql'))
  await db.exec(await migration('_campaign_vendors.sql'))
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows
  async function as(who,fn){await db.exec('begin');try{await q("select set_config('request.jwt.claim.sub',$1,true)",[who]);await db.exec('set local role authenticated');return await fn()}finally{await db.exec('rollback')}}
  const fails=async(who,sql)=>as(who,async()=>{try{await q(sql);return false}catch{return true}})
  await db.exec(`insert into campaign_vendors(name,district_installs,portal_rating,portal_reviews) values('Global Solar Energy','{"Amreli":1539}',5,1974)`)
  await db.exec("insert into campaign_leads(full_name,district) values('Household','Amreli')")
  const r=await as(SALES,async()=>{
   const [v]=await q("select id from campaign_vendors")
   await q("update campaign_vendors set status='shortlisted',our_rating=4 where id=$1",[v.id])
   await q("update campaign_leads set vendor_id=$1",[v.id])
   return (await q("select l.full_name,v.status from campaign_leads l join campaign_vendors v on v.id=l.vendor_id"))[0]
  })
  assert.deepEqual(r,{full_name:'Household',status:'shortlisted'})
  assert.equal(await as(GENERAL,async()=>(await q('select count(*)::int c from campaign_vendors'))[0].c),0,'other staff see no vendors')
  assert.equal(await fails(SALES,"insert into campaign_vendors(name) values('global solar energy ')"),true,'one row per vendor name')
  assert.equal(await fails(SALES,"update campaign_vendors set portal_rating=7"),true,'rating is 0-5')
  assert.equal(await fails(SALES,"update campaign_vendors set status='great'"),true,'known statuses only')
  assert.equal(await as(SALES,async()=>(await q('delete from campaign_vendors returning id')).length),0,'sales cannot delete vendors')
  await db.exec('delete from campaign_vendors')
  assert.equal((await q('select vendor_id from campaign_leads'))[0].vendor_id,null,'deleting a vendor keeps the household')
 }finally{await db.close()}
})

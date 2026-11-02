import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const ADMIN=id(1),SALES=id(2)
const migrations=new URL('../supabase/migrations/',import.meta.url)
const migration=async suffix=>readFile(new URL((await readdir(migrations)).find(name=>name.endsWith(suffix)),migrations),'utf8')

test('leads keep their 9-step process and log process activity',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('./fixtures/catalogue-cost-permissions.sql',import.meta.url),'utf8'))
  await db.exec(`create table public.admin_modules(module_key text primary key,label text,description text,route text,sort_order int);
   alter table public.admin_role_permissions add primary key(role_key,module_key);
   insert into profiles values ('${ADMIN}','admin',null,'active'),('${SALES}','staff','sales','active');`)
  await db.exec(await migration('_surya_ghar_village_campaign.sql'))
  await db.exec("insert into campaign_leads(full_name,district) values('Existing household','Amreli')")
  await db.exec(await migration('_campaign_installation_process.sql'))
  await db.exec(await migration('_campaign_installation_process.sql'))
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows
  assert.deepEqual((await q('select process from campaign_leads'))[0].process,{},'existing leads start with an empty process')
  await db.exec('begin')
  await q("select set_config('request.jwt.claim.sub',$1,true)",[SALES]);await db.exec('set local role authenticated')
  const [lead]=await q(`update campaign_leads set process='{"eligibility":{"done_at":"2026-11-02","checks":{"bill":true}}}',stage='registered' returning id,process`)
  assert.equal(lead.process.eligibility.checks.bill,true)
  await q("insert into campaign_lead_activities(lead_id,activity_type,message,created_by) values($1,'process','Step 1 done',$2)",[lead.id,SALES])
  let rejected=false;try{await q("update campaign_leads set process='[]'")}catch{rejected=true}
  assert.equal(rejected,true,'process must be an object')
  await db.exec('rollback')
 }finally{await db.close()}
})

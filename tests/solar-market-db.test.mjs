import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const ADMIN=id(1),SALES=id(2),GENERAL=id(3),BUYER=id(4)
const migrations=new URL('../supabase/migrations/',import.meta.url)
const migration=async suffix=>readFile(new URL((await readdir(migrations)).find(name=>name.endsWith(suffix)),migrations),'utf8')

test('solar market data is seeded and limited to campaign/report staff',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('./fixtures/catalogue-cost-permissions.sql',import.meta.url),'utf8'))
  await db.exec(`
   create table public.admin_modules(module_key text primary key,label text,description text,route text,sort_order int);
   alter table public.admin_role_permissions add primary key(role_key,module_key);
   insert into profiles values ('${ADMIN}','admin',null,'active'),('${SALES}','staff','sales','active'),('${GENERAL}','staff','general','active'),('${BUYER}','customer',null,'active');
  `)
  await db.exec(await migration('_surya_ghar_village_campaign.sql'))
  await db.exec(await migration('_solar_market_dashboards.sql'))
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows
  async function as(who,fn){await db.exec('begin');try{await q("select set_config('request.jwt.claim.sub',$1,true)",[who]);await db.exec('set local role authenticated');return await fn()}finally{await db.exec('rollback')}}
  const fails=async(who,sql)=>as(who,async()=>{try{await q(sql);return false}catch{return true}})

  const counts=Object.fromEntries((await q("select level,count(*)::int c from pmsg_stats group by level")).map(r=>[r.level,r.c]))
  assert.deepEqual(counts,{india:1,state:36,district:33,discom:6},'76 seeded rows')
  const [guj]=await q("select installations::int i,capacity_mw::float mw from pmsg_stats where level='state' and state='Gujarat'")
  const [sum]=await q("select sum(installations)::int i from pmsg_stats where level='district' and state='Gujarat'")
  assert.equal(sum.i,guj.i,'district installations add up to the Gujarat total')
  const [discomSum]=await q("select sum(installations)::int i from pmsg_stats where level='discom' and state='Gujarat'")
  assert.ok(Math.abs(discomSum.i-guj.i)<=guj.i*0.01,'DISCOM installations match the state total')

  assert.equal(await as(SALES,async()=>(await q('select count(*)::int c from pmsg_stats'))[0].c),76,'sales can read portal data')
  const replaced=await as(SALES,async()=>{
   await q("delete from pmsg_stats where snapshot_date='2026-11-02' and level='district' and state ilike 'gujarat'")
   await q("insert into pmsg_stats(snapshot_date,level,state,name,applications,installations,households,capacity_mw,subsidy_lakh) values('2026-11-02','district','Gujarat','Amreli',1,1,1,1,1)")
   return (await q("select count(*)::int c from pmsg_stats where level='district'"))[0].c
  })
  assert.equal(replaced,1,'sales can replace a snapshot')
  for(const who of [GENERAL,BUYER])assert.equal(await as(who,async()=>(await q('select count(*)::int c from pmsg_stats'))[0].c),0,'no portal data for other users')
  assert.equal(await fails(GENERAL,"insert into pmsg_stats(snapshot_date,level,state,name,applications,installations,households,capacity_mw,subsidy_lakh) values('2026-11-03','state','Gujarat','Gujarat',1,1,1,1,1)"),true,'general staff cannot add snapshots')
  assert.equal(await fails(ADMIN,"insert into pmsg_stats(snapshot_date,level,state,name,applications,installations,households,capacity_mw,subsidy_lakh) values('2026-11-02','state','gujarat','GUJARAT',1,1,1,1,1)"),true,'one row per place per snapshot, case-insensitive')
  assert.equal(await fails(ADMIN,"insert into pmsg_stats(snapshot_date,level,state,name,applications,installations,households,capacity_mw,subsidy_lakh) values('2026-11-03','taluka','Gujarat','Una',1,1,1,1,1)"),true,'no taluka level')

  const reading="insert into energy_readings(observed_at,metric,value) values('2026-11-02T10:00:00Z','gujarat_demand_mw',18452)"
  assert.equal(await as(SALES,async()=>{await q(reading);return (await q("insert into energy_readings(observed_at,metric,value) values('2026-11-02T10:00:00Z','gujarat_demand_mw',18000) on conflict do nothing returning id")).length}),0,'one reading per metric per time')
  assert.equal(await fails(BUYER,reading),true,'buyers cannot write readings')
  assert.equal(await fails(SALES,"insert into energy_readings(observed_at,metric,value) values(now(),'solar_mw',1)"),true,'only known metrics')
  assert.equal(await fails(SALES,"delete from energy_readings"),true,'readings cannot be deleted from the app')
 }finally{await db.close()}
})

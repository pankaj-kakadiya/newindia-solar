import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const id=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const MANAGER=id(1),FIELD=id(2)
const migrations=new URL('../supabase/migrations/',import.meta.url)
const migration=async suffix=>readFile(new URL((await readdir(migrations)).find(name=>name.endsWith(suffix)),migrations),'utf8')

test('campaign manager and field executive roles get exactly the campaign rights',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('./fixtures/catalogue-cost-permissions.sql',import.meta.url),'utf8'))
  await db.exec(`create table public.admin_modules(module_key text primary key,label text,description text,route text,sort_order int);
   alter table public.admin_role_permissions add primary key(role_key,module_key);
   create table public.admin_role_definitions(role_key text primary key,name text,description text,sort_order int,is_system boolean);
   insert into public.admin_modules(module_key) values('dashboard'),('search'),('finance'),('security'),('reports');`)
  await db.exec(await migration('_surya_ghar_village_campaign.sql'))
  await db.exec(await migration('_campaign_team_roles.sql'))
  await db.exec(await migration('_campaign_team_roles.sql'))
  await db.exec(`insert into profiles values ('${MANAGER}','staff','campaign_manager','active'),('${FIELD}','staff','field_executive','active');
   insert into campaign_leads(full_name,district) values('Household','Amreli');`)
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows
  async function as(who,fn){await db.exec('begin');try{await q("select set_config('request.jwt.claim.sub',$1,true)",[who]);await db.exec('set local role authenticated');return await fn()}finally{await db.exec('rollback')}}
  const perms=async role=>Object.fromEntries((await q('select module_key,can_view,can_create,can_edit,can_delete,can_export from admin_role_permissions where role_key=$1 order by module_key',[role])).map(r=>[r.module_key,[r.can_view,r.can_create,r.can_edit,r.can_delete,r.can_export].map(Number).join('')]))
  assert.deepEqual(await perms('campaign_manager'),{campaigns:'11111',dashboard:'10000',finance:'00000',reports:'10001',search:'10000',security:'00000'})
  assert.deepEqual(await perms('field_executive'),{campaigns:'11100',dashboard:'10000',finance:'00000',reports:'00000',search:'10000',security:'00000'})
  assert.equal(await as(FIELD,async()=>(await q("update campaign_leads set stage='registered' returning id")).length),1,'field executive updates households')
  assert.equal(await as(FIELD,async()=>(await q('delete from campaign_leads returning id')).length),0,'field executive cannot delete')
  assert.equal(await as(MANAGER,async()=>(await q('delete from campaign_leads returning id')).length),1,'campaign manager can delete')
 }finally{await db.close()}
})

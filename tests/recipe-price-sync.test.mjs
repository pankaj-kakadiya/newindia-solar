import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {recipeSellingPrice} from '../lib/manufacturing-costs.ts'
const migration=await readFile(new URL('../supabase/migrations/20260929131606_recipe_selling_price_sync.sql',import.meta.url),'utf8')
const uid='00000000-0000-0000-0000-000000000001', output='00000000-0000-0000-0000-000000000002', material='00000000-0000-0000-0000-000000000003'
async function setup(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.has_admin_permission(text,text) returns boolean language sql as $$select case when $1='production' then coalesce(current_setting('test.production',true),'on')='on' else coalesce(current_setting('test.pricing',true),'on')='on' end$$;
 create table product_variants(id uuid primary key,cost_price numeric,selling_price numeric,updated_at timestamptz);
 create table components(id uuid primary key,cost_price numeric);create table enclosures(id uuid primary key,cost_price numeric);
 create table pricing_settings(id text primary key,min_margin_percent numeric,enforce_min_margin boolean);
 create table manufacturing_recipes(id uuid primary key default gen_random_uuid(),variant_id uuid,name text,box_type text,version int,status text,labour_cost numeric,overhead_cost numeric,packaging_cost numeric,target_margin_percent numeric,notes text,created_by uuid,updated_by uuid,updated_at timestamptz);
 create table manufacturing_recipe_items(id uuid primary key default gen_random_uuid(),recipe_id uuid references manufacturing_recipes(id),component_id uuid,enclosure_id uuid,variant_id uuid,quantity numeric,wastage_percent numeric,unit text,notes text,sort_order int);
 create table production_jobs(id uuid primary key default gen_random_uuid(),manufacturing_recipe_id uuid);
 insert into pricing_settings values('default',15,true);
 insert into product_variants values('${output}',42,99,now());insert into components values('${material}',800);
 select set_config('test.uid','${uid}',false);`)
 await db.exec(migration)
 return db
}
async function save(db,{id=null,status='active',margin=20,items=[{item_type:'component',item_id:material,quantity:1,wastage_percent:0}],labour=0}={}){
 return (await db.query('select public.save_manufacturing_recipe($1,$2,$3,$4,$5,$6,0,0,$7,null,$8::jsonb) as id',[id,output,'Test box','acdb',status,labour,margin,JSON.stringify(items)])).rows[0].id
}
async function price(db){return (await db.query('select cost_price::float8 as cost,selling_price::float8 as sell from product_variants')).rows[0]}
test('active saves publish gross margin price including extras and wastage, with paisa rounding',async()=>{
 const db=await setup();try{
 await save(db);assert.deepEqual(await price(db),{cost:800,sell:1000})
 await save(db,{margin:15,labour:10,items:[{item_type:'component',item_id:material,quantity:1,wastage_percent:5}]})
 assert.deepEqual(await price(db),{cost:850,sell:1000})
 await db.exec('update components set cost_price=100.01');await save(db,{margin:15});assert.deepEqual(await price(db),{cost:100.01,sell:117.66})
 assert.equal(recipeSellingPrice(100.01,15),117.66)
 }finally{await db.close()}
})
test('draft and archived saves never change live cost or selling price',async()=>{
 const db=await setup();try{for(const status of ['draft','archived']){await save(db,{status});assert.deepEqual(await price(db),{cost:42,sell:99})}}finally{await db.close()}
})
test('permission, policy and invalid-cost failures roll back recipe and price changes',async()=>{
 const db=await setup();try{
 await assert.rejects(save(db,{margin:10}),/at least 15/)
 await assert.rejects(save(db,{margin:100}),/between 0 and 99/)
 await db.exec("select set_config('test.pricing','off',false)")
 await assert.rejects(save(db),/pricing edit permission/)
 await db.exec("select set_config('test.pricing','on',false);select set_config('test.production','off',false)")
 await assert.rejects(save(db),/Production edit/)
 await db.exec("select set_config('test.production','on',false);select set_config('test.uid','',false)")
 await assert.rejects(save(db),/Production edit/)
 await db.exec(`select set_config('test.uid','${uid}',false);update components set cost_price=null`)
 await assert.rejects(save(db),/cost price/)
 await db.exec('update components set cost_price=0');await assert.rejects(save(db),/greater than zero/)
 assert.deepEqual(await price(db),{cost:42,sell:99});assert.equal((await db.query('select count(*)::int as n from manufacturing_recipes')).rows[0].n,0)
 }finally{await db.close()}
})
test('production history creates a new version and preserves the old BOM',async()=>{
 const db=await setup();try{
 const id=await save(db);await db.query('insert into production_jobs(manufacturing_recipe_id) values($1)',[id]);
 const next=await save(db,{id,margin:25});assert.notEqual(id,next)
 assert.deepEqual(await price(db),{cost:800,sell:1066.67})
 assert.equal((await db.query('select status from manufacturing_recipes where id=$1',[id])).rows[0].status,'archived')
 assert.equal((await db.query('select count(*)::int as n from manufacturing_recipe_items where recipe_id=$1',[id])).rows[0].n,1)
 }finally{await db.close()}
})

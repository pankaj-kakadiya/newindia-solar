import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { deleteAdminRecords, productIdsForRows } from '../lib/admin-delete.ts';

test('bulk variant selection resolves distinct whole products', () => {
  assert.deepEqual(productIdsForRows([{id:'a',product_id:'p'},{id:'b',product_id:'p'},{id:'c',product_id:'q'}], ['a','b','missing']), ['p']);
});
test('delete helper rejects empty requests and reports denied rows accurately', async () => {
  const calls=[];
  const client={from: table=>({delete:()=>({in:(key,ids)=>({select:async field=>{calls.push({table,key,ids,field});return {data:[{id:'a'}],error:null};}})})})};
  await assert.rejects(deleteAdminRecords(client,'products',[]),/Select at least/);
  assert.equal(calls.length,0);
  assert.deepEqual(await deleteAdminRecords(client,'products',['a','a','b']),{deleted:['a'],missing:['b']});
  assert.deepEqual(calls[0],{table:'products',key:'id',ids:['a','b'],field:'id'});
});
test('delete helper explains protected records', async () => {
  const client={from:()=>({delete:()=>({in:()=>({select:async()=>({error:{code:'23503'}})})})})};
  await assert.rejects(deleteAdminRecords(client,'products',['a']),/Inactive/);
  await assert.rejects(deleteAdminRecords(client,'manufacturing_recipes',['a']),/Archived/);
});

test('database deletion guards preserve stock and historical references atomically', async t => {
 const db=new PGlite();
 try {
 await db.exec(`
 create role anon; create role authenticated;
 create table products(id int primary key);
 create table product_variants(id int primary key,product_id int references products on delete cascade,stock_qty numeric default 0);
 create table product_images(product_id int references products on delete cascade);
 create table order_items(variant_id int references product_variants on delete set null);
 create table inventory_movements(variant_id int references product_variants on delete cascade);
 create table inventory_reservations(variant_id int references product_variants on delete cascade);
 create table manufacturing_recipes(id int primary key,variant_id int references product_variants on delete restrict);
 create table manufacturing_recipe_items(recipe_id int references manufacturing_recipes on delete cascade);
 create table production_jobs(manufacturing_recipe_id int references manufacturing_recipes on delete set null);
 insert into products values(1),(2);
 insert into product_variants values(1,1,0),(2,2,0);
 insert into product_images values(1);
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20260922124548_protect_product_recipe_deletion.sql',import.meta.url),'utf8'));
 const scenario=async(name,run)=>t.test(name,async()=>{await db.exec('begin');try{await run();}finally{await db.exec('rollback');}});
 await scenario('unused product deletion cascades its variants and image links',async()=>{
  await db.exec('delete from products where id=1');
  assert.equal((await db.query('select * from product_variants where id=1')).rows.length,0);
  assert.equal((await db.query('select * from product_images')).rows.length,0);
 });
 for(const table of ['order_items','inventory_movements','inventory_reservations']) await scenario(`${table} prevents deletion of the whole selection`,async()=>{
  await db.exec(`insert into ${table} values(2); savepoint attempt`);
  await assert.rejects(db.exec('delete from products where id in (1,2)'),/foreign key/);
  await db.exec('rollback to attempt');
  assert.equal((await db.query('select * from products')).rows.length,2);
  assert.equal((await db.query(`select * from ${table}`)).rows.length,1);
 });
 await scenario('nonzero stock prevents product deletion',async()=>{
  await db.exec('update product_variants set stock_qty=1 where id=1');
  await assert.rejects(db.exec('delete from products where id=1'),/with stock/);
 });
 await scenario('unused recipe deletes its BOM but keeps the finished product',async()=>{
  await db.exec('insert into manufacturing_recipes values(1,1); insert into manufacturing_recipe_items values(1); delete from manufacturing_recipes where id=1');
  assert.equal((await db.query('select * from manufacturing_recipe_items')).rows.length,0);
  assert.equal((await db.query('select * from product_variants where id=1')).rows.length,1);
 });
 await scenario('recipe with production history cannot be deleted',async()=>{
  await db.exec('insert into manufacturing_recipes values(1,1); insert into production_jobs values(1)');
  await assert.rejects(db.exec('delete from manufacturing_recipes where id=1'),/foreign key/);
 });
 await scenario('RLS denial returns no deleted records',async()=>{
  await db.exec(`alter table products enable row level security; grant select,delete on products to authenticated; create policy visible on products for select to authenticated using(true); set local role authenticated`);
  assert.deepEqual((await db.query('delete from products where id=1 returning id')).rows,[]);
 });
 } finally {await db.close();}
});

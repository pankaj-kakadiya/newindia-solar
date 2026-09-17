import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const buyer=id(1),other=id(2),product=id(3),variant=id(4),cart=id(5);
test('standard checkout and authorization integrity',async t=>{
 const db=new PGlite();
 await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('./fixtures/catalogue-cost-permissions.sql',import.meta.url),'utf8'));
 await db.exec(`alter table carts add primary key(id);create table inventory_reservations(id uuid default gen_random_uuid(),order_id uuid,order_item_id uuid,production_job_id uuid,variant_id uuid,component_id uuid,enclosure_id uuid,quantity numeric,status text default 'reserved',created_at timestamptz default now(),updated_at timestamptz default now());grant all on inventory_reservations to anon,authenticated;`);
 // Reproduce permissive legacy grants, then verify restrictive guards defeat them.
 for(const table of ['products','product_variants','components','enclosures','orders','order_items','payments','inventory_reservations']){
  await db.exec(`alter table ${table} enable row level security;create policy legacy_open on ${table} for all using(true) with check(true);`);
 }
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const name of (await readdir(dir)).sort())if(/_(secure_custom_configuration_pricing|admin_catalogue_cost_access|restrict_catalogue_cost_reads|secure_standard_checkout)\.sql$/.test(name))await db.exec(await readFile(new URL(name,dir),'utf8'));
 await db.exec(await readFile(new URL('./fixtures/checkout-inventory-functions.sql',import.meta.url),'utf8'));
 await db.exec(`create trigger inventory_status after update on orders for each row execute function inventory_order_status_trigger();
 insert into profiles values('${buyer}','customer',null,'active'),('${other}','customer',null,'active'),('${id(9)}','admin',null,'active');
 insert into products(id,name,slug,status,gst_rate,min_order_qty) values('${product}','Synthetic','synthetic','active',5,1);
 insert into product_variants(id,product_id,sku,title,selling_price,cost_price,stock_qty,low_stock_threshold) values('${variant}','${product}','SYNTHETIC','Synthetic',100,50,10,0);`);
 const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const auth=async(who=buyer)=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,true)",[who]);await db.exec('set local role authenticated');};
 const admin=async(sql)=>{await db.exec('reset role');return q(sql);};
 const prepare=async(qty=2,c=cart,lines)=> (await q('select prepare_checkout_cart($1,$2) result',[c,JSON.stringify(lines||[{variant_id:variant,quantity:qty}])]))[0].result;
 const place=async(c=cart)=>(await q("select place_order_from_cart($1,'{}','{}','{}',false,null,null,null,'bank_transfer') result",[c]))[0].result;
 async function scenario(name,fn){await t.test(name,async()=>{await db.exec('begin');try{await auth();await fn();}finally{await db.exec('rollback');}});}
 for(const [name,change,quantity,pattern] of [
  ['zero price',`update product_variants set selling_price=0`,2,/price/],
  ['negative price',`update product_variants set selling_price=-1`,2,/price/],
  ['NaN price',`update product_variants set selling_price='NaN'`,2,/price/],
  ['MOQ',`update products set min_order_qty=5`,2,/Minimum/],
  ['fractional pieces','select 1',1.5,/increment/],
  ['stock shortage','select 1',11,/stock/],
  ['inactive variant',`update product_variants set is_active=false`,2,/unavailable/i],
  ['inactive product',`update products set status='draft'`,2,/unavailable/i],
  ['invalid GST',`update products set gst_rate=-1`,2,/GST/],
  ['invalid increment',`update product_variants set attributes='{"quantity_step":0}'`,2,/increment/]
 ])await scenario(name,async()=>{await prepare(quantity);await admin(change);await auth();await assert.rejects(place,pattern);});
 for(const qty of [0,-1,'NaN','Infinity',0.0001])await scenario(`invalid input ${qty}`,async()=>{await assert.rejects(()=>prepare(qty),/quantity/i);});
 await scenario('server-owned price and GST plus reservation',async()=>{await prepare();await admin(`update cart_items set unit_price=0`);await auth();const o=await place();assert.equal(o.grand_total,210);const r=await admin(`select sum(quantity) n from inventory_reservations where status='reserved'`);assert.equal(Number(r[0].n),2);});
 await scenario('retry returns identical order and one payment',async()=>{await prepare();const first=await place();assert.deepEqual(await place(),first);assert.deepEqual((await prepare()).order,first);assert.equal((await admin('select count(*) n from orders'))[0].n,1);assert.equal((await admin('select count(*) n from payments'))[0].n,1);});
 await scenario('completed cart cannot be repopulated',async()=>{await prepare();await place();await assert.rejects(()=>q('insert into cart_items(cart_id,variant_id,quantity,unit_price) values($1,$2,1,1)',[cart,variant]),/already been checked/);});
 await scenario('other buyer cannot replay receipt',async()=>{await prepare();await place();await auth(other);await assert.rejects(place,/owned/);});
 await scenario('combined duplicate lines cannot exceed stock',async()=>{await prepare(1,cart,[{variant_id:variant,quantity:6},{variant_id:variant,quantity:6}]);await assert.rejects(place,/stock/);});
 await scenario('two carts compete for remaining stock',async()=>{await prepare(6);await place();await auth(other);await prepare(6,id(6));await assert.rejects(()=>place(id(6)),/stock/);});
 await scenario('fractional measured units and zero GST',async()=>{await admin(`update product_variants set unit='m'`);await admin(`update products set gst_rate=0`);await auth();await prepare(1.25);assert.equal((await place()).grand_total,125);});
 await scenario('confirm does not double reserve, cancellation releases stock',async()=>{await prepare(6);const order=await place();await admin(`update orders set status='confirmed' where id='${order.order_id}'`);assert.equal((await admin(`select count(*) n from inventory_reservations`))[0].n,1);await admin(`update orders set status='cancelled' where id='${order.order_id}'`);await auth(other);await prepare(10,id(6));await place(id(6));});
 await scenario('shipping consumes stock exactly once',async()=>{await prepare(6);const order=await place();await admin(`update orders set status='shipped' where id='${order.order_id}'`);assert.equal(Number((await admin(`select stock_qty from product_variants`))[0].stock_qty),4);});
 for(const table of ['products','product_variants','components','enclosures','orders','order_items','payments','inventory_reservations'])await scenario(`buyer cannot delete ${table}`,async()=>{await prepare();await place();assert.equal((await q(`delete from ${table} returning id`)).length,0);});
 await scenario('buyer cannot create forged order',async()=>{await assert.rejects(()=>q("insert into orders(user_id) values($1)",[buyer]),/row-level security/);});
 await scenario('buyer cannot forge reservation',async()=>{await assert.rejects(()=>q("insert into inventory_reservations(variant_id,quantity) values($1,1000)",[variant]),/row-level security/);});
 await scenario('buyer sees only own order and payments',async()=>{await prepare();await place();assert.equal((await q('select id from orders')).length,1);await auth(other);assert.equal((await q('select id from orders')).length,0);assert.equal((await q('select id from payments')).length,0);});
 await scenario('active admin retains permitted direct editing',async()=>{await auth(id(9));assert.equal((await q("update products set name='Admin edit' returning id")).length,1);});
 await scenario('buyer cannot change order payment status',async()=>{await prepare();await place();assert.equal((await q("update orders set payment_status='paid' returning id")).length,0);assert.equal((await q("update payments set status='paid' returning id")).length,0);});
 await scenario('buyer cannot change selling price or stock',async()=>{assert.equal((await q("update product_variants set selling_price=1,stock_qty=999999 returning id")).length,0);});
 await scenario('anonymous callers cannot prepare or place orders',async()=>{await db.exec('set local role anon');await assert.rejects(()=>prepare(),/permission denied/);});
 await scenario('stock reservation failure rolls back order and payment',async()=>{await prepare(11);await db.exec('savepoint failed_order');await assert.rejects(place,/stock/);await db.exec('rollback to savepoint failed_order');assert.equal((await admin('select count(*) n from orders'))[0].n,0);assert.equal((await admin('select count(*) n from payments'))[0].n,0);});
 await db.close();
});

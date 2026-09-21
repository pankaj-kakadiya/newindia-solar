import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {profileInput,addressInput,indianPhone,safeNext,safeTrackingUrl,ORDER_FIELDS,ORDER_ITEM_FIELDS} from '../lib/buyer-account.ts'
import {buyerDocument} from '../lib/buyer-document.ts'
import ts from 'typescript'

test('mobile normalization accepts Indian numbers and rejects malformed numbers',()=>{
 for(const n of ['9876543210','+91 98765 43210','919876543210'])assert.equal(indianPhone(n),'+919876543210')
 for(const n of ['12345','1234567890','+19876543210','9876543210abc'])assert.equal(indianPhone(n),null)
})
test('profile only accepts editable customer fields and validates GST structure',()=>{
 const p=profileInput({full_name:'Buyer',phone:'9876543210',company_name:'Example',gstin:'24abcde1234f1z5',role:'admin',credit_limit:100000})
 assert.equal(p.gstin,'24ABCDE1234F1Z5');assert.equal(p.role,undefined);assert.equal(p.credit_limit,undefined)
 assert.throws(()=>profileInput({full_name:'Buyer',gstin:'invalid'}),/GSTIN/)
 assert.throws(()=>profileInput({full_name:'Buyer',gstin:'24ABCDE1234F1Z5'}),/business/)
})
test('address validation and redirects reject unsafe inputs',()=>{
 assert.throws(()=>addressInput({contact_name:'Buyer'}),/PIN/)
 const a=addressInput({contact_name:'Buyer',phone:'9876543210',address_line1:'Test',city:'Surat',state:'Gujarat',postal_code:'395001',user_id:'other'})
 assert.equal(a.user_id,undefined);assert.equal(a.phone,'+919876543210')
 for(const s of ['https://evil.test','//evil.test','/\\evil.test'])assert.equal(safeNext(s),'/account')
 assert.equal(safeNext('/checkout'),'/checkout');assert.equal(safeTrackingUrl('javascript:alert(1)'),null)
})
test('downloads escape untrusted text and never label order summaries as tax invoices',()=>{
 const html=buyerDocument({order:{order_number:'<script>alert(1)</script>',shipping_address:{address_line1:'<img onerror=bad>'}},items:[{name_snapshot:'<script>bad</script>',quantity:1}],seller:{}})
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('not a tax invoice'))
 assert.ok(html.includes('PURCHASE ORDER'));assert.ok(html.includes('VERIFIED'));assert.ok(html.includes('new-india-solar-full-logo.webp'))
 assert.ok(!/admin_notes|configuration_snapshot|cost_price/.test(ORDER_FIELDS+ORDER_ITEM_FIELDS))
})

test('issued invoice renders as a branded verified tax document',()=>{
 const data={order:{order_number:'NIS-ORDER-1'},items:[],seller:{legal_name:'New India Solar Components Pvt Ltd'}}
 const html=buyerDocument(data,{document_type:'tax_invoice',invoice_number:'NIS/26-27/1',status:'issued',items:[]},'https://newindiasolar.com/new-india-solar-full-logo.webp')
 assert.ok(html.includes('TAX INVOICE'));assert.ok(html.includes('VERIFIED'));assert.ok(html.includes('New India Solar Components Pvt Ltd'));assert.ok(!html.includes('Download invoice (.html)'))
})

function queryDB(resolve){const calls=[];return {calls,from(table){let op='select',filters=[],values;const q={select(){return q},update(v){op='update';values=v;return q},insert(v){op='insert';values=v;return q},delete(){op='delete';return q},eq(k,v){filters.push([k,v]);return q},order(){return q},range(){return q},limit(){return q},not(){return q},in(k,v){filters.push([k,v]);return q},maybeSingle(){return q},single(){return q},throwOnError(){return q},then(ok,no){const c={table,op,filters,values};calls.push(c);return Promise.resolve(resolve(c)).then(ok,no)}};return q}}}
const buyer='10000000-0000-4000-8000-000000000001',orderId='10000000-0000-4000-8000-000000000002'
function route(path,context){const source=readFileSync(new URL(`../app/api/buyer/${path}/route.ts`,import.meta.url),'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}};class BuyerError extends Error{constructor(m,status){super(m);this.status=status||400}};new Function('require','module','exports',code)(id=>id==='next/server'?{}:id.includes('buyer-server')?{buyerContext:async()=>context,buyerJson:(body,status=200)=>({body,status}),buyerFailure:e=>({status:e.status||503}),BuyerError,validate:f=>f()}:accountHelpers,module,module.exports);return module.exports}
import * as accountHelpers from '../lib/buyer-account.ts'
test('order detail and repeat both reject foreign order before fetching child records',async()=>{
 for(const method of ['GET','POST']){const db=queryDB(()=>({data:null})),api=route('orders/[id]',{db,user:{id:buyer}});assert.equal((await api[method]({}, {params:Promise.resolve({id:orderId})})).status,404);assert.equal(db.calls.length,1);assert.deepEqual(db.calls[0].filters,[['id',orderId],['user_id',buyer]])}
})
test('address updates and deletion always constrain both address and buyer ID',async()=>{
 const db=queryDB(()=>({data:null})),api=route('addresses',{client:db,user:{id:buyer}})
 const r=await api.DELETE({nextUrl:new URL(`https://fixture.test?id=${orderId}`)});assert.equal(r.status,404);assert.deepEqual(db.calls[0].filters,[['id',orderId],['user_id',buyer]])
})
test('repeat order uses current catalogue prices and stock, not saved order price',async()=>{
 const db=queryDB(c=>({data:c.table==='orders'?{id:orderId}:c.table==='order_items'?[{variant_id:'variant',name_snapshot:'Product',quantity:2,unit_price:1}]:c.table==='product_variants'?{id:'variant',title:'Current',selling_price:150,stock_qty:10,is_active:true,unit:'pcs',products:{name:'Product',status:'active',min_order_qty:1}}:[]}))
 const r=await route('orders/[id]',{db,user:{id:buyer}}).POST({}, {params:Promise.resolve({id:orderId})})
 assert.equal(r.body.items[0].price,150);assert.equal(r.body.items[0].qty,2)
})
test('repeat order reports unavailable products rather than silently reusing old prices',async()=>{
 const db=queryDB(c=>({data:c.table==='orders'?{id:orderId}:c.table==='order_items'?[{variant_id:'variant',name_snapshot:'Old',quantity:2}]:null}))
 const r=await route('orders/[id]',{db,user:{id:buyer}}).POST({}, {params:Promise.resolve({id:orderId})})
 assert.equal(r.body.items.length,0);assert.equal(r.body.notAdded.length,1)
})
test('address autosave is transactional, deduplicated and scoped to the buyer; invoice RLS blocks buyers',async()=>{
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create schema nis_private;create table profiles(id uuid primary key);create table orders(id uuid default gen_random_uuid(),user_id uuid,shipping_address jsonb);create table addresses(id uuid default gen_random_uuid(),user_id uuid,label text,contact_name text,phone text,address_line1 text,address_line2 text,city text,state text,postal_code text,country text,is_default_shipping boolean);create table invoices(id int);create table invoice_items(id int);grant all on invoices,invoice_items to anon,authenticated;create policy legacy on invoices for all using(true) with check(true);create policy legacy on invoice_items for all using(true) with check(true);create function is_staff_or_admin() returns boolean language sql as 'select false';create function has_admin_permission(text,text) returns boolean language sql as 'select false';insert into profiles values('${buyer}'),('${orderId}');insert into invoices values(1);insert into invoice_items values(1);`)
 const file=readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(f=>f.endsWith('_buyer_account_features.sql'));await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'))
 const a={full_name:'Test Buyer',phone:'+919876543210',address_line1:'Test Street',city:'Surat',state:'Gujarat',postal_code:'395001'}
 const insert=uid=>db.query('insert into orders(user_id,shipping_address) values($1,$2)',[uid,JSON.stringify(a)])
 await insert(buyer);await insert(buyer);assert.equal((await db.query('select count(*)::int n from addresses')).rows[0].n,1)
 await insert(orderId);assert.equal((await db.query('select count(*)::int n from addresses')).rows[0].n,2)
 await db.exec('begin');await db.query('insert into orders(user_id,shipping_address) values($1,$2)',[buyer,JSON.stringify({...a,address_line1:'Other'})]);await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from addresses')).rows[0].n,2)
 await db.exec('set role authenticated');assert.equal((await db.query('select * from invoices')).rows.length,0);await assert.rejects(db.exec('insert into invoices values(2)'),/row-level security/);await db.exec('reset role');await db.close()
})

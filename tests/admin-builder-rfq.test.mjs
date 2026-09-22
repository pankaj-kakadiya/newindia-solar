import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
test('RFQ snapshot migration preserves old requests and enforces bounded object snapshots',async()=>{
 const db=new PGlite()
 try{
 await db.exec("create table public.bulk_rfqs(id integer primary key,requirement text); insert into bulk_rfqs values(1,'Existing request');")
 await db.exec(readFileSync(new URL('../supabase/migrations/20260922140519_builder_rfq_snapshot.sql',import.meta.url),'utf8'))
 assert.equal((await db.query('select requirement,builder_snapshot from bulk_rfqs where id=1')).rows[0].requirement,'Existing request')
 const snapshot={version:1,product:'ACDB',selections:{spd:[{id:'selected-component',qty:1}]},review_required:true}
 await db.query('insert into bulk_rfqs(id,builder_snapshot) values(2,$1)',[JSON.stringify(snapshot)])
 assert.deepEqual((await db.query('select builder_snapshot from bulk_rfqs where id=2')).rows[0].builder_snapshot,snapshot)
 for(const invalid of [[],{},null===true,{version:1,product:'OTHER',selections:{}},{version:1,product:'ACDB',selections:[]},{version:1,product:'DCDB',selections:{},summary:'x'.repeat(100001)}])await assert.rejects(db.query('insert into bulk_rfqs(id,builder_snapshot) values(3,$1)',[JSON.stringify(invalid)]),/bulk_rfqs_builder_snapshot_check/)
 }finally{await db.close()}
})

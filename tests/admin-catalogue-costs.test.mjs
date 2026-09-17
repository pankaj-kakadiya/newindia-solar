import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {loadAdminCosts} from '../lib/admin-catalogue-costs.ts'
import {VARIANT_FIELDS,COMPONENT_FIELDS,ENCLOSURE_FIELDS,BUYER_VARIANT_FIELDS} from '../lib/catalogue-projections.ts'

const result=data=>Promise.resolve({data,error:null})
const client=rpc=>({rpc})
test('admin loader preserves real zero and unknown null costs without changing source rows',async()=>{
  const source=[{id:'one',selling_price:100},{id:'two',selling_price:80}]
  const loaded=await loadAdminCosts(client(async(name,args)=>{
    assert.equal(name,'admin_catalogue_costs');assert.deepEqual(args,{p_item_type:'component',p_item_ids:['one','two'],p_module:'components'})
    return {data:[{item_id:'one',cost_price:0},{item_id:'two',cost_price:null}],error:null}
  }),result(source),'component','components')
  assert.equal(loaded.error,null);assert.equal(loaded.data[0].cost_price,0);assert.equal(loaded.data[1].cost_price,null)
  assert.equal('cost_price' in source[0],false)
})
test('nested product variants preserve product data and deduplicate cost lookups',async()=>{
  const loaded=await loadAdminCosts(client(async(_,args)=>{
    assert.deepEqual(args.p_item_ids,['v1']);return {data:[{item_id:'v1',cost_price:12.5}],error:null}
  }),result([{id:'p1',name:'One',product_variants:[{id:'v1'}]},{id:'p2',product_variants:[{id:'v1'}]},{id:'p3'}]),'variant','products','product_variants')
  assert.equal(loaded.data[0].name,'One');assert.equal(loaded.data[0].product_variants[0].cost_price,12.5)
  assert.equal(loaded.data[1].product_variants[0].cost_price,12.5);assert.deepEqual(loaded.data[2].product_variants,[])
})
test('large catalogues fetch bounded batches and retain all rows',async()=>{
  const calls=[];const loaded=await loadAdminCosts(client(async(_,args)=>{calls.push(args.p_item_ids.length);return {data:args.p_item_ids.map(item_id=>({item_id,cost_price:25})),error:null}}),result(Array.from({length:2001},(_,i)=>({id:String(i)}))),'variant','inventory')
  assert.deepEqual(calls,[1000,1000,1]);assert.equal(loaded.data.length,2001)
})
test('empty catalogue avoids an unnecessary cost request',async()=>{
  const loaded=await loadAdminCosts(client(()=>{throw Error('must not run')}),result([]),'variant','products');assert.deepEqual(loaded,{data:[],error:null})
})
test('failed catalogue query does not trigger cost lookup',async()=>{
  const loaded=await loadAdminCosts(client(()=>{throw Error('must not run')}),Promise.resolve({data:null,error:{message:'Catalogue denied'}}),'variant','products')
  assert.equal(loaded.data,null);assert.equal(loaded.error.message,'Catalogue denied')
})
for(const [label,rpc]of [
  ['permission denied',async()=>({data:null,error:{message:'Module view permission required'}})],
  ['missing item',async()=>({data:[],error:null})],
  ['network failure',async()=>{throw Error('Network failed')}],
])test(`${label} discards editable rows rather than inventing zero costs`,async()=>{
  const loaded=await loadAdminCosts(client(rpc),result([{id:'one',selling_price:100}]),'variant','products')
  assert.equal(loaded.data,null);assert.ok(loaded.error.message)
})
test('a later failed batch discards all partly hydrated rows',async()=>{
  let n=0;const loaded=await loadAdminCosts(client(async(_,args)=>++n===1?{data:args.p_item_ids.map(item_id=>({item_id,cost_price:25})),error:null}:{data:null,error:{message:'Access revoked'}}),result(Array.from({length:1001},(_,i)=>({id:String(i)}))),'variant','products')
  assert.equal(loaded.data,null);assert.equal(loaded.error.message,'Access revoked')
})
test('explicit catalogue projections never contain private costs or wildcard fields',()=>{
  for(const fields of [VARIANT_FIELDS,COMPONENT_FIELDS,ENCLOSURE_FIELDS,BUYER_VARIANT_FIELDS]){assert.ok(fields.split(',').includes('selling_price'));assert.ok(!/cost_price|\*/.test(fields))}
})
test('application queries cannot regress to wildcard or direct cost reads on protected tables',async()=>{
  async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=new URL(entry.name+(entry.isDirectory()?'/':''),dir);if(entry.isDirectory())await scan(path);else if(/\.(ts|tsx)$/.test(entry.name)){
    const source=await readFile(path,'utf8')
    for(const match of source.matchAll(/\.from\(['"](?:product_variants|components|enclosures)['"]\)\.select\(['"`]([^'"`]+)['"`]/g))assert.ok(!/\*|cost_price/.test(match[1]),`${path.pathname}: unsafe catalogue projection`)
    assert.ok(!/(?:product_variants|components|enclosures)\(\*\)/.test(source),`${path.pathname}: unsafe embedded catalogue projection`)
  }}}
  await scan(new URL('../app/',import.meta.url));await scan(new URL('../components/',import.meta.url))
})

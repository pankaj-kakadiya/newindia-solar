import test from 'node:test'
import assert from 'node:assert/strict'
import {cartAmounts,mergeCart,mergeCartMany,MAX_CART_LINES,readCart} from '../lib/buyer-commerce.ts'
const item=(patch={})=>({id:'v1',kind:'standard',name:'Fixture MCB',variant:'32A',price:100,qty:1,gstRate:18,minQty:1,quantityStep:1,productVariantId:'v1',...patch})

test('repeated additions of the same line merge quantity without decimal drift',()=>{
  let items=[]
  for(let i=0;i<3;i++){const r=mergeCart(items,item({qty:0.1}));assert.equal(r.ok,true);items=r.items}
  assert.equal(items.length,1);assert.equal(items[0].qty,0.3)
})
test('a different id creates a new line instead of merging',()=>{
  const r=mergeCart([item()],item({id:'v2'}))
  assert.equal(r.ok,true);assert.equal(r.items.length,2)
})
test('maxQty rejects a merge that would exceed remaining stock, but allows exactly the ceiling',()=>{
  assert.equal(mergeCart([item({qty:4})],item({qty:2}),5).ok,false)
  assert.equal(mergeCart([item({qty:4})],item({qty:1}),5).ok,true)
})
test('invalid item shape or non-positive price/quantity is rejected before any merge logic',()=>{
  for(const bad of [item({price:0}),item({price:-1}),item({qty:0}),item({qty:NaN}),item({id:''})])assert.equal(mergeCart([],bad).ok,false)
})
test('an aggregate cart limit stops new distinct lines but does not block merging into an existing one',()=>{
  const full=Array.from({length:MAX_CART_LINES},(_,i)=>item({id:`v${i}`}))
  const blocked=mergeCart(full,item({id:'new-line'}))
  assert.equal(blocked.ok,false);assert.match(blocked.error,/maximum number of items/)
  const merged=mergeCart(full,item({id:'v0',qty:1}))
  assert.equal(merged.ok,true);assert.equal(merged.items.length,MAX_CART_LINES)
})
test('mergeCartMany applies a batch atomically: one failing line leaves the cart unchanged',()=>{
  const ok=mergeCartMany([],[{item:item({id:'a'})},{item:item({id:'b'})}])
  assert.equal(ok.ok,true);assert.equal(ok.items.length,2)
  const failing=mergeCartMany([],[{item:item({id:'a'})},{item:item({id:'b',qty:10}),maxQty:1}])
  assert.equal(failing.ok,false)
})
test('cart totals stay exact across several lines and fall back to "unknown" tax only for lines missing GST',()=>{
  const amounts=cartAmounts([item({id:'a',price:100,gstRate:18,qty:1}),item({id:'b',price:50,gstRate:0,qty:2})])
  assert.deepEqual(amounts,{subtotal:200,tax:18,total:218})
  const partial=cartAmounts([item({id:'a',price:100,gstRate:18,qty:1}),item({id:'b',price:50,gstRate:undefined,qty:1})])
  assert.equal(partial.tax,null);assert.equal(partial.total,null);assert.equal(partial.subtotal,150)
})
test('readCart accepts a well-formed line with every optional field',()=>{
  const raw=JSON.stringify([item({productSlug:'fixture',imageUrl:'/a.png',imageAlt:'alt'})])
  assert.equal(readCart(raw).length,1)
})
test('readCart drops a line whose optional numeric fields are the wrong type or out of range',()=>{
  for(const bad of [item({gstRate:'18'}),item({gstRate:-1}),item({gstRate:101}),item({minQty:0}),item({minQty:-1}),item({quantityStep:0}),item({quantityStep:'a'})])
    assert.equal(readCart(JSON.stringify([bad])).length,0)
})
test('readCart drops a line whose optional string fields are the wrong type',()=>{
  for(const key of ['productVariantId','productSlug','imageUrl','imageAlt','templateId'])
    assert.equal(readCart(JSON.stringify([item({[key]:123})])).length,0)
})
test('readCart drops an incomplete custom line rather than letting it reach checkout broken',()=>{
  const custom=(patch={})=>item({kind:'custom',id:'c1',templateId:'t1',selectedValueIds:['a'],...patch})
  assert.equal(readCart(JSON.stringify([custom({templateId:undefined})])).length,0)
  assert.equal(readCart(JSON.stringify([custom({selectedValueIds:undefined})])).length,0)
  assert.equal(readCart(JSON.stringify([custom({selectedValueIds:[]})])).length,0)
  assert.equal(readCart(JSON.stringify([custom()])).length,1)
  assert.equal(readCart(JSON.stringify([custom({selectedValueIds:undefined,visualSelections:[{value_id:'x',quantity:1}]})])).length,1)
})
test('readCart rejects malformed visualSelections entries',()=>{
  const custom=(sel)=>item({kind:'custom',id:'c1',templateId:'t1',visualSelections:sel})
  for(const sel of [[{value_id:'',quantity:1}],[{value_id:'x',quantity:0}],[{value_id:'x',quantity:'1'}],'not-an-array'])
    assert.equal(readCart(JSON.stringify([custom(sel)])).length,0)
})
test('readCart tolerates malformed top-level JSON and caps the accepted line count',()=>{
  assert.deepEqual(readCart(null),[])
  assert.deepEqual(readCart('not json'),[])
  assert.deepEqual(readCart('{"not":"an array"}'),[])
  const many=Array.from({length:MAX_CART_LINES+50},(_,i)=>item({id:`v${i}`}))
  assert.equal(readCart(JSON.stringify(many)).length,MAX_CART_LINES)
})

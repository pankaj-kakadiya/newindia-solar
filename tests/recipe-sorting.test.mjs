import test from 'node:test'
import assert from 'node:assert/strict'
import {sortRecipes,recipeSortOptions} from '../lib/recipe-sorting.ts'

const rows=[{id:'a',variant_id:'va',name:'Box 10',box_type:'dcdb',status:'draft',updated_at:'2026-09-01'}, {id:'b',variant_id:'vb',name:'box 2',box_type:'acdb',status:'active',updated_at:'2026-09-02'}, {id:'c',name:'Box 3',box_type:'combo',status:'archived'}]
const costs={a:{total_cost:'100',current_selling_price:'1000',gross_margin_percent:'-5',buildable_qty:'10',shortage_count:'2'},b:{total_cost:'9',current_selling_price:'20',gross_margin_percent:'20',buildable_qty:'0',shortage_count:'10'}}
const variants=[{id:'va',sku:'SKU-10'},{id:'vb',sku:'SKU-2'}]
const ids=(key,direction='asc')=>sortRecipes(rows,costs,variants,key,direction).map(r=>r.id)
test('natural case-insensitive names and SKUs sort both ways',()=>{
 assert.deepEqual(ids('name'),['b','c','a']);assert.deepEqual(ids('name','desc'),['a','c','b'])
 assert.deepEqual(ids('sku'),['b','a','c']);assert.deepEqual(ids('sku','desc'),['a','b','c'])
})
test('numeric strings sort numerically, with missing data last in both directions',()=>{
 for(const key of ['cost','selling','buildable']){assert.deepEqual(ids(key),['b','a','c']);assert.deepEqual(ids(key,'desc'),['a','b','c'])}
 for(const key of ['margin','shortages']){assert.deepEqual(ids(key),['a','b','c']);assert.deepEqual(ids(key,'desc'),['b','a','c'])}
})
test('type, status and dates have predictable ordering',()=>{
 assert.deepEqual(ids('type'),['b','c','a']);assert.deepEqual(ids('status'),['b','c','a'])
 assert.deepEqual(ids('updated','desc'),['b','a','c'])
})
test('sort preserves source data, filtered membership and stable ties',()=>{
 const original=structuredClone(rows)
 for(const option of recipeSortOptions)ids(option.key)
 assert.deepEqual(rows,original)
 assert.deepEqual(sortRecipes(rows.slice(0,2),{a:{total_cost:0},b:{total_cost:0}},variants,'cost','desc').map(r=>r.id),['a','b'])
 assert.deepEqual(sortRecipes([],costs,variants,'name','asc'),[])
})

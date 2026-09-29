import test from 'node:test'
import assert from 'node:assert/strict'
import {sortProducts,productFirstVariant} from '../lib/product-sorting.ts'
const products=[
 {id:'a',name:'Box 10',slug:'box-10',sort_order:1,status:'draft',brand_id:'x',categories:{name:'DCDB'},product_variants:[{is_active:false,selling_price:1},{is_active:true,sku:'SKU-10',selling_price:'100',cost_price:'50',stock_qty:'9'}]},
 {id:'b',name:'box 2',sort_order:0,status:'active',brand_id:'y',categories:{name:'ACDB'},product_variants:[{is_active:true,sku:'SKU-2',selling_price:'9',cost_price:'10',stock_qty:'100'}]},
 {id:'c',name:'Box 3',sort_order:1,status:'inactive',product_variants:[]},
]
const brands=[{id:'x',name:'Zebra'},{id:'y',name:'Alpha'}]
const ids=(key,direction='asc')=>sortProducts(products,brands,key,direction).map(p=>p.id)
test('names and SKUs use natural ordering',()=>{assert.deepEqual(ids('name'),['b','c','a']);assert.deepEqual(ids('name','desc'),['a','c','b']);assert.deepEqual(ids('sku'),['b','a','c'])})
test('numeric columns match displayed active variant and preserve missing values last',()=>{
 assert.equal(productFirstVariant(products[0]).sku,'SKU-10')
 for(const key of ['selling','cost','margin'])assert.deepEqual(ids(key),['b','a','c'])
 assert.deepEqual(ids('stock','desc'),['b','a','c']);assert.deepEqual(ids('selling','desc'),['a','b','c'])
})
test('category, brand and status sorting',()=>{for(const key of ['category','status'])assert.deepEqual(ids(key),['b','a','c']);assert.deepEqual(ids('brand'),['b','c','a'])})
test('stable catalogue order, no mutation, filtered subset and fallback variant',()=>{
 const before=structuredClone(products)
 assert.deepEqual(ids('catalogue'),['b','a','c']);assert.deepEqual(products,before)
 assert.deepEqual(sortProducts(products.slice(0,2),brands,'name','asc').map(p=>p.id),['b','a'])
 assert.equal(productFirstVariant({product_variants:[{sku:'inactive',is_active:false}]}).sku,'inactive')
 assert.deepEqual(sortProducts([],brands,'name','asc'),[])
})
test('zero prices, negative margins and updated timestamps',()=>{
 const data=[{id:'a',updated_at:'2026-09-01',product_variants:[{selling_price:0,cost_price:0}]},{id:'b',updated_at:'2026-09-02',product_variants:[{selling_price:10,cost_price:20}]}]
 assert.deepEqual(sortProducts(data,[],'margin','asc').map(x=>x.id),['b','a'])
 assert.deepEqual(sortProducts(data,[],'updated','desc').map(x=>x.id),['b','a'])
})

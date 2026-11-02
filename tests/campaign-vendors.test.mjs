import test from 'node:test'
import assert from 'node:assert/strict'
import {installsIn,portalPatch,vendorKey,vendorLinks,vendorsFromPortalExport,vendorsFromSheetRows} from '../lib/campaign-vendors.ts'

const portal={districts:{
 Amreli:[{name:'SATYAM SALES',brand:'',rating:'4.1',reviews:'3411',inst:'2998',kwp:'10234',contact:'SATYAM BOGHARA',email:'kishanagroagencyamreli[at]gmail[dot]com',phone:'9825360183'},
  {name:'Global Solar Energy',rating:'5',reviews:'1974',inst:'1539',kwp:'5298',contact:'SAGAR VAKOTAR',email:'globalsolar99@gmail.com',phone:'+91 88661 90358'}],
 'Gir Somnath':[{name:'GLOBAL SOLAR ENERGY',rating:'5',reviews:'1980',inst:'12',kwp:'5300',contact:'',email:'',phone:''}],
 Bhavnagar:[{name:'Global Solar Energy Pvt Ltd',rating:'',reviews:'',inst:'0',kwp:'0',contact:'x',email:'',phone:''},{name:'ZY ENTERPRISE',inst:'0',contact:'Mohammad',email:'zy[at]gmail[dot]com',phone:'8460313094'}],
}}

test('merges per-district portal lists into one row per vendor',()=>{
 const list=vendorsFromPortalExport(portal)
 assert.equal(list.length,3)
 const g=list.find(v=>vendorKey(v.name)===vendorKey('global solar energy'))
 assert.deepEqual(g.district_installs,{Amreli:1539,'Gir Somnath':12})
 assert.deepEqual(g.registered_districts,['Amreli','Gir Somnath','Bhavnagar'])
 assert.equal(g.portal_rating,5);assert.equal(g.portal_reviews,1980,'most-reviewed rating wins')
 assert.equal(g.phone,'8866190358');assert.equal(g.capacity_kwp,5300)
 const s=list.find(v=>v.name==='SATYAM SALES')
 assert.equal(s.email,'kishanagroagencyamreli@gmail.com')
 const zy=list.find(v=>v.name==='ZY ENTERPRISE')
 assert.deepEqual(zy.district_installs,{});assert.equal(zy.portal_rating,null);assert.equal(zy.email,'zy@gmail.com')
})

test('vendor names match across Pvt Ltd / case differences',()=>{
 assert.equal(vendorKey('Global Solar Energy Pvt. Ltd.'),vendorKey('GLOBAL SOLAR ENERGY'))
 assert.notEqual(vendorKey('Arkay Solar Energy LLP'),vendorKey('Arkay Iconic Private Limited'))
})

test('portal refresh keeps our own fields and fills only blanks',()=>{
 const existing={phone:'9999999999',email:null,status:'shortlisted',our_rating:4,notes:'good',district_installs:{Amreli:10},registered_districts:['Amreli']}
 const [v]=vendorsFromPortalExport({districts:{'Gir Somnath':[{name:'A',inst:'5',rating:'4.5',reviews:'20',phone:'8888888888',email:'a@b.com'}]}})
 const p=portalPatch(existing,v)
 assert.equal(p.phone,undefined,'existing phone kept');assert.equal(p.email,'a@b.com')
 assert.deepEqual(p.district_installs,{Amreli:10,'Gir Somnath':5})
 assert.deepEqual(p.registered_districts,['Amreli','Gir Somnath'])
 assert.equal(p.portal_rating,4.5)
 for(const k of ['status','our_rating','notes'])assert.equal(k in p,false)
})

test('sheet import and helpers',()=>{
 const list=vendorsFromSheetRows([{'Vendor Name':'Sun Power','Mobile Number':'98250 12345','District':'Amreli','Installations':'40','Rating':'4.8','Reviews':'55','Email ID':'s@p.in'},{'Vendor Name':''}])
 assert.equal(list.length,1);assert.equal(list[0].phone,'9825012345');assert.deepEqual(list[0].district_installs,{Amreli:40})
 assert.equal(installsIn({district_installs:{Amreli:40,Bhavnagar:2}},'all'),42)
 assert.equal(installsIn({district_installs:{}},'Amreli'),0)
 assert.match(vendorLinks({name:'Sun Power'}).reviews,/google\.com\/search\?q=Sun%20Power/)
})

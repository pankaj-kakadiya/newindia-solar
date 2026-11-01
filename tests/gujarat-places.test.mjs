import test from 'node:test'
import assert from 'node:assert/strict'
import {CAMPAIGN_GEO,bilingual,canonicalDistrict,canonicalTaluka,findVillage,talukasFor,villagesFromSheetRows} from '../lib/gujarat-places.ts'

test('every campaign district lists its talukas in English and Gujarati',()=>{
 assert.equal(talukasFor('Gir Somnath').length,6)
 assert.equal(talukasFor('Amreli').length,11)
 assert.equal(talukasFor('Bhavnagar').length,10)
 for(const [d,info] of Object.entries(CAMPAIGN_GEO))for(const [en,gu] of info.talukas){assert.match(en,/^[A-Za-z ]+$/,`${d} ${en}`);assert.match(gu,/^[઀-૿ ]+$/,`${d} ${en} Gujarati`)}
 assert.equal(bilingual('Una','ઉના'),'Una (ઉના)')
 assert.equal(bilingual('Una',null),'Una')
})

test('LGD and Census spellings map to the campaign district and taluka names',()=>{
 assert.equal(canonicalDistrict('GIR SOMNATH'),'Gir Somnath')
 assert.equal(canonicalDistrict('Gir-Somnath'),'Gir Somnath')
 assert.equal(canonicalDistrict('ભાવનગર'),'Bhavnagar')
 assert.equal(canonicalDistrict('Surat'),null)
 assert.equal(canonicalTaluka('Amreli','Savar Kundla'),'Savarkundla')
 assert.equal(canonicalTaluka('Amreli','KUNKAVAV VADIA'),'Kunkavav Vadia')
 assert.equal(canonicalTaluka('Gir Somnath','Gir-Gadhada'),'Gir Gadhada')
 assert.equal(canonicalTaluka('Gir Somnath','ઉના'),'Una')
 assert.equal(canonicalTaluka('Bhavnagar','Una'),null)
})

test('villages are found by English or Gujarati name within the taluka',()=>{
 const villages=[{district:'Amreli',taluka:'Khambha',name_en:'Khambha',name_gu:'ખાંભા'},{district:'Amreli',taluka:'Dhari',name_en:'Dalkhaniya',name_gu:'દલખાણીયા'},{district:'Bhavnagar',taluka:'Mahuva',name_en:'Khambha',name_gu:null}]
 assert.equal(findVillage(villages,'Amreli','Khambha','  khambha ')?.name_gu,'ખાંભા')
 assert.equal(findVillage(villages,'Amreli',null,'દલખાણીયા')?.taluka,'Dhari')
 assert.equal(findVillage(villages,'Amreli','Dhari','Khambha'),null)
 assert.equal(findVillage(villages,'Bhavnagar',null,'Khambha')?.taluka,'Mahuva')
})

test('an LGD villages download imports with Gujarati names and skips other districts',()=>{
 const rows=[
  {'S.No.':'1','Village Code':'515470','Village Version':'1','Village Name (In English)':'KHAMBHA','Village Name (In Local)':'ખાંભા','Sub-District Code':'3850','Sub-District Name (In English)':'Khambha','District Name (In English)':'Amreli','Census 2011 Code':'515470'},
  {'Village Code':'515471','Village Name (In English)':'Bhad','Village Name (In Local)':'ભાડ','Sub-District Name (In English)':'Khambha','District Name (In English)':'AMRELI'},
  {'Village Code':'515471','Village Name (In English)':'Bhad','Sub-District Name (In English)':'Khambha','District Name (In English)':'AMRELI'},
  {'Village Code':'600001','Village Name (In English)':'Olpad','Sub-District Name (In English)':'Olpad','District Name (In English)':'Surat'},
  {'Village Code':'600002','Village Name (In English)':'Nowhere','Sub-District Name (In English)':'Unknown taluka','District Name (In English)':'Amreli'},
 ]
 const {villages,skipped}=villagesFromSheetRows(rows)
 assert.equal(villages.length,2);assert.equal(skipped,3)
 assert.deepEqual(villages[0],{district:'Amreli',taluka:'Khambha',name_en:'Khambha',name_gu:'ખાંભા',lgd_code:'515470',census_code:'515470',households:null,population:null})
 assert.equal(villages[1].name_gu,'ભાડ')
})

test('a single-district sheet without a district column uses the chosen district',()=>{
 const {villages}=villagesFromSheetRows([{'Taluka':'Una','Village':'Delvada','Gujarati name':'દેલવાડા','Households':'1,250','Population':'6400'}],'Gir Somnath')
 assert.deepEqual(villages,[{district:'Gir Somnath',taluka:'Una',name_en:'Delvada',name_gu:'દેલવાડા',lgd_code:null,census_code:null,households:1250,population:6400}])
})

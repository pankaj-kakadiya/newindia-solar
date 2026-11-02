import test from 'node:test'
import assert from 'node:assert/strict'
import {parsePortalTable,districtInsights,parseSldcHome,estimateOutputMw,estimateDailyKwh} from '../lib/solar-market.ts'

const DISTRICT_PASTE=`District-wise Data for Gujarat
District\tAPPLICATION (No.)\tINSTALLATION (No.)\tHOUSEHOLD COVERED (No.)\tINSTALLATION CAPACITY (MW)\tSUBSIDY RELEASED(Lakhs)
Ahmedabad\t1,31,428\t1,04,934\t2,48,682\t441.17\t76,266.99
Gir   Somnath\t12,001\t8,500\t9,000\t30.5\t5,100.25
Total\tn/a\t\t\t\t`

test('parses a district table pasted from the PM Surya Ghar portal',()=>{
 const {rows,skipped}=parsePortalTable(DISTRICT_PASTE,'2026-11-09')
 assert.equal(rows.length,2)
 assert.deepEqual(rows[0],{snapshot_date:'2026-11-09',level:'district',state:'Gujarat',name:'Ahmedabad',applications:131428,installations:104934,households:248682,capacity_mw:441.17,subsidy_lakh:76266.99})
 assert.equal(rows[1].name,'Gir Somnath','extra spaces collapse')
 assert.equal(skipped.length,1,'the unreadable total line is reported')
})

test('parses DISCOM tables and subsidy given in crore',()=>{
 const text=`All Discoms Data for Gujarat\nDiscom Name\tApplication\tInstallation\tHousehold\tCapacity (MW)\tSubsidy (Cr)\nPaschim Gujarat Vij Company Ltd.\t3,00,000\t2,00,000\t2,10,000\t800.5\t1,500.25`
 const {rows}=parsePortalTable(text,'2026-11-09')
 assert.equal(rows[0].level,'discom')
 assert.equal(rows[0].subsidy_lakh,150025)
 const csv=parsePortalTable('Name,Applications,Installations,Households,MW,Subsidy\n"Amreli","1,000",600,610,2.5,300','2026-11-09')
 assert.equal(csv.rows[0].applications,1000)
})

test('adds pending applications, conversion and change since the last snapshot',()=>{
 const base={level:'district',state:'Gujarat',name:'Amreli',households:0,subsidy_lakh:0}
 const [d]=districtInsights([{...base,snapshot_date:'2026-11-09',applications:1000,installations:600,capacity_mw:2.5}],[{...base,snapshot_date:'2026-11-02',applications:900,installations:500,capacity_mw:2.1}])
 assert.equal(d.pending,400)
 assert.equal(d.conversion,0.6)
 assert.deepEqual(d.change,{installations:100,capacity_mw:0.4,days:7})
 const [z]=districtInsights([{...base,snapshot_date:'2026-11-09',applications:0,installations:3,capacity_mw:0}])
 assert.equal(z.pending,0);assert.equal(z.conversion,0);assert.equal(z.change,undefined)
})

test('reads demand, frequency and exchange price from the SLDC home page',()=>{
 const html='<div>Grid Frequency : <b>49.98</b> Hz</div><span>Gujarat Catered :&nbsp;18,452 MW</span><p>DAM Rate : 4.12 Rs</p>'
 assert.deepEqual(parseSldcHome(html),{frequency_hz:49.98,demand_mw:18452,dam_rate:4.12})
 assert.deepEqual(parseSldcHome('Grid Frequency : 5.0 Hz Gujarat Catered : 12 MW'),{frequency_hz:null,demand_mw:null,dam_rate:null},'implausible values are dropped')
 assert.deepEqual(parseSldcHome(''),{frequency_hz:null,demand_mw:null,dam_rate:null})
})

test('estimates rooftop output and daily units',()=>{
 assert.equal(estimateOutputMw(1000,800),600)
 assert.equal(estimateOutputMw(1000,-5),0)
 assert.equal(Math.round(estimateDailyKwh(2.18,21.6)*100)/100,9.81)
})

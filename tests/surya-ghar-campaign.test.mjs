import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {calcSuryaGharSubsidy,metricActual,reachedStage,leadsFromSheetRows,normalizeMobile,whatsappLink,SURYA_GHAR_RULES} from '../lib/surya-ghar-campaign.ts'

test('GR 22-10-2026 subsidy figures for the sizes used on the campaign pamphlet',()=>{
 const cases=[
  [1,'general',{benchmark:50000,central:30000,state:15000,householdPays:5000}],
  [1,'sc',{benchmark:50000,central:30000,state:17500,householdPays:2500}],
  [2,'general',{benchmark:100000,central:60000,state:30000,householdPays:10000}],
  [2,'st',{benchmark:100000,central:60000,state:35000,householdPays:5000}],
  [2.18,'general',{benchmark:108100,central:63240,state:34050,householdPays:10810}],
  [2.18,'sc',{benchmark:108100,central:63240,state:39455,householdPays:5405}],
 ]
 for(const [kw,cat,want] of cases){const got=calcSuryaGharSubsidy(kw,cat);for(const k of Object.keys(want))assert.equal(got[k],want[k],`${kw} kW ${cat} ${k}`);assert.equal(got.stateEligible,true)}
})

test('systems above 2.18 kW get no state top-up and the central subsidy caps at 78,000',()=>{
 const over=calcSuryaGharSubsidy(2.2,'general')
 assert.equal(over.stateEligible,false);assert.equal(over.state,0);assert.equal(over.householdPays,over.benchmark-over.central)
 const big=calcSuryaGharSubsidy(5,'sc')
 assert.equal(big.central,SURYA_GHAR_RULES.centralCap);assert.equal(big.state,0)
 assert.equal(calcSuryaGharSubsidy(0).governmentTotal,0)
 assert.equal(calcSuryaGharSubsidy('abc').benchmark,0)
})

test('funnel stages count forward and lost leads never count',()=>{
 assert.equal(reachedStage('commissioned','survey_done'),true)
 assert.equal(reachedStage('registered','survey_done'),false)
 assert.equal(reachedStage('lost','lead'),false)
 const leads=[{stage:'lead',district:'Amreli'},{stage:'registered',district:'Amreli'},{stage:'survey_done',district:'Bhavnagar'},{stage:'commissioned',district:'Amreli'},{stage:'subsidy_received',district:'Gir Somnath'},{stage:'lost',district:'Amreli',portal_registered:false},{stage:'lead',district:'Amreli',portal_registered:true}]
 const camps=[{status:'completed',district:'Amreli'},{status:'planned',district:'Amreli'},{status:'completed',district:'Bhavnagar'}]
 assert.equal(metricActual('leads',leads,camps),7)
 assert.equal(metricActual('registrations',leads,camps),5)
 assert.equal(metricActual('surveys',leads,camps),3)
 assert.equal(metricActual('commissioned',leads,camps),2)
 assert.equal(metricActual('subsidy_received',leads,camps),1)
 assert.equal(metricActual('camps_held',leads,camps),2)
 assert.equal(metricActual('camps_held',leads,camps,'Amreli'),1)
 assert.equal(metricActual('registrations',leads,camps,'Amreli'),3)
})

test('mobile numbers normalise to 10 digits and build WhatsApp links',()=>{
 assert.equal(normalizeMobile('+91 98250 12345'),'9825012345')
 assert.equal(normalizeMobile('09825012345'),'9825012345')
 assert.equal(normalizeMobile('12345'),null)
 assert.equal(normalizeMobile('9XXXXXXXXX'),null)
 assert.match(whatsappLink('9825012345','નમસ્તે'),/^https:\/\/wa\.me\/919825012345\?text=%E0/)
 assert.equal(whatsappLink('',''),null)
})

test('rows from the Excel lead tracker import cleanly and skip the example row',()=>{
 const {leads,skipped}=leadsFromSheetRows([
  {'Date':'2026-11-08','Camp ID':'C01','Village':'[Village]','District':'Amreli','Name':'[Example household]','Mobile':'9XXXXXXXXX','Notes':'Example row – replace with real data'},
  {'Camp ID':'C02','Village':'Khambha','Taluka':'Khambha','District':'amreli','Name':'Ramesh Patel','Mobile':'+91 98250 12345','PGVCL consumer no.':' 12345678 ','Category':'SC','Avg units / month':'220','Suggested size (kW)':'2.18','Registered on portal':'Yes','Loan needed':'No','Survey date':'2026-11-12','Stage':'Registered'},
  {'Name':'Meena Ben','Mobile':'123','District':'Surat','Stage':'Inspected / net meter','Suggested size (kW)':'12'},
  {'Name':'  ','Mobile':'9825012345'},
 ])
 assert.equal(skipped,2);assert.equal(leads.length,2)
 const [a,b]=leads
 assert.deepEqual({name:a.full_name,mobile:a.mobile,district:a.district,consumer:a.consumer_number,cat:a.category,units:a.avg_monthly_units,kw:a.system_kw,reg:a.portal_registered,loan:a.loan_needed,survey:a.survey_date,stage:a.stage,camp:a.camp_code},
  {name:'Ramesh Patel',mobile:'9825012345',district:'Amreli',consumer:'12345678',cat:'sc',units:220,kw:2.18,reg:true,loan:false,survey:'2026-11-12',stage:'registered',camp:'C02'})
 assert.equal(b.mobile,null);assert.equal(b.district,'Other');assert.equal(b.stage,'commissioned');assert.equal(b.system_kw,null);assert.equal(b.portal_registered,true)
})

test('admin navigation and route guard know the campaign module',async()=>{
 const shell=await readFile(new URL('../components/admin/AdminShell.tsx',import.meta.url),'utf8')
 const access=await readFile(new URL('../lib/adminAccess.ts',import.meta.url),'utf8')
 assert.match(shell,/href: "\/admin\/campaigns"[\s\S]*?module: "campaigns"/)
 assert.match(access,/'\/admin\/campaigns':'campaigns'/)
})

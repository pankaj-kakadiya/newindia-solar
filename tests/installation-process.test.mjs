import test from 'node:test'
import assert from 'node:assert/strict'
import {INSTALL_STEPS,PROCESS_STAGE_ORDER,processProgress,setStepDone,stageFromProcess,stepDone} from '../lib/installation-process.ts'
import {CAMPAIGN_STAGES} from '../lib/surya-ghar-campaign.ts'

test('nine steps with unique keys and valid stages',()=>{
 assert.equal(INSTALL_STEPS.length,9)
 assert.deepEqual(INSTALL_STEPS.map(s=>s.n),[1,2,3,4,5,6,7,8,9])
 assert.equal(new Set(INSTALL_STEPS.map(s=>s.key)).size,9)
 const stages=CAMPAIGN_STAGES.map(s=>s.key)
 assert.deepEqual([...PROCESS_STAGE_ORDER],stages.filter(s=>s!=='lost'),'stage order matches the campaign stages')
 for(const s of INSTALL_STEPS){assert.ok(stages.includes(s.stage),s.key);assert.ok(stages.includes(s.impliedBy),s.key);assert.ok(s.checklist.length>=3,s.key)}
})

test('existing leads show steps implied by their stage',()=>{
 assert.deepEqual(processProgress({stage:'lead'}),{done:0,current:1})
 assert.deepEqual(processProgress({stage:'registered'}),{done:2,current:3})
 assert.deepEqual(processProgress({stage:'installed'}),{done:6,current:7})
 assert.deepEqual(processProgress({stage:'subsidy_received'}),{done:9,current:10})
})

test('marking steps done moves the stage and fills dates',()=>{
 let lead={stage:'lead',process:{},survey_date:null}
 lead={...lead,...setStepDone(lead,'eligibility','2026-11-02')}
 assert.equal(lead.stage,'lead')
 lead={...lead,...setStepDone(lead,'registration','2026-11-03')}
 assert.equal(lead.stage,'registered');assert.equal(lead.portal_registered,true)
 for(const k of ['application','feasibility'])lead={...lead,...setStepDone(lead,k,'2026-11-05')}
 assert.equal(lead.stage,'feasibility_approved')
 lead={...lead,...setStepDone(lead,'survey','2026-11-08')}
 assert.equal(lead.stage,'survey_done');assert.equal(lead.survey_date,'2026-11-08')
 assert.deepEqual(processProgress(lead),{done:5,current:6})
 // un-marking the survey goes back a stage
 lead={...lead,...setStepDone(lead,'survey',null)}
 assert.equal(lead.stage,'feasibility_approved');assert.equal(stepDone(lead,INSTALL_STEPS[4]),false)
})

test('changing one step keeps steps implied by the stage, and lost leads stay lost',()=>{
 const installed={stage:'installed',process:{},install_date:'2026-11-20'}
 const p=setStepDone(installed,'net_meter','2026-11-21')
 assert.equal(stageFromProcess({...installed,...p}),'installed')
 assert.deepEqual(processProgress({...installed,...p}),{done:7,current:8})
 assert.equal(p.process.installation.done_at,'2026-11-20','implied step keeps the lead date')
 const lost=setStepDone({stage:'lost',process:{}},'eligibility','2026-11-02')
 assert.equal(lost.stage,undefined)
 const sub=setStepDone({stage:'commissioned',process:{subsidy:{checks:{central:true}}}},'subsidy','2026-12-20')
 assert.equal(sub.stage,'subsidy_received');assert.equal(sub.central_subsidy_received,true);assert.equal(sub.state_subsidy_received,undefined)
})

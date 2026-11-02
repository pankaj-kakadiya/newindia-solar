import test from 'node:test'
import assert from 'node:assert/strict'
import {idleState,sessionEndMessage} from '../lib/adminSession.ts'

test('idle timer warns in the final minute and expires at the timeout',()=>{
 const t0=1_000_000
 assert.deepEqual(idleState(t0,t0+28*60_000,30),{expired:false,warnSeconds:null})
 assert.deepEqual(idleState(t0,t0+29*60_000+30_000,30),{expired:false,warnSeconds:30})
 assert.deepEqual(idleState(t0,t0+30*60_000,30),{expired:true,warnSeconds:null})
})

test('every way a session can end has a message',()=>{
 for(const r of ['idle','replaced','ended','expired','revoked','logout','missing'])assert.ok(sessionEndMessage(r).length>10,r)
 assert.equal(sessionEndMessage('ok'),'')
 assert.match(sessionEndMessage('idle-soon',42),/42 seconds/)
})

test('activity helpers: online state, device names and per-person summary',async()=>{
 const {sessionState,deviceLabel,activitySummary}=await import('../lib/adminActivity.ts')
 const now=Date.parse('2026-11-03T10:00:00Z'),ago=m=>new Date(now-m*60_000).toISOString()
 assert.equal(sessionState({last_seen_at:ago(0.5),last_active_at:ago(1)},now),'online')
 assert.equal(sessionState({last_seen_at:ago(0.5),last_active_at:ago(10)},now),'idle')
 assert.equal(sessionState({last_seen_at:ago(30),last_active_at:ago(30)},now),'stale')
 assert.equal(sessionState({ended_at:ago(1)},now),'ended')
 assert.equal(sessionState(null,now),'never')
 assert.equal(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'),'Chrome on Mac')
 assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'),'Safari on iPhone')
 const s=activitySummary([{user_id:'a',event:'login',created_at:ago(50)},{user_id:'a',event:'page_view',created_at:ago(40)},{user_id:'a',event:'update',created_at:ago(30)},{user_id:'b',event:'page_view',created_at:ago(5)}])
 assert.deepEqual(s.map(x=>[x.user_id,x.logins,x.pages,x.changes]),[['b',0,1,0],['a',1,1,1]])
})

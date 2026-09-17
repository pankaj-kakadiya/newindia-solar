import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
import * as security from '../lib/payment-security.ts'

const env={RAZORPAY_KEY_ID:'rzp_test_example',RAZORPAY_KEY_SECRET:'test-secret',RAZORPAY_WEBHOOK_SECRET:'webhook-test',SUPABASE_SERVICE_ROLE_KEY:'fixture-only'}
test('payment readiness fails closed for disabled, incomplete and mismatched configurations',()=>{
 assert.equal(security.paymentReady({is_enabled:true,environment:'sandbox'},env),true)
 for(const key of Object.keys(env))assert.equal(security.paymentReady({is_enabled:true,environment:'sandbox'},{...env,[key]:''}),false)
 for(const config of [null,{is_enabled:false,environment:'sandbox'},{is_enabled:true,environment:'live'},{is_enabled:true,environment:'unknown'}])assert.equal(security.paymentReady(config,env),false)
 assert.equal(security.paymentReady({is_enabled:true,environment:'live'},{...env,RAZORPAY_KEY_ID:'rzp_live_example'}),true)
})
test('HMAC comparison rejects malformed suffixes, truncation and nonhex',()=>{
 const signature=createHmac('sha256','test').update('payload').digest('hex')
 assert.equal(security.secureEqualHex(signature,signature),true)
 assert.equal(security.secureEqualHex(signature.toUpperCase(),signature),true)
 for(const bad of [signature+'junk',signature+'00',signature.slice(0,-1),'z'.repeat(64),'', '0'.repeat(64)])assert.equal(security.secureEqualHex(bad,signature),false)
})
test('payment amounts reject nonfinite, empty, negative, zero and unsafe values',()=>{
 assert.equal(security.paymentPaise('123.45'),12345)
 for(const value of [null,undefined,true,[],{},'', ' ', 'NaN',Infinity,-1,0,0.001,Number.MAX_SAFE_INTEGER])assert.equal(security.paymentPaise(value),null)
})
test('provider payment must match identity, currency and exact integer paise',()=>{
 const entity={id:'pay_one',order_id:'order_one',currency:'INR',amount:12345}
 assert.equal(security.matchesPayment(entity,'order_one','pay_one',12345),true)
 for(const patch of [{id:'pay_other'},{order_id:'order_other'},{currency:'USD'},{amount:'12345'},{amount:12344},{amount:NaN}])assert.equal(security.matchesPayment({...entity,...patch},'order_one','pay_one',12345),false)
 assert.equal(security.matchesPayment(entity,'order_one','pay_one',null),false)
})

// Execute the actual route with in-memory database responses: no provider or production calls.
const nativeRequire=createRequire(import.meta.url)
function loadWebhook(db){
 const source=readFileSync(new URL('../app/api/webhooks/[provider]/route.ts',import.meta.url),'utf8')
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const module={exports:{}}
 const require=id=>id==='next/server'?{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}}:id==='@supabase/supabase-js'?{createClient:()=>db}:id.includes('payment-security')?security:nativeRequire(id)
 new Function('require','module','exports','process',code)(require,module,module.exports,{env:{...env,NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid'}})
 return module.exports.POST
}
function database(resolver){
 const calls=[]
 return {calls,from(table){let operation='select',values,filters=[],throwErrors=false;const query={
 select(){return query},insert(v){operation='insert';values=v;return query},update(v){operation='update';values=v;return query},eq(k,v){filters.push([k,v]);return query},in(k,v){filters.push([k,v]);return query},neq(k,v){filters.push([k,v]);return query},single(){return query},maybeSingle(){return query},throwOnError(){throwErrors=true;return query},then(resolve,reject){const call={table,operation,values,filters};calls.push(call);return Promise.resolve().then(()=>resolver(call)).then(result=>{if(throwErrors&&result.error)throw Error(result.error.message);return result}).then(resolve,reject)}
 };return query}}
}
const ok=data=>({data,error:null})
const duplicate={data:null,error:{code:'23505'}}
function request(event='payment.captured',patch={},signatureSuffix=''){
 const body=JSON.stringify({event,payload:{payment:{entity:{id:'pay_one',order_id:'order_one',currency:'INR',amount:10000,status:event==='payment.captured'?'captured':'authorized',...patch}}}})
 return {text:async()=>body,headers:new Headers({'x-razorpay-signature':createHmac('sha256',env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex')+signatureSuffix,'x-razorpay-event-id':'delivery-one'})}
}
const params={params:Promise.resolve({provider:'razorpay'})}
test('invalid signatures cannot insert or poison webhook receipts',async()=>{
 const db=database(()=>{throw Error('Database must not be accessed')})
 const response=await loadWebhook(db)(request('payment.captured',{},'junk'),params)
 assert.equal(response.status,401);assert.equal(db.calls.length,0)
})
test('processed matching webhook is acknowledged without processing twice',async()=>{
 const req=request(),hash=nativeRequire('node:crypto').createHash('sha256').update(await req.text()).digest('hex')
 const db=database(c=>c.operation==='insert'?duplicate:ok({id:'receipt',processing_status:'processed',signature_valid:true,payload_hash:hash}))
 const response=await loadWebhook(db)(req,params)
 assert.equal(response.body.duplicate,true);assert.equal(db.calls.length,2)
})
test('failed delivery is retried and missing payment returns retryable 503',async()=>{
 const db=database(c=>c.table==='integration_webhook_events'&&c.operation==='insert'?duplicate:c.table==='integration_webhook_events'&&c.operation==='select'?ok({id:'receipt',processing_status:'failed',signature_valid:false}):ok(null))
 const response=await loadWebhook(db)(request(),params)
 assert.equal(response.status,503)
 assert.ok(db.calls.some(c=>c.table==='payments'&&c.operation==='select'))
 assert.ok(db.calls.some(c=>c.values?.processing_status==='failed'))
})
for(const patch of [{currency:'USD'},{amount:9999},{status:'authorized'}])test(`webhook rejects mismatched provider details ${JSON.stringify(patch)}`,async()=>{
 const db=database(c=>ok(c.table==='payments'?{id:'payment',order_id:'order',amount:100}: {id:'receipt'}))
 assert.equal((await loadWebhook(db)(request('payment.captured',patch),params)).status,503)
 assert.equal(db.calls.filter(c=>c.table==='payments'&&c.operation==='update').length,0)
})
test('late authorized event update excludes already paid and refunded records',async()=>{
 const db=database(c=>ok(c.table==='payments'?{id:'payment',order_id:'order',amount:100}:{id:'receipt'}))
 assert.equal((await loadWebhook(db)(request('payment.authorized'),params)).status,200)
 const update=db.calls.find(c=>c.table==='payments'&&c.operation==='update')
 assert.deepEqual(update.filters.find(([key])=>key==='status')[1],['pending','failed'])
})
test('database payment-write failure returns 503 and does not mark webhook processed',async()=>{
 const db=database(c=>c.table==='payments'&&c.operation==='update'?{data:null,error:{message:'Write failed'}}:ok(c.table==='payments'?{id:'payment',order_id:'order',amount:100}:{id:'receipt'}))
 assert.equal((await loadWebhook(db)(request(),params)).status,503)
 assert.equal(db.calls.some(c=>c.values?.processing_status==='processed'),false)
})

function loadPaymentRoute(name,db,fetch){
 const source=readFileSync(new URL(`../app/api/payments/razorpay/${name}/route.ts`,import.meta.url),'utf8')
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const module={exports:{}}
 const require=id=>id==='next/server'?{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}}:id==='@supabase/supabase-js'?{createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'buyer'}}})}})}:id.includes('payment-security')?security:id.includes('transactionRuntime')?{serviceClient:()=>db}:nativeRequire(id)
 new Function('require','module','exports','process','fetch',code)(require,module,module.exports,{env:{...env,NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture'}},fetch)
 return module.exports.POST
}
const buyerRequest=body=>({headers:new Headers({authorization:'Bearer fixture'}),json:async()=>body})
const checkoutRequest=()=>buyerRequest({order_number:'NIS-TEST'})
const verifyRequest=()=>buyerRequest({razorpay_order_id:'order_one',razorpay_payment_id:'pay_one',razorpay_signature:createHmac('sha256',env.RAZORPAY_KEY_SECRET).update('order_one|pay_one').digest('hex')})
function paymentDb(patch={},writeError=false){return database(c=>{
 if(c.operation==='update')return writeError?{data:null,error:{message:'Database unavailable'}}:ok(null)
 if(c.table==='integration_settings')return ok({is_enabled:true,environment:'sandbox',public_config:{capture_mode:'manual'}})
 if(c.table==='orders')return ok({id:'order',user_id:'buyer',order_number:'NIS-TEST',grand_total:100,status:'pending',payment_status:'pending',...patch})
 if(c.table==='payments')return ok(c.filters.some(([key])=>key==='provider_order_id')?{id:'payment',order_id:'order',amount:100,status:'pending'}:null)
 return ok(null)
})}
for(const patch of [{status:'cancelled'},{status:'refunded'},{payment_status:'paid'},{payment_status:'partially_paid'},{grand_total:'NaN'}])test(`create refuses ineligible order before contacting provider ${JSON.stringify(patch)}`,async()=>{
 const response=await loadPaymentRoute('create',paymentDb(patch),()=>{throw Error('Provider must not be contacted')})(checkoutRequest())
 assert.ok([400,409].includes(response.status))
})
test('provider network failure produces retryable JSON response',async()=>{
 const response=await loadPaymentRoute('create',paymentDb(),()=>{throw Error('Timeout')})(checkoutRequest())
 assert.equal(response.status,503)
})
test('verification rejects foreign-currency payment before any write',async()=>{
 const db=paymentDb()
 const response=await loadPaymentRoute('verify',db,async()=>({ok:true,json:async()=>({id:'pay_one',order_id:'order_one',currency:'USD',amount:10000,status:'captured'})}))(verifyRequest())
 assert.equal(response.status,409);assert.equal(db.calls.some(c=>c.operation==='update'),false)
})
test('verification never reports success after payment persistence fails',async()=>{
 const response=await loadPaymentRoute('verify',paymentDb({},true),async()=>({ok:true,json:async()=>({id:'pay_one',order_id:'order_one',currency:'INR',amount:10000,status:'captured'})}))(verifyRequest())
 assert.equal(response.status,503);assert.equal(response.body.verified,undefined)
})

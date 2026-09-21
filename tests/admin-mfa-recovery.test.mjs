import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import {validateTemporaryPassword,validateManualTeamUser} from '../lib/teamUser.ts'
const require=createRequire(import.meta.url),ts=require('typescript')
const source=await readFile(new URL('../app/api/admin/team-users/route.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
class Response{
 constructor(body,status=200){this.body=body;this.status=status}
 static json(body,options={}){return new Response(body,options.status||200)}
}
function harness(options={}){
 const calls=[],targetId='00000000-0000-4000-8000-000000000001'
 const profile={role:options.targetRole||'staff',staff_status:'active'}
 const admin={
  from(table){
   if(table==='admin_audit_logs')return {async insert(row){calls.push(['audit',row]);return {error:options.auditError?Error('audit unavailable'):null}}}
   assert.equal(table,'profiles')
   return {
    select:()=>({eq:()=>({maybeSingle:async()=>({data:profile,error:null})})}),
    update:values=>({eq:async()=>{calls.push(['flags',values]);return {error:options.flagError?Error('flags unavailable'):null}}})
   }
  },
  auth:{admin:{
   getUserById:async()=>({data:{user:{id:targetId}},error:null}),
   updateUserById:async(id,input)=>{assert.equal(id,targetId);calls.push(['password']);assert.equal(input.password,'NewTemporary#2026');return {error:null}},
   mfa:{
    listFactors:async()=>{calls.push(['list']);return {data:{factors:[{id:'primary'},{id:'backup'}]},error:null}},
    deleteFactor:async input=>{calls.push(['delete',input.id]);return {error:options.deleteError?Error('delete failed'):null}}
   }
  }}
 }
 const modules={
  'server-only':{},
  '@supabase/supabase-js':{createClient:()=>admin},
  'next/server':{NextResponse:Response},
  '../../../../lib/serverAdminAuth':{requireServerAdminPermission:async()=>({access:{role:options.actorRole||'admin',aal:options.aal||'aal2',user_id:'owner'}})},
  '../../../../lib/teamUser':{validateTemporaryPassword,validateManualTeamUser}
 }
 const mod={exports:{}}
 vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:name=>{assert.ok(modules[name],name);return modules[name]},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key'}}})
 return {calls,run:body=>mod.exports.PATCH({json:async()=>({action:'reset_mfa',user_id:targetId,temporary_password:'NewTemporary#2026',identity_confirmed:true,reason:'Employee identity verified in person',...body})})}
}
test('staff recovery requires an owner with verified MFA',async()=>{
 for(const options of [{actorRole:'staff'},{aal:'aal1'}]){
  const h=harness(options),response=await h.run()
  assert.equal(response.status,403);assert.equal(h.calls.length,0)
 }
})
test('owner and customer accounts cannot be reset through staff recovery',async()=>{
 for(const targetRole of ['admin','customer']){
  const h=harness({targetRole}),response=await h.run()
  assert.equal(response.status,403);assert.equal(h.calls.length,0)
 }
})
test('identity confirmation and strong new credentials are required before recovery',async()=>{
 for(const input of [{identity_confirmed:false},{reason:'short'},{temporary_password:'weak'}]){
  const h=harness(),response=await h.run(input)
  assert.equal(response.status,400);assert.equal(h.calls.length,0)
 }
})
test('audited recovery sets required enrollment before deleting authenticators',async()=>{
 const h=harness(),response=await h.run()
 assert.equal(response.status,200)
 assert.deepEqual(h.calls.map(c=>c[0]),['audit','password','flags','list','delete','delete'])
 assert.equal(h.calls[2][1].mfa_required,true);assert.equal(h.calls[2][1].must_change_password,true)
 assert.ok(!JSON.stringify(h.calls[0]).includes('NewTemporary#2026'))
 assert.ok(!JSON.stringify(response.body).includes('NewTemporary#2026'))
})
test('failed audit cannot change credentials',async()=>{
 const h=harness({auditError:true}),response=await h.run()
 assert.equal(response.status,503);assert.deepEqual(h.calls.map(c=>c[0]),['audit'])
})
test('failed policy write cannot remove a verified authenticator',async()=>{
 const h=harness({flagError:true}),response=await h.run()
 assert.equal(response.status,500);assert.ok(!h.calls.some(c=>c[0]==='delete'))
})
test('partial deletion reports failure while mandatory enrollment remains set',async()=>{
 const h=harness({deleteError:true}),response=await h.run()
 assert.equal(response.status,503);assert.equal(h.calls.find(c=>c[0]==='flags')[1].mfa_required,true)
 assert.equal(h.calls.filter(c=>c[0]==='delete').length,1)
})

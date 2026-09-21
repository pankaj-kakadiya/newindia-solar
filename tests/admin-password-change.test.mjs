import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import {validateTemporaryPassword} from '../lib/teamUser.ts'

const require=createRequire(import.meta.url)
const ts=require('typescript')
const page=await readFile(new URL('../app/admin/change-password/page.tsx',import.meta.url),'utf8')
const compiled=ts.transpileModule(page,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX
}}).outputText

// Render the real page with isolated hooks and Auth responses. No test contacts
// Supabase or changes a real account. React clears currentTarget after dispatch;
// explicitly simulate that below so an async form-reset regression is caught.
function harness(options={}){
 const calls=[],state=[],timers=[]
 const values={current:'Temporary#Solar2026',next:'Private#Solar2026',confirm:'Private#Solar2026',...options.values}
 const expectedCurrent=values.current
 const form={values,reset(){calls.push('reset');for(const key of Object.keys(values))values[key]=''}}
 let passwordUpdated=false,mustChangePassword=true
 const supabase={auth:{
  async getUser(){calls.push('getUser');return {data:{user:options.expired?null:{email:'finance@example.invalid'}}}},
  async signInWithPassword(input){
   assert.fail('Password updates must not replace an AAL2 session with a new password-only sign-in')
  },
  async updateUser(input){
   calls.push('updateUser')
   if(options.signInError)return {error:{message:'Current password is incorrect.'}}
   if(options.updateError)return {error:{message:options.updateError}}
   if(options.requireCurrent!==false&&input.current_password!==expectedCurrent){
    return {error:{message:'Current password required when setting new password.'}}
   }
   assert.equal(input.password,values.next)
   passwordUpdated=true
   return {error:null}
  },
  async signOut(input){calls.push('signOut');assert.equal(input.scope,'others');return {error:null}}
 },async rpc(name){
  calls.push(name)
  assert.equal(name,'complete_initial_password_change')
  assert.equal(passwordUpdated,true,'Never clear first-login restriction before saving the password')
  if(options.completeError)return {error:{message:options.completeError}}
  mustChangePassword=false
  return {error:null}
 }}
 const modules={
  react:{useState(initial){const index=state.length;state.push(initial);return [initial,value=>{state[index]=value}]}},
  'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
  'next/navigation':{
   useRouter:()=>({replace(path){calls.push(`redirect:${path}`)}}),
   useSearchParams:()=>new URLSearchParams(options.required===false?'':'required=1')
  },
  '../../../lib/supabase':{supabase},
  '../../../lib/teamUser':{validateTemporaryPassword}
 }
 const module={exports:{}}
 vm.runInNewContext(compiled,{
  module,exports:module.exports,
  require(name){assert.ok(Object.hasOwn(modules,name),`Unexpected dependency: ${name}`);return modules[name]},
  FormData:class {constructor(element){assert.equal(element,form);this.values={...element.values}}get(name){return this.values[name]??null}},
  setTimeout(callback,delay){timers.push({callback,delay})}
 },{filename:'app/admin/change-password/page.tsx'})
 function findForm(node){
  if(!node||typeof node!=='object')return null
  if(node.type==='form')return node
  const children=node.props?.children
  for(const child of Array.isArray(children)?children:[children]){const found=findForm(child);if(found)return found}
  return null
 }
 const renderedForm=findForm(module.exports.default())
 assert.ok(renderedForm?.props.onSubmit,'The password form must expose its submit handler')
 return {
  calls,state,timers,
  get passwordUpdated(){return passwordUpdated},
  get mustChangePassword(){return mustChangePassword},
  async submit(){
   const event={preventDefault(){},currentTarget:form}
   const pending=renderedForm.props.onSubmit(event)
   event.currentTarget=null
   await pending
  }
 }
}

test('first login includes current password and completes before redirecting',async()=>{
 const h=harness()
 await h.submit()
 assert.equal(h.passwordUpdated,true)
 assert.equal(h.mustChangePassword,false)
 assert.equal(h.state[0],false)
 assert.equal(h.state[2],true)
 assert.deepEqual(h.calls,['getUser','updateUser','complete_initial_password_change','signOut','reset'])
 assert.equal(h.timers.length,1)
 h.timers[0].callback()
 assert.equal(h.calls.at(-1),'redirect:/admin')
})

test('successful save resets the captured form after React clears currentTarget',async()=>{
 const h=harness({requireCurrent:false})
 await assert.doesNotReject(()=>h.submit())
 assert.ok(h.calls.includes('reset'))
 assert.equal(h.timers.length,1)
 h.timers[0].callback()
 assert.equal(h.calls.at(-1),'redirect:/admin')
})

test('normal password change preserves the current session and stays on the page',async()=>{
 const h=harness({required:false})
 await h.submit()
 assert.equal(h.passwordUpdated,true)
 assert.equal(h.state[2],true)
 assert.ok(h.calls.includes('reset'))
 assert.equal(h.timers.length,0)
})

test('incorrect temporary password cannot save or unlock the account',async()=>{
 const h=harness({signInError:true})
 await h.submit()
 assert.deepEqual(h.calls,['getUser','updateUser'])
 assert.equal(h.state[1],'Current password is incorrect.')
 assert.equal(h.mustChangePassword,true)
 assert.equal(h.state[0],false)
 assert.equal(h.timers.length,0)
})

test('expired session cannot save or unlock the account',async()=>{
 const h=harness({expired:true})
 await h.submit()
 assert.deepEqual(h.calls,['getUser'])
 assert.equal(h.state[1],'Session expired. Sign in again.')
 assert.equal(h.mustChangePassword,true)
 assert.equal(h.timers.length,0)
})

test('password validation rejects weak or mismatched values before authentication',async()=>{
 for(const values of [{next:'weak',confirm:'weak'},{confirm:'Different#Solar2026'}]){
  const h=harness({values})
  await h.submit()
  assert.deepEqual(h.calls,[])
  assert.equal(h.state[0],false)
  assert.equal(h.state[2],false)
  assert.ok(h.state[1])
  assert.equal(h.mustChangePassword,true)
 }
})

test('failed password update cannot clear first-login restriction or redirect',async()=>{
 const h=harness({updateError:'New password should be different from the old password.'})
 await h.submit()
 assert.deepEqual(h.calls,['getUser','updateUser'])
 assert.equal(h.passwordUpdated,false)
 assert.equal(h.mustChangePassword,true)
 assert.equal(h.state[2],false)
 assert.equal(h.timers.length,0)
})

test('failed first-login completion cannot report success or redirect',async()=>{
 const h=harness({completeError:'Account update failed.'})
 await h.submit()
 assert.deepEqual(h.calls,['getUser','updateUser','complete_initial_password_change'])
 assert.equal(h.passwordUpdated,true)
 assert.equal(h.mustChangePassword,true)
 assert.equal(h.state[1],'Account update failed.')
 assert.equal(h.state[2],false)
 assert.equal(h.timers.length,0)
})

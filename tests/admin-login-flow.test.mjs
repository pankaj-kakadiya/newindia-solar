import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import {adminLoginStep,readMfaState,safeAdminReturnTo,adminSecurityRedirect} from '../lib/mfa.ts'
const require=createRequire(import.meta.url),ts=require('typescript')
const compile=async path=>ts.transpileModule(await readFile(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
const compiled=await compile('components/auth/AdminLogin.tsx')
const factor={id:'verified-factor',status:'verified',factor_type:'totp'}
function all(node){
 if(!node||typeof node!=='object')return []
 if(Array.isArray(node))return node.flatMap(all)
 return [node,...all(node.props?.children)]
}
async function harness(options={}){
 const calls=[],values=[],effects=[],ref={current:0}
 let cursor=0,first=true,tree,user=options.signedIn?{id:'staff',email:'staff@example.invalid'}:null
 let level=options.level||'aal1',factors=options.factors??[factor]
 const profile={role:options.role||'staff',staff_status:options.status||'active',must_change_password:options.mustChange||false,mfa_required:options.required||false}
 const components={MfaChallenge:()=>null,AdminPasswordForm:()=>null,AccountSecurityPanel:()=>null}
 const supabase={auth:{
  getUser:async()=>({data:{user}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  async signInWithPassword(){calls.push('password-signin');if(options.badPassword)return {error:Error('Invalid credentials')};user={id:'staff',email:'staff@example.invalid'};level='aal1';return {error:null}},
  async signOut(){calls.push('signout');user=null;return {error:null}},
  mfa:{
   listFactors:async()=>({data:{all:factors},error:null}),
   getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level,nextLevel:factors.some(f=>f.status==='verified')?'aal2':'aal1'},error:options.assuranceError?Error('Could not check MFA'):null})
  }
 },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:profile,error:null})})})}),
 async rpc(name){calls.push(name);return {data:{role:profile.role,session_ready:options.sessionReady!==false},error:null}}}
 const modules={
  react:{useState(initial){const i=cursor++;if(first)values[i]=initial;return [values[i],value=>{values[i]=typeof value==='function'?value(values[i]):value}]},useRef:()=>ref,useEffect:fn=>{if(first)effects.push(fn)}},
  'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
  'next/image':{__esModule:true,default:'img'},'next/link':{__esModule:true,default:'a'},
  'next/navigation':{useRouter:()=>({replace:path=>calls.push('redirect:'+path),refresh(){}}),useSearchParams:()=>new URLSearchParams({next:options.next||'/admin'})},
  'lucide-react':{},
  '../../lib/supabase':{supabase},
  '../../lib/mfa':{adminLoginStep,readMfaState,safeAdminReturnTo},
  ...Object.fromEntries(Object.entries(components).map(([name,component])=>['./'+name,{__esModule:true,default:component}]))
 }
 const mod={exports:{}}
 vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:name=>{assert.ok(modules[name],name);return modules[name]},FormData:class{get(name){return name==='email'?'staff@example.invalid':'Temporary#2026'}}})
 function render(){cursor=0;tree=mod.exports.default();first=false;return tree}
 render();for(const effect of effects)effect();await new Promise(resolve=>setImmediate(resolve));render()
 return {calls,values,components,profile,render,
  find:type=>all(tree).find(n=>n.type===type),
  async signin(){await all(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}});render()},
  verify(){level='aal2'},
  enroll(){level='aal2';factors=[factor]},
  hasRedirect:()=>calls.some(c=>c.startsWith('redirect:'))
 }
}
test('password sign-in stays on login until the existing authenticator is verified',async()=>{
 const h=await harness({next:'/admin/finance'})
 await h.signin()
 assert.ok(h.find(h.components.MfaChallenge))
 assert.equal(h.hasRedirect(),false)
 assert.ok(!h.calls.includes('get_my_admin_access'))
 h.verify();await h.find(h.components.MfaChallenge).props.onVerified();h.render()
 assert.equal(h.calls.at(-1),'redirect:/admin/finance')
})
test('refreshing login resumes an incomplete MFA challenge without a redirect loop',async()=>{
 const h=await harness({signedIn:true})
 assert.ok(h.find(h.components.MfaChallenge));assert.equal(h.hasRedirect(),false)
 assert.ok(!h.calls.includes('password-signin'))
})
test('first-login password and mandatory enrollment both finish inside the login card',async()=>{
 const h=await harness({factors:[],mustChange:true,required:true})
 await h.signin()
 assert.ok(h.find(h.components.AdminPasswordForm));assert.equal(h.hasRedirect(),false)
 h.profile.must_change_password=false
 await h.find(h.components.AdminPasswordForm).props.onComplete();h.render()
 assert.ok(h.find(h.components.AccountSecurityPanel));assert.equal(h.find(h.components.AccountSecurityPanel).props.setupOnly,true)
 assert.equal(h.hasRedirect(),false)
 h.enroll();await h.find(h.components.AccountSecurityPanel).props.onComplete();h.render()
 assert.equal(h.calls.at(-1),'redirect:/admin')
})
test('MFA-enabled first-login users verify before setting their private password',async()=>{
 const h=await harness({signedIn:true,mustChange:true})
 assert.ok(h.find(h.components.MfaChallenge))
 h.verify();await h.find(h.components.MfaChallenge).props.onVerified();h.render()
 assert.ok(h.find(h.components.AdminPasswordForm));assert.equal(h.hasRedirect(),false)
 h.profile.must_change_password=false
 await h.find(h.components.AdminPasswordForm).props.onComplete();h.render()
 assert.equal(h.calls.at(-1),'redirect:/admin')
})
test('users without MFA requirements enter after password validation',async()=>{
 const h=await harness({factors:[]})
 await h.signin();assert.equal(h.calls.at(-1),'redirect:/admin')
})
test('inactive accounts, invalid passwords and failed assurance checks cannot open admin',async()=>{
 for(const options of [{status:'suspended'},{role:'customer'},{badPassword:true},{assuranceError:true},{factors:[],sessionReady:false}]){
  const h=await harness(options);await h.signin();assert.equal(h.hasRedirect(),false)
 }
})
test('the admin guard lets the login page own authentication and blocks protected pages',async()=>{
 const code=await compile('components/admin/AdminGuard.tsx')
 for(const path of ['/admin/login','/admin/finance']){
  const effects=[],calls=[],values=[]
  const child={type:'admin-shell'}
  const modules={
   react:{useState:initial=>[initial,value=>values.push(value)],useEffect:fn=>effects.push(fn)},
   'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
   'next/navigation':{usePathname:()=>path,useRouter:()=>({replace:target=>calls.push(target)})},
   '../../lib/supabase':{supabase:{auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getUser:async()=>{calls.push('getUser');return {data:{user:{id:'staff'}}}},mfa:{listFactors:async()=>({data:{all:[factor]}}),getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal2'}})}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:'staff',staff_status:'active'}})})})})}},
   '../../lib/adminAccess':{moduleForAdminPath:()=>null,canAdmin:()=>true},
   '../../lib/mfa':{adminSecurityRedirect,readMfaState}
  }
  const mod={exports:{}}
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:name=>modules[name]})
  const tree=mod.exports.default({children:child})
  for(const effect of effects)effect()
  await new Promise(resolve=>setImmediate(resolve))
  if(path==='/admin/login'){assert.deepEqual(calls,[]);assert.equal(tree.props.children,child)}
  else{assert.equal(calls.at(-1),'/admin/login?next=%2Fadmin%2Ffinance');assert.ok(!all(tree).includes(child))}
 }
})

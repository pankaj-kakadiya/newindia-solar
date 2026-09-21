import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import {adminSecurityRedirect,needsMfaChallenge,readMfaState} from '../lib/mfa.ts'

const require=createRequire(import.meta.url),ts=require('typescript')
const factor={id:'primary',friendly_name:'Phone',status:'verified',factor_type:'totp'}
const state=(level='aal1',factors=[factor])=>({currentLevel:level,nextLevel:factors.some(f=>f.status==='verified')?'aal2':'aal1',factors})

test('every internal role must challenge an opted-in factor, even when policy is optional',()=>{
 for(const role of ['admin','general','sales','finance','production','inventory','content','custom']){
  assert.equal(adminSecurityRedirect({role,mfa_required:false},state(),'/admin/finance'),'/admin/account-security?required=1',role)
  assert.equal(adminSecurityRedirect({role,mfa_required:false},state('aal2'),'/admin/finance'),null,role)
 }
})
test('required first-login sequence is password then enrollment for a new account',()=>{
 const profile={must_change_password:true,mfa_required:true}
 assert.equal(adminSecurityRedirect(profile,state('aal1',[]),'/admin'),'/admin/change-password?required=1')
 assert.equal(adminSecurityRedirect(profile,state('aal1',[]),'/admin/change-password'),null)
 assert.equal(adminSecurityRedirect({mfa_required:true},state('aal1',[]),'/admin'),'/admin/account-security?required=1')
 assert.equal(adminSecurityRedirect({mfa_required:true},state('aal1',[]),'/admin/account-security'),null)
})
test('password-required users with existing MFA verify first without redirect loops',()=>{
 const profile={must_change_password:true,mfa_required:true}
 assert.equal(adminSecurityRedirect(profile,state(),'/admin/change-password'),'/admin/account-security?required=1')
 assert.equal(adminSecurityRedirect(profile,state(),'/admin/account-security'),null)
 assert.equal(adminSecurityRedirect(profile,state('aal2'),'/admin/account-security'),'/admin/change-password?required=1')
 assert.equal(adminSecurityRedirect(profile,state('aal2'),'/admin/change-password'),null)
})
test('incomplete enrollment alone does not claim 2FA protection',()=>{
 assert.equal(needsMfaChallenge(state('aal1',[{...factor,status:'unverified'}])),false)
 assert.equal(adminSecurityRedirect({},state('aal1',[]),'/admin'),null)
})
test('assurance and factor lookup failures fail closed',async()=>{
 for(const failure of ['factors','levels']){
  await assert.rejects(()=>readMfaState({auth:{mfa:{
   listFactors:async()=>({data:{all:[]},error:failure==='factors'?Error('factor failure'):null}),
   getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'},error:failure==='levels'?Error('level failure'):null})
  }}}),/failure/)
 }
})

function nodes(node){
 if(!node||typeof node!=='object')return []
 if(Array.isArray(node))return node.flatMap(nodes)
 return [node,...nodes(node.props?.children)]
}
async function component(path,options={}){
 const source=await readFile(new URL('../'+path,import.meta.url),'utf8')
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
 const values=[],effects=[],calls=[]
 let cursor=0,first=true,factors=structuredClone(options.factors||[factor]),level=options.level||'aal1',tree
 const mfa={
  async listFactors(){return {data:{all:structuredClone(factors)},error:null}},
  async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:level,nextLevel:factors.some(f=>f.status==='verified')?'aal2':'aal1'},error:null}},
  async challengeAndVerify(input){
   calls.push(['verify',input])
   if(options.verifyError)return {error:Error('Invalid or expired code')}
   assert.equal(input.code,'123456')
   factors=factors.map(f=>f.id===input.factorId?{...f,status:'verified'}:f);level='aal2'
   return {error:null}
  },
  async enroll(input){calls.push(['enroll',input]);factors.push({id:'new',status:'unverified',factor_type:'totp'});return {data:{id:'new',totp:{qr:'',qr_code:'data:image/svg+xml,test',secret:'test-only-secret'}},error:null}},
  async unenroll({factorId}){calls.push(['remove',factorId]);factors=factors.filter(f=>f.id!==factorId);return {error:null}}
 }
 const supabase={auth:{
  mfa,
  getUser:async()=>({data:{user:{id:'test-user'}},error:null}),
  refreshSession:async()=>{calls.push(['refresh']);if(!factors.some(f=>f.status==='verified'))level='aal1';return {error:null}},
  signOut:async()=>({error:null})
 },from:()=>({select:()=>({eq:()=>({single:async()=>({data:{mfa_required:options.requiredPolicy||false,must_change_password:options.mustChange||false},error:null})})})})}
 const MfaChallenge=()=>null
 const modules={
  react:{useState(initial){const index=cursor++;if(first)values[index]=initial;return [values[index],value=>{values[index]=typeof value==='function'?value(values[index]):value}]},useEffect(fn){if(first)effects.push(fn)}},
  'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
  'next/link':{__esModule:true,default:'a'},
  'next/navigation':{useRouter:()=>({replace:path=>calls.push(['redirect',path])}),useSearchParams:()=>new URLSearchParams(options.required?'required=1':'')},
  '../../lib/supabase':{supabase},'../../../lib/supabase':{supabase},
  '../../../lib/mfa':{readMfaState,needsMfaChallenge},
  '../../../components/auth/MfaChallenge':{__esModule:true,default:MfaChallenge}
 }
 const mod={exports:{}}
 vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:name=>{assert.ok(modules[name],name);return modules[name]},window:{confirm:()=>true},Date},{filename:path})
 const props={factors:options.factors||[factor],onVerified:()=>calls.push(['verified'])}
 function render(){cursor=0;tree=mod.exports.default(props);first=false;return tree}
 render()
 for(const effect of effects)effect()
 await new Promise(resolve=>setImmediate(resolve));render()
 return {calls,values,MfaChallenge,render,get tree(){return tree},
  find:(type)=>nodes(tree).find(n=>n.type===type),
  button:(label)=>nodes(tree).find(n=>n.type==='button'&&n.props.children===label),
  get level(){return level}
 }
}
test('existing-factor verification submits the selected factor and upgrades the session',async()=>{
 const h=await component('components/auth/MfaChallenge.tsx',{factors:[factor,{...factor,id:'backup',friendly_name:'Backup'}]})
 h.find('select').props.onChange({target:{value:'backup'}});h.render()
 h.find('input').props.onChange({target:{value:'123456'}});h.render()
 await h.find('form').props.onSubmit({preventDefault(){}})
 assert.equal(h.calls[0][0],'verify');assert.equal(h.calls[0][1].factorId,'backup')
 assert.equal(h.level,'aal2');assert.deepEqual(h.calls.at(-1),['verified'])
})
test('invalid or expired codes cannot finish verification',async()=>{
 const h=await component('components/auth/MfaChallenge.tsx',{verifyError:true})
 h.find('input').props.onChange({target:{value:'123456'}});h.render()
 await h.find('form').props.onSubmit({preventDefault(){}})
 assert.equal(h.level,'aal1');assert.ok(!h.calls.some(c=>c[0]==='verified'))
 assert.ok(h.values.includes('Invalid or expired code'))
})
test('security page presents a challenge for the screenshot state',async()=>{
 const h=await component('app/admin/account-security/page.tsx')
 assert.ok(h.find(h.MfaChallenge))
 assert.equal(h.button('Add authenticator'),undefined)
})
test('activation verifies the new factor and returns to dashboard',async()=>{
 const h=await component('app/admin/account-security/page.tsx',{factors:[],required:true,requiredPolicy:true})
 await h.button('Add authenticator').props.onClick();h.render()
 h.find('input').props.onChange({target:{value:'123456'}});h.render()
 await h.find('form').props.onSubmit({preventDefault(){}})
 assert.equal(h.level,'aal2');assert.ok(h.calls.some(c=>c[0]==='redirect'&&c[1]==='/admin'))
})
test('abandoned setup can be cancelled after reload and started again',async()=>{
 const h=await component('app/admin/account-security/page.tsx',{factors:[{...factor,status:'unverified'}]})
 assert.equal(h.find('form'),undefined)
 await h.button('Cancel setup').props.onClick();h.render()
 assert.ok(h.calls.some(c=>c[0]==='remove'));assert.ok(h.calls.some(c=>c[0]==='refresh'))
 await h.button('Add authenticator').props.onClick();h.render()
 assert.ok(h.find('form'))
})
test('required final factor cannot be removed, including through its handler',async()=>{
 const h=await component('app/admin/account-security/page.tsx',{level:'aal2',requiredPolicy:true})
 const remove=h.button('Remove');assert.equal(remove.props.disabled,true)
 await remove.props.onClick()
 assert.ok(!h.calls.some(c=>c[0]==='remove'))
})
test('optional last-factor removal refreshes assurance to password only',async()=>{
 const h=await component('app/admin/account-security/page.tsx',{level:'aal2'})
 await h.button('Remove').props.onClick()
 assert.equal(h.level,'aal1');assert.ok(h.calls.some(c=>c[0]==='refresh'))
})

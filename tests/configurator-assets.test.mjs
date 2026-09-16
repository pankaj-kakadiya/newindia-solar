import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import crypto from 'node:crypto'
import ts from 'typescript'
const sourceUrl=new URL('../lib/configurator-visuals.ts',import.meta.url)
const compiled=ts.transpileModule(fs.readFileSync(sourceUrl,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
const scope={exports:{},require:createRequire(sourceUrl)};vm.runInNewContext(compiled,scope)
const {buildLayers,requiresQuote,fitRectangle,sourceRectangle}=scope.exports
const pack=JSON.parse(fs.readFileSync(new URL('../lib/builder-assets.json',import.meta.url)))
const starter=JSON.parse(fs.readFileSync(new URL('../lib/builder-starter.json',import.meta.url)))
function chosen(data){return Object.fromEntries(data.groups.map(g=>[g.option_key,g.configurator_option_values.filter(v=>v.metadata.default).map(v=>({id:v.id,qty:v.metadata.default_quantity||1}))]))}
function vals(data){return Object.fromEntries(data.groups.flatMap(g=>g.configurator_option_values.map(v=>[v.id,v])))}
test('all 32 source PNGs are present and byte-identical to the approved asset package',()=>{
  assert.equal(pack.assets.length,32)
  for(const a of pack.assets){const data=fs.readFileSync(new URL('../public'+a.src,import.meta.url));assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(crypto.createHash('sha256').update(data).digest('hex'),a.sha256,a.id)}
})
for(const code of ['ACDB','DCDB']){
 const data=starter[code],values=vals(data),spd=data.groups.find(g=>g.option_key==='spd'),breaker=data.groups.find(g=>['protection','dc_mcb'].includes(g.option_key))
 test(`${code}: every SPD/breaker combination occupies all 11 distinct slots`,()=>{
   assert.equal(spd.configurator_option_values.length,8);assert.equal(breaker.configurator_option_values.length,3)
   for(const s of spd.configurator_option_values)for(const m of breaker.configurator_option_values){const selections=chosen(data);selections.spd=[{id:s.id,qty:1}];selections[breaker.option_key]=[{id:m.id,qty:1}];const layers=buildLayers(data.groups,selections,values,data.components,data.slots);assert.equal(layers.length,11);assert.equal(new Set(layers.map(l=>l.slot.id)).size,11);assert.equal(layers.filter(l=>l.component.visual_role==='mcb').length,1);assert.equal(layers.filter(l=>l.component.visual_role==='wire').length,4);assert.equal(layers.filter(l=>l.component.visual_role==='gland').length,2);assert.equal(layers.find(l=>l.component.visual_role==='spd').component.id,s.component_id)}
 })
 test(`${code}: optional wires and a second gland can be removed without removing other parts`,()=>{const s=chosen(data);s[code==='ACDB'?'wire':'solar_cable']=[];s.cable_gland[0].qty=1;const layers=buildLayers(data.groups,s,values,data.components,data.slots);assert.equal(layers.length,6);assert.equal(layers.filter(l=>l.component.visual_role==='wire').length,0);assert.equal(layers.filter(l=>l.component.visual_role==='gland').length,1)})
 test(`${code}: unpriced components remain quotation-only`,()=>assert.equal(requiresQuote(data.template,Object.values(data.components)),true))
}
test('transparent padding is excluded and component aspect ratio is preserved',()=>{const a=pack.assets.find(a=>a.id==='ac-spd-oreit'),r=sourceRectangle(a,a.imageSizePx.width,a.imageSizePx.height);assert.equal(r.join(','),a.sourceRectPx.join(','));const rect=fitRectangle(r,[247,475,220,447]);assert.ok(Math.abs(rect[2]/rect[3]-r[2]/r[3])<1e-9)})
test('zero or unknown prices cannot become a free checkout item',()=>{assert.equal(requiresQuote({},[{selling_price:0}]),true);assert.equal(requiresQuote({},[{}]),true);assert.equal(requiresQuote({},[{selling_price:100}]),false)})

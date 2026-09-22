const {test,expect}=require('@playwright/test'),fs=require('node:fs')
const starter=require('../lib/builder-starter.json')
async function isolated(page){await page.route('**/*.supabase.co/**',async route=>{const r=route.request();if(r.method()!=='GET'&&r.method()!=='OPTIONS'){await route.abort();throw new Error('Unexpected production write: '+r.url())}if(new URL(r.url()).pathname.startsWith('/storage/'))return route.continue();await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:r.headers().accept?.includes('vnd.pgrst.object')?'null':'[]'})})}
const stage=page=>page.getByTestId('builder-stage')
async function ready(page){
 // Next.js streamed content may briefly include a hidden staging copy. Require one final stage, not an arbitrary first match.
 await expect(stage(page)).toHaveCount(1);await expect(stage(page)).toBeVisible();await expect(stage(page).locator('.bbLayer')).toHaveCount(11)
 await expect(page.locator('.bbStatus button')).toBeEnabled()
}
async function loaded(page,code){await page.goto('/customize/'+code.toLowerCase()+'?preview=components-v1');await ready(page)}
async function assetsReady(page){await stage(page).evaluate(async el=>{await Promise.all([...el.querySelectorAll('image')].map(el=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve();i.onerror=()=>reject(new Error('Asset failed: '+el.getAttribute('href')));i.src=el.getAttribute('href')})))})}
for(const code of ['ACDB','DCDB'])for(const width of [390,1440])test(`${code} at ${width}: all 24 SPD and breaker previews`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await isolated(page);await page.setViewportSize({width,height:960});await loaded(page,code)
 const data=starter[code],sg=data.groups.find(g=>g.option_key==='spd'),mg=data.groups.find(g=>['protection','dc_mcb'].includes(g.option_key));let n=0
 for(const s of sg.configurator_option_values)for(const m of mg.configurator_option_values){
  await page.locator(`button.bbSelect[data-value="${s.id}"]`).click();await page.locator(`button.bbSelect[data-value="${m.id}"]`).click()
  await expect(stage(page).locator(`[data-asset="${data.components[s.component_id].visual_settings.asset_id}"]`)).toHaveCount(1)
  await expect(stage(page).locator(`[data-asset="${data.components[m.component_id].visual_settings.asset_id}"]`)).toHaveCount(1)
  await expect(stage(page).locator('.bbLayer')).toHaveCount(11);await expect(page.locator('.bbIssues')).toHaveCount(0)
  await assetsReady(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  const bodies=await stage(page).locator('.bbLayer').evaluateAll(nodes=>nodes.filter(n=>['spd','protection','dc_mcb','terminal','terminal_block'].includes(n.dataset.slot)).map(n=>({asset:n.dataset.asset,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right})))
  const spd=bodies.find(x=>x.asset.includes('-spd-')),mcb=bodies.find(x=>x.asset.includes('-mcb-')),terminal=bodies.find(x=>x.asset==='terminal-block-pair')
  expect(spd.right).toBeLessThan(mcb.left);expect(mcb.right).toBeLessThan(terminal.left)
  await stage(page).screenshot({path:`test-results/${code}-${width}-${String(++n).padStart(2,'0')}.png`})
 }
 expect(n).toBe(24);expect(errors).toEqual([]);await page.screenshot({path:`test-results/${code}-${width}-buyer-page.png`,fullPage:true})
})
for(const code of ['ACDB','DCDB'])test(`${code}: uploaded reference choices preserve BOM and never mix AC/DC`,async({page})=>{
 await isolated(page);await loaded(page,code)
 const options=await page.locator('#builder-reference option:not(:disabled)').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean))
 expect(options.length).toBe(code==='ACDB'?20:16)
 for(const id of options){await page.locator('#builder-reference').selectOption(id);await expect(page.locator('.bbIssues')).toHaveCount(0);await expect(page.locator('.bbNotice')).toContainText(`${code}-${id}`);const all=await stage(page).locator('.bbLayer').evaluateAll(nodes=>nodes.map(n=>n.dataset.asset));expect(all.some(s=>s.startsWith(code==='ACDB'?'dc-':'ac-'))).toBe(false)}
 if(code==='ACDB')await expect(page.locator('#builder-reference option[value="14"]')).toBeDisabled()
})
test('optional layers, gland quantities, save, reload, restore and reset',async({page})=>{
 await isolated(page);await loaded(page,'ACDB')
 await page.locator('.bbSelect[data-asset="wire-red-left"]').click();await expect(stage(page).locator('[data-asset="wire-red-left"]')).toHaveCount(0)
 await page.getByRole('button',{name:'Reduce Grey and black cable gland quantity'}).click();await expect(stage(page).locator('[data-asset="cable-gland"]')).toHaveCount(1)
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.locator('.bbNotice')).toContainText('Draft saved')
 await page.reload();await ready(page);await expect(page.getByRole('button',{name:'Restore draft',exact:true})).toBeVisible();await page.getByRole('button',{name:'Restore draft',exact:true}).click();await expect(stage(page).locator('[data-asset="wire-red-left"]')).toHaveCount(0);await expect(stage(page).locator('[data-asset="cable-gland"]')).toHaveCount(1)
 await page.getByRole('button',{name:'Reset',exact:true}).click();await expect(stage(page).locator('.bbLayer')).toHaveCount(11)
})
test('PNG is full-size, exported from current layers, and BOM is readable',async({page})=>{
 await isolated(page);await loaded(page,'DCDB');await page.locator('#builder-reference').selectOption('15')
 const wait=page.waitForEvent('download');await page.locator('.bbPreviewFoot').getByRole('button',{name:'Download PNG'}).click();const d=await wait;await d.saveAs('test-results/DCDB-export.png');const png=fs.readFileSync('test-results/DCDB-export.png');expect(png.readUInt32BE(16)).toBe(1086);expect(png.readUInt32BE(20)).toBe(1448)
 const bomWait=page.waitForEvent('download');await page.getByRole('button',{name:'Download component list',exact:true}).click();const b=await bomWait;await b.saveAs('test-results/DCDB-BOM.txt');const text=fs.readFileSync('test-results/DCDB-BOM.txt','utf8');expect(text).toContain('DCDB-15');expect(text).toContain('dc-spd-itally');expect(text).toContain('dc-mcb-siemens-32a')
})
test('RFQ carries the exact draft, and a synthetic submission is intercepted',async({page})=>{
 await isolated(page);await loaded(page,'ACDB');await page.locator('#builder-reference').selectOption('04');await page.locator('.bbSummary').getByRole('button',{name:'Request quotation',exact:true}).click();await expect(page).toHaveURL(/source=builder&draft=/);await expect(page.locator('textarea[name=note]')).toHaveValue(/ac-spd-schutz/);await expect(page.locator('textarea[name=note]')).toHaveValue(/ac-mcb-empower-c32a/)
 let saved;await page.route('**/rest/v1/bulk_rfqs',async route=>{saved=route.request().postDataJSON();await route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'})})
 await page.locator('input[name=name]').fill('ISOLATED QA — never sent');await page.locator('input[name=mobile]').fill('9000000000');await page.getByRole('button',{name:'Submit Bulk Requirement'}).click();await expect(page.getByRole('heading',{name:'Requirement received.'})).toBeVisible();expect(saved.requirement).toContain('ACDB-04');expect(saved.phone).toBe('9000000000');expect(saved.product_interest).toBe('ACDB');expect(saved).not.toHaveProperty('additional_requirement')
})
for(const [width,height] of [[320,740],[768,900],[844,390],[1920,1080]])test(`responsive buyer controls and expanded preview ${width}x${height}`,async({page})=>{
 await isolated(page);await page.setViewportSize({width,height});await loaded(page,'ACDB');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 const enlarge=page.getByRole('button',{name:'Enlarge box preview',exact:true});await enlarge.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await assetsReady(page)
 const before=(await page.getByTestId('expanded-stage').boundingBox()).width;await page.getByRole('button',{name:'Zoom in',exact:true}).click();expect((await page.getByTestId('expanded-stage').boundingBox()).width).toBeGreaterThan(before)
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('dialog[open]'))).toBe(true)}
 await page.screenshot({path:`test-results/expanded-${width}x${height}.png`});await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(enlarge).toBeFocused()
 if(width<=800){await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await expect.poll(()=>page.evaluate(()=>document.querySelector('.nisFooterBottom').getBoundingClientRect().bottom-document.querySelector('.bbMobileBar').getBoundingClientRect().top)).toBeLessThanOrEqual(2);await page.screenshot({path:`test-results/footer-${width}.png`})}
})
test('missing image shows failure and refresh restores it; PNG failure is visible',async({page})=>{
 await isolated(page);let fail=true;await page.route('**/ac-spd-oreit.png',route=>fail?route.fulfill({status:404,body:'Unavailable'}):route.continue());await loaded(page,'ACDB');await expect(stage(page).locator('.cvAssetMissing')).toBeVisible();await page.locator('.bbPreviewFoot').getByRole('button',{name:'Download PNG'}).click();await expect(page.locator('.bbNotice')).toContainText('could not be loaded');fail=false;await page.locator('.bbStatus').getByRole('button').click();await expect(stage(page).locator('.cvAssetMissing')).toHaveCount(0);await assetsReady(page)
})
test('normal landing links open both quotation builders',async({page})=>{
 await isolated(page);await page.goto('/customize');await page.getByRole('link',{name:'Open ACDB Builder'}).click();await expect(page.getByRole('alert').filter({hasText:'not published'})).toBeVisible();await page.goto('/customize');await page.getByRole('link',{name:'Open DCDB Builder'}).click();await expect(page.getByRole('alert').filter({hasText:'not published'})).toBeVisible()
})
test('live domain baseline is inspected read-only and recorded separately',async({page})=>{
 test.setTimeout(90000);const results=[];await page.route('**/*',async route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort())
 for(const code of ['acdb','dcdb']){try{const response=await page.goto(`https://newindiasolar.com/customize/${code}`,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(2500);results.push({code,status:response?.status(),title:await page.title(),text:(await page.locator('body').innerText()).slice(0,12000)});await page.screenshot({path:`test-results/live-before-${code}.png`,fullPage:true})}catch(e){results.push({code,error:String(e)})}}
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/live-before.json',JSON.stringify(results,null,2))
})

test('admin catalogue edits reach buyers after selection and refresh; unpublish blocks submission',async({page})=>{
 await isolated(page)
 let published=true,changed=false
 const d=structuredClone(starter.ACDB)
 await page.route('**/rest/v1/**',async route=>{
  if(!['GET','OPTIONS'].includes(route.request().method()))throw new Error('Unexpected write')
  const name=new URL(route.request().url()).pathname.split('/').pop()
  const table={configurator_templates:published?{...d.template,is_active:true}:null,configurator_options:d.groups.map(g=>({...g,configurator_option_values:g.configurator_option_values.map(v=>({...v,is_active:true,label:changed&&g.option_key==='spd'?'Admin updated '+v.label:v.label}))})),components:Object.values(d.components),enclosures:Object.values(d.enclosures),configurator_visual_slots:d.slots,configurator_component_compatibility:[]}
  await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(table[name]??(name==='configurator_templates'?null:[]))})
 })
 await page.goto('/customize/acdb');await ready(page)
 await expect(page.locator('.bbStatus')).toContainText('Published component catalogue')
 const option=d.groups.find(g=>g.option_key==='spd').configurator_option_values[1]
 await page.locator(`button[data-value="${option.id}"]`).click();changed=true
 await page.locator('.bbStatus button').click();await expect(page.locator(`button[data-value="${option.id}"]`)).toContainText('Admin updated')
 await expect(page.locator(`button[data-value="${option.id}"]`)).toHaveAttribute('aria-pressed','true')
 published=false;await page.locator('.bbStatus button').click();await expect(page.getByRole('alert').filter({hasText:'not published'})).toBeVisible()
 await expect(page.locator('.bbSummary').getByRole('button',{name:'Request quotation',exact:true})).toBeDisabled()
})

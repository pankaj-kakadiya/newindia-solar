// Read-only deployed-site checks. Never submit an RFQ, order or payment.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const base=new URL(process.argv[2]),label=process.argv[3]||'preview',wait=process.argv.includes('--wait')
if(base.protocol!=='https:'||!(base.hostname==='newindiasolar.com'||base.hostname.endsWith('-housious.vercel.app')))throw new Error('Unapproved smoke-test origin')
const output=path.join('test-results',label);fs.mkdirSync(output,{recursive:true})
;(async()=>{
 const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),record={origin:base.origin,expectedSource:process.env.GITHUB_SHA||'',checkedAt:new Date().toISOString(),checks:[],blockedWrites:[]}
 await context.route('**/*',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){record.blockedWrites.push(route.request().url());return route.abort()}return route.continue()})
 try{
  const deadline=Date.now()+(wait?360000:45000)
  for(;;){try{await page.goto(base.origin+'/customize/acdb?qa='+Date.now(),{waitUntil:'domcontentloaded',timeout:25000});await page.waitForSelector('.bbPage[data-builder-code="ACDB"]',{timeout:10000});break}catch(e){if(Date.now()>deadline)throw e;await page.waitForTimeout(10000)}}
  const assets=require('../lib/builder-assets.json').assets
  for(const a of assets){const response=await context.request.get(base.origin+a.src);assert.equal(response.status(),200,a.src+' must load');assert.ok((await response.body()).length>100,a.src+' is empty')}
  record.assetResponses=assets.length
  for(const code of ['ACDB','DCDB'])for(const width of [390,1440]){
   await page.setViewportSize({width,height:960})
   const errors=[];const onError=e=>errors.push(String(e));page.on('pageerror',onError)
   const response=await page.goto(base.origin+'/customize/'+code.toLowerCase(),{waitUntil:'networkidle',timeout:45000})
   assert.equal(response.status(),200)
   await page.waitForFunction(()=>document.querySelectorAll('[data-testid="builder-stage"]').length===1&&document.querySelectorAll('[data-testid="builder-stage"] .bbLayer').length===11)
   await page.waitForFunction(()=>!document.querySelector('.bbStatus button')?.disabled,{},{timeout:20000})
   const selector=page.locator('#builder-reference');await selector.selectOption(code==='ACDB'?'04':'15')
   await page.waitForFunction(()=>document.querySelector('.bbNotice')?.textContent.includes('loaded'))
   const expected=code==='ACDB'?['ac-spd-schutz','ac-mcb-empower-c32a']:['dc-spd-itally','dc-mcb-siemens-32a']
   const stage=page.getByTestId('builder-stage')
   for(const id of expected)assert.equal(await stage.locator(`[data-asset="${id}"]`).count(),1)
   assert.equal(await stage.locator('.bbLayer').count(),11)
   assert.equal(await page.locator('.bbIssues').count(),0)
   await stage.evaluate(async el=>{await Promise.all([...el.querySelectorAll('image')].map(n=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(new Error(n.getAttribute('href')));image.src=n.getAttribute('href')})))})
   assert.equal(await stage.locator('.cvAssetMissing').count(),0)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(output,`${code}-${width}-page.png`),fullPage:true});await stage.screenshot({path:path.join(output,`${code}-${width}-box.png`)})
   await page.getByRole('button',{name:'Enlarge box preview',exact:true}).click();assert.ok(await page.getByRole('dialog').isVisible());await page.screenshot({path:path.join(output,`${code}-${width}-expanded.png`)});await page.keyboard.press('Escape')
   const downloadPromise=page.waitForEvent('download');await page.locator('.bbPreviewFoot').getByRole('button',{name:'Download PNG'}).click();await (await downloadPromise).saveAs(path.join(output,`${code}-${width}-export.png`))
   await page.locator('.bbSummary').getByRole('button',{name:'Request quotation',exact:true}).click();await page.waitForURL(/\/bulk-order\?source=builder/);await page.waitForFunction(()=>document.querySelector('textarea[name=note]')?.value.includes('Asset:'))
   const requirement=await page.locator('textarea[name=note]').inputValue();for(const id of expected)assert.ok(requirement.includes(id))
   assert.deepEqual(errors,[]);page.off('pageerror',onError)
   record.checks.push({code,width,status:response.status(),layers:11,reference:code==='ACDB'?'04':'15',images:'loaded',overflow:false,png:'downloaded',rfq:'prefilled, not submitted',pageErrors:errors})
  }
  record.result='passed';console.log(JSON.stringify(record,null,2))
 }catch(e){record.result='failed';record.error=String(e);await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error(record);process.exitCode=1}
 finally{record.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(record,null,2));await browser.close()}
})()

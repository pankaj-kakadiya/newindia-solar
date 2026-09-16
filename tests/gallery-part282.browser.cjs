const {test,expect}=require('@playwright/test')
const photoA={image_url:'/gallery-a.svg',alt_text:'Portrait component front',sort_order:0}
const photoB={image_url:'/gallery-b.svg',alt_text:'Landscape component back',sort_order:1}
const makeProduct=(images=[photoB,photoA])=>({id:'11111111-1111-4111-8111-111111111111',name:'Gallery verification fixture',slug:'gallery-fixture',status:'active',category_id:'c1',product_type:'standard',gst_rate:0,min_order_qty:1,featured:false,sort_order:0,short_description:'Isolated test data, not a saleable product.',description:'Gallery and layout verification only.',specifications:{},inclusions:[],applications:[],product_badges:[],warranty_months:null,lead_time_days:null,hsn_code:null,datasheet_url:null,installation_guide_url:null,categories:{name:'MCB',slug:'mcb',is_active:true},brands:null,product_images:images,product_variants:[{id:'22222222-2222-4222-8222-222222222222',sku:'GALLERY-FIXTURE',title:'Test option',selling_price:100,stock_qty:6,unit:'pcs',is_active:true,attributes:{}}]})
async function install(page,options={}){
 const state={failed:false,delay:0,...options}
 await page.route('**/gallery-*.svg',async route=>{
  if(state.delay)await new Promise(r=>setTimeout(r,state.delay))
  if(state.failed&&route.request().url().endsWith('gallery-a.svg'))return route.fulfill({status:404,body:'Not found'})
  const portrait=route.request().url().endsWith('gallery-a.svg')
  return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${portrait?200:700}" height="${portrait?600:200}"><rect x="1" y="1" width="98%" height="98%" fill="#e8edeb" stroke="#0d1b2a"/><text x="12" y="90" font-size="25">${portrait?'Front':'Back'}</text></svg>`})
 })
 await page.route('**/*.supabase.co/**',async route=>{
  const request=route.request(),u=new URL(request.url())
  if(request.method()!=='GET'&&request.method()!=='OPTIONS'){await route.abort();throw new Error(`Unexpected production write: ${request.method()} ${u.pathname}`)}
  if(state.realPhoto&&request.url()===state.realPhoto)return route.continue()
  let rows=[]
  if(u.pathname.endsWith('/products')&&!u.searchParams.get('id')?.startsWith('neq.'))rows=[state.product||makeProduct(state.images)]
  const single=request.headers().accept?.includes('vnd.pgrst.object')
  await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`},body:JSON.stringify(single?rows[0]||null:rows)})
 })
 return state
}
async function open(page){await page.goto('/product/gallery-fixture');await expect(page.locator('.p28Photo')).toBeVisible()}
async function readyPhoto(page,selector='.p28Photo img'){await expect.poll(()=>page.locator(selector).evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true)}
// Next/Image may serialize an absolute URL after loading; check the actual resource path.
async function expectPhoto(locator,path){await expect.poll(()=>locator.evaluate(img=>new URL(img.src,document.baseURI).pathname)).toBe(path)}
async function gesture(page,selector,kind){
 await page.locator(selector).evaluate((stage,kind)=>{
  const rect=stage.getBoundingClientRect(),x=rect.left+rect.width*.75,y=rect.top+rect.height*.5
  const point=(id,dx=0,dy=0)=>new Touch({identifier:id,target:stage,clientX:x+dx,clientY:y+dy})
  const emit=(type,touches,changed=touches)=>stage.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:changed}))
  emit('touchstart',[point(1)])
  if(kind==='cancel')emit('touchcancel',[],[point(1)])
  if(kind==='multi')emit('touchstart',[point(1),point(2,20)])
  const finish=point(1,-100,kind==='vertical'?180:5)
  emit('touchend',[],[finish])
 },kind)
}
test('gallery sorts images and supports buttons, thumbnails, Home/End and wraparound',async({page})=>{
 await install(page);await open(page);await readyPhoto(page)
 await expectPhoto(page.locator('.p28Photo img'),'/gallery-a.svg')
 await page.getByRole('button',{name:'Next image',exact:true}).click();await expectPhoto(page.locator('.p28Photo img'),'/gallery-b.svg')
 await page.getByRole('button',{name:'Show product image 1',exact:true}).click();await expectPhoto(page.locator('.p28Photo img'),'/gallery-a.svg')
 await page.locator('.p28Photo').focus();await page.keyboard.press('End');await expectPhoto(page.locator('.p28Photo img'),'/gallery-b.svg')
 await page.keyboard.press('Home');await page.keyboard.press('ArrowLeft');await expectPhoto(page.locator('.p28Photo img'),'/gallery-b.svg')
 await page.keyboard.press('ArrowRight');await expectPhoto(page.locator('.p28Photo img'),'/gallery-a.svg')
})
test('enlarged gallery keyboard navigation, focus containment, Escape and scroll restoration',async({page})=>{
 await install(page);await open(page)
 const before=await page.evaluate(()=>document.body.style.overflow)
 const enlarge=page.getByRole('button',{name:'Enlarge product image',exact:true});await enlarge.click()
 const dialog=page.getByRole('dialog',{name:'Enlarged product image',exact:true});await expect(dialog).toBeVisible()
 await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('hidden')
 await page.keyboard.press('End');await expectPhoto(dialog.locator('img'),'/gallery-b.svg')
 await page.keyboard.press('Home');await expectPhoto(dialog.locator('img'),'/gallery-a.svg')
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog[open]'))).toBe(true)}
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(enlarge).toBeFocused();await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe(before)
})
test('vertical, cancelled and multi-touch gestures do not change images; sideways swipes do',async({page})=>{
 await install(page);await open(page)
 for(const kind of ['vertical','cancel','multi']){await gesture(page,'.p28Photo',kind);await expectPhoto(page.locator('.p28Photo img'),'/gallery-a.svg')}
 await gesture(page,'.p28Photo','horizontal');await expectPhoto(page.locator('.p28Photo img'),'/gallery-b.svg')
 await page.getByRole('button',{name:'Enlarge product image',exact:true}).click();await gesture(page,'.p28ZoomImage','horizontal');await expectPhoto(page.locator('.p28ZoomImage img'),'/gallery-a.svg')
})
test('missing image shows a retry and does not poison the next photo',async({page})=>{
 const state=await install(page,{failed:true});await open(page)
 await expect(page.locator('.p28Photo .p28ImageEmpty')).toContainText('Image could not be loaded')
 await page.getByRole('button',{name:'Next image',exact:true}).click();await readyPhoto(page);await expectPhoto(page.locator('.p28Photo img'),'/gallery-b.svg')
 await page.getByRole('button',{name:'Previous image',exact:true}).click();await expect(page.locator('.p28Photo .p28ImageEmpty')).toBeVisible()
 state.failed=false;await page.locator('.p28Photo').getByRole('button',{name:'Retry image',exact:true}).click();await readyPhoto(page);await expect(page.locator('.p28Photo .p28ImageEmpty')).toHaveCount(0)
})
test('empty/unsafe image metadata never creates phantom gallery controls',async({page})=>{
 await install(page,{images:[{image_url:'javascript:alert(1)',alt_text:'Invalid',sort_order:0}]});await open(page)
 await expect(page.locator('.p28Photo')).toContainText('Image not available');await expect(page.locator('.p28Photo img')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Enlarge product image',exact:true})).toHaveCount(0);await expect(page.locator('.p28Thumbnails')).toHaveCount(0)
})
test('single image hides arrows and thumbnails but still enlarges',async({page})=>{
 await install(page,{images:[photoA]});await open(page);await readyPhoto(page)
 await expect(page.locator('.p28Arrow')).toHaveCount(0);await expect(page.locator('.p28Thumbnails')).toHaveCount(0)
 await page.getByRole('button',{name:'Enlarge product image'}).click();await expect(page.getByRole('dialog')).toBeVisible()
})
test('mobile purchase bar reserves footer space and cleans up on resize and route change',async({page})=>{
 await page.setViewportSize({width:390,height:844});await install(page);await open(page)
 await expect(page.locator('.p28MobileBar')).toBeVisible()
 await expect.poll(()=>page.evaluate(()=>parseFloat(document.body.style.paddingBottom)>=document.querySelector('.p28MobileBar').getBoundingClientRect().height)).toBe(true)
 // Ignore the site's optional smooth-scroll animation, not the footer-clearance requirement.
 await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}))
 await expect.poll(()=>page.evaluate(()=>Math.abs(window.scrollY+window.innerHeight-document.documentElement.scrollHeight)),{message:'Scroll reached the actual bottom of the document'}).toBeLessThanOrEqual(2)
 await expect.poll(()=>page.evaluate(()=>document.querySelector('.nisFooterBottom').getBoundingClientRect().bottom-document.querySelector('.p28MobileBar').getBoundingClientRect().top),{message:'Footer content is above the fixed purchase controls'}).toBeLessThanOrEqual(2)
 await page.screenshot({path:'test-results/mobile-footer-clearance.png'})
 await page.setViewportSize({width:1440,height:900});await expect(page.locator('.p28MobileBar')).not.toBeVisible();await expect.poll(()=>page.evaluate(()=>document.body.style.paddingBottom)).toBe('')
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.p28MobileBar')).toBeVisible()
 await page.locator('.p28Breadcrumb').getByRole('link',{name:'Components',exact:true}).click();await expect(page).toHaveURL(/\/shop$/);await expect.poll(()=>page.evaluate(()=>document.body.style.paddingBottom)).toBe('')
})
for(const [width,height] of [[320,740],[390,844],[768,900],[844,390],[1440,900]])test(`gallery and mobile controls fit ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await install(page);await open(page);await readyPhoto(page)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
 expect(await page.locator('.p28Photo img').evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain')
 await page.getByRole('button',{name:'Enlarge product image',exact:true}).click();await readyPhoto(page,'.p28ZoomImage img')
 const bounds=await page.locator('.p28ZoomImage').boundingBox();expect(bounds.height).toBeGreaterThan(80)
 const close=await page.getByRole('button',{name:'Close enlarged image'}).boundingBox();expect(close.y+close.height).toBeLessThanOrEqual(height)
 await page.screenshot({path:`test-results/gallery-${width}x${height}.png`})
})
// These URLs were read from existing active product-image records; database reads below are mocked.
const realPhotos=[
 {name:'SIEMENS 5SL42327RC 32A 2 POLE C CURVE AC MINIATURE CIRCUIT BREAKER',image:'https://cdtbwuagqxkknkccpkcr.supabase.co/storage/v1/object/public/product-assets/products/siemens-5sl42327rc-32a-2-pole-c-curve-ac-miniature-circuit-breaker/1789589067663-03.png'},
 {name:'ORBIT ELECTRIC OT-SPD-PV 2 POLE TYPE 2 DC SURGE PROTECTION DEVICE 600V',image:'https://cdtbwuagqxkknkccpkcr.supabase.co/storage/v1/object/public/product-assets/products/orbit-electric-ot-spd-pv-2-pole-type-2-dc-surge-protection-device-600v/1789585839693-02.png'}
]
for(const [i,sample] of realPhotos.entries())test(`read-only existing catalogue photograph ${i+1}`,async({page})=>{
 test.setTimeout(60000)
 const width=i===0?1440:390;await page.setViewportSize({width,height:900})
 const product={...makeProduct([{image_url:sample.image,alt_text:sample.name,sort_order:0}]),name:sample.name,product_variants:[],short_description:'Read-only image layout check. Commercial values are omitted in this isolated test.'}
 await install(page,{product,realPhoto:sample.image});await open(page);await readyPhoto(page)
 expect(await page.locator('.p28Photo img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(100)
 expect(await page.locator('.p28Photo img').evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain')
 await page.screenshot({path:`test-results/existing-photo-${width}.png`,fullPage:true})
 await page.locator('.p28Gallery').screenshot({path:`test-results/existing-gallery-${width}.png`})
})

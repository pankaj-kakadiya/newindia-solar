const {test,expect}=require('@playwright/test')
const product={id:'11111111-1111-4111-8111-111111111111',name:'Fixture MCB',slug:'fixture-mcb',status:'active',category_id:'c1',product_type:'standard',gst_rate:0,min_order_qty:2,featured:false,sort_order:0,short_description:'Synthetic test fixture, not a saleable product.',description:'Published test description',specifications:{voltage:'415V'},inclusions:['One test device'],applications:[],product_badges:[],warranty_months:null,lead_time_days:null,hsn_code:null,datasheet_url:null,installation_guide_url:null,categories:{name:'MCB',slug:'mcb',is_active:true},brands:null,product_images:[{image_url:'/fixture-a.svg',alt_text:'Fixture front',sort_order:0},{image_url:'/fixture-b.svg',alt_text:'Fixture back',sort_order:1}],product_variants:[{id:'22222222-2222-4222-8222-222222222222',sku:'FIX-32',title:'32A option',selling_price:100,stock_qty:6,unit:'pcs',is_active:true,attributes:{current:'32A'}},{id:'33333333-3333-4333-8333-333333333333',sku:'FIX-63',title:'63A option',selling_price:200,stock_qty:10,unit:'pcs',is_active:true,attributes:{current:'63A'}}]}
async function fixtures(page){
 await page.route('**/fixture-*.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect x="30" y="30" width="140" height="140" fill="gray"/></svg>'}))
 await page.route('**/*.supabase.co/**',async route=>{const request=route.request(),u=new URL(request.url());if(request.method()!=='GET'&&request.method()!=='OPTIONS')throw new Error(`Unexpected remote write in fixture test: ${request.method()} ${u.pathname}`);let rows=[]
  if(u.pathname.endsWith('/products')&&!u.searchParams.get('id')?.startsWith('neq.'))rows=[structuredClone(product)]
  const singleton=request.headers().accept?.includes('vnd.pgrst.object')
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`},body:JSON.stringify(singleton?rows[0]||null:rows)})
 })
}
test.beforeEach(async({page})=>fixtures(page))
test('selected variant, zero GST, MOQ and persistent cart',async({page})=>{
 await page.goto(`/product/fixture-mcb?variant=${product.product_variants[0].id}`)
 await expect(page.getByRole('heading',{name:'Fixture MCB',exact:true})).toBeVisible()
 await expect(page.locator('#product-quantity')).toHaveValue('2')
 await expect(page.locator('.p28PriceCard')).toContainText('0% GST')
 await page.getByRole('button',{name:'Add to Cart',exact:true}).click()
 await expect(page.getByText('Added 2 pcs to cart.')).toBeVisible()
 await page.goto('/cart');await expect(page.locator('.cartInfo')).toContainText('Fixture MCB');await expect(page.locator('.qtyModern')).toContainText('2')
 await page.reload();await expect(page.locator('.cartInfo')).toContainText('Fixture MCB');await expect(page.locator('.summary .grand')).toContainText('₹200.00')
})
test('multi-option products require a selection, and no fallback IP rating appears',async({page})=>{
 await page.goto('/product/fixture-mcb');await expect(page.getByText('Select an option above', {exact:false})).toBeVisible()
 await expect(page.locator('main')).not.toContainText('IP65')
 await page.getByLabel('63A option',{exact:false}).check();await expect(page.locator('.p28Meta')).toContainText('FIX-63');await expect(page.locator('.p28PriceCard')).toContainText('₹200.00')
 await page.getByRole('tab',{name:'Specifications'}).click();await expect(page.getByRole('tabpanel')).toContainText('63A')
})
test('invalid quantity does not silently clamp or add',async({page})=>{
 await page.goto(`/product/fixture-mcb?variant=${product.product_variants[0].id}`)
 await page.locator('#product-quantity').fill('7');await expect(page.getByRole('button',{name:'Add to Cart',exact:true})).toBeDisabled();await expect(page.locator('#product-quantity-error')).toContainText('stock')
 await page.locator('#product-quantity').fill('1');await expect(page.locator('#product-quantity-error')).toContainText('Minimum')
})
test('RFQ preserves SKU and quantity without submitting a real enquiry',async({page})=>{
 await page.goto(`/product/fixture-mcb?variant=${product.product_variants[0].id}`)
 await page.locator('#product-quantity').fill('3');await page.getByRole('link',{name:/Bulk \/ project enquiry/}).click()
 await expect(page.locator('textarea[name=note]')).toHaveValue(/FIX-32/);await expect(page.locator('input[name=qty]')).toHaveValue('3')
})
test('gallery enlargement closes with Escape and returns focus',async({page})=>{
 await page.goto(`/product/fixture-mcb?variant=${product.product_variants[0].id}`)
 const enlarge=page.getByRole('button',{name:'Enlarge product image'});await enlarge.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(enlarge).toBeFocused()
})
for(const width of [390,768,1440])test(`no horizontal overflow at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto(`/product/fixture-mcb?variant=${product.product_variants[0].id}`);await expect(page.getByRole('heading',{name:'Fixture MCB',exact:true})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
 await page.screenshot({path:`test-results/product-${width}.png`,fullPage:true})
})

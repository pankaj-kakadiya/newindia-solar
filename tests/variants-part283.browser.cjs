const {test,expect}=require('@playwright/test')
const A='22222222-2222-4222-8222-222222222222',B='33333333-3333-4333-8333-333333333333',H='44444444-4444-4444-8444-444444444444'
const variant=(id,patch={})=>({id,sku:id===A?'FIX-32':id===B?'FIX-63':'HIDDEN-SKU',title:id===A?'32A option':id===B?'63A option':'Hidden option',selling_price:id===A?100:200,stock_qty:10,unit:'pcs',is_active:id!==H,attributes:{current:id===A?'32A':'63A'},...patch})
const product=(patch={})=>({id:'11111111-1111-4111-8111-111111111111',name:'Variant validation fixture',slug:'variant-fixture',status:'active',category_id:'c1',product_type:'standard',gst_rate:18,min_order_qty:1,featured:false,sort_order:0,short_description:'Isolated variant and quantity test data.',description:'Not a saleable product.',specifications:{VOLTAGE:'415V',CURRENT:'32A'},inclusions:[],applications:[],product_badges:[],warranty_months:null,lead_time_days:null,hsn_code:null,datasheet_url:null,installation_guide_url:null,categories:{name:'MCB',slug:'mcb',is_active:true},brands:null,product_images:[],product_variants:[variant(A),variant(B),variant(H)],...patch})
async function install(page,initial=product(),cart=[]){
 const state={product:structuredClone(initial),recheck:null,fail:false,hold:null,checks:0,writes:[]}
 await page.addInitScript(cart=>{localStorage.setItem('nis-cart',JSON.stringify(cart))},cart)
 await page.route('**/*.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url())
  if(!['GET','OPTIONS'].includes(req.method())){state.writes.push(req.url());await route.abort();throw new Error('Production write blocked by test fixture')}
  let rows=[]
  if(u.pathname.endsWith('/products')&&!u.searchParams.get('id')?.startsWith('neq.')){
   const checking=u.searchParams.get('id')?.startsWith('eq.')
   if(checking){state.checks++;if(state.hold)await state.hold;if(state.fail)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Isolated failure'})})}
   const p=checking&&state.recheck?state.recheck:state.product;rows=p?[structuredClone(p)]:[]
  }
  const single=req.headers().accept?.includes('vnd.pgrst.object')
  await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`},body:JSON.stringify(single?rows[0]||null:rows)})
 })
 return state
}
const panel=page=>page.locator('.p28Purchase')
const buy=page=>panel(page).getByRole('button',{name:'Add to Cart',exact:true})
const qty=page=>page.locator('#product-quantity')
const cartItems=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('nis-cart')||'[]'))
async function open(page,id=A,extra=''){await page.goto(`/product/variant-fixture?${id===null?'':`variant=${id}`}${extra}`);await expect(page.getByRole('heading',{name:'Variant validation fixture',exact:true})).toBeVisible()}
const saved=(q)=>({id:A,kind:'standard',productVariantId:A,name:'Saved fixture',variant:'32A',price:100,gstRate:18,qty:q})
test('active-only choices synchronize SKU, specification, price, unit and stock',async({page})=>{
 await install(page);await open(page,null);await expect(panel(page).getByText('Hidden option')).toHaveCount(0);await expect(panel(page).locator('.p28PriceCard')).toContainText('From ₹118.00')
 await panel(page).getByLabel('63A option',{exact:false}).check();await expect(panel(page).locator('.p28Meta')).toContainText('FIX-63');await expect(panel(page).locator('.p28PriceCard')).toContainText('₹236.00');await expect(qty(page)).toHaveValue('1')
 await page.getByRole('tab',{name:'Specifications'}).click();await expect(page.getByRole('tabpanel')).toContainText('63A');await expect(page.getByRole('tabpanel')).not.toContainText('32A')
})
test('invalid deep link allows explicitly choosing the sole active option',async({page})=>{
 await install(page,product({product_variants:[variant(A)]}));await open(page,H)
 await expect(panel(page)).toContainText('The option in this link is unavailable');await expect(panel(page).locator('.p28PriceCard')).not.toContainText('₹118.00')
 const option=panel(page).getByLabel('32A option',{exact:false});await option.check();await expect(option).toBeChecked();await expect(option).toBeFocused();await expect(buy(page)).toBeEnabled();await expect(panel(page).locator('.p28Meta')).toContainText('FIX-32')
})
test('Back and Forward restore selections and preserve campaign parameters',async({page})=>{
 await install(page);await open(page,A,'&utm_source=dealer');await qty(page).fill('4');await panel(page).getByLabel('63A option',{exact:false}).check();await expect(qty(page)).toHaveValue('1');await expect(page).toHaveURL(/utm_source=dealer/)
 await page.goBack();await expect(panel(page).locator('.p28Meta')).toContainText('FIX-32');await page.goForward();await expect(panel(page).locator('.p28Meta')).toContainText('FIX-63');await expect(panel(page).locator('.p28PriceCard')).toContainText('₹236.00')
})
test('minimum five and step two use six/eight; typed seven remains invalid',async({page})=>{
 await install(page,product({min_order_qty:5,product_variants:[variant(A,{stock_qty:9,attributes:{quantity_step:2}})]}));await open(page)
 await expect(qty(page)).toHaveValue('6');await expect(qty(page)).toHaveAttribute('min','6');expect(await qty(page).evaluate(el=>el.validity.stepMismatch)).toBe(false)
 await panel(page).getByRole('button',{name:'Increase quantity'}).click();await expect(qty(page)).toHaveValue('8');await expect(panel(page).getByRole('button',{name:'Increase quantity'})).toBeDisabled()
 await qty(page).fill('7');await expect(qty(page)).toHaveValue('7');await expect(buy(page)).toBeDisabled();await expect(page.locator('.p28Totals')).toHaveCount(0);await expect(page.locator('#product-quantity-error')).toContainText('increments of 2')
 await panel(page).getByRole('button',{name:'Decrease quantity'}).click();await expect(qty(page)).toHaveValue('6');await expect(buy(page)).toBeEnabled()
})
test('measured quantities use exact three-place calculation and published increment',async({page})=>{
 await install(page,product({product_variants:[variant(A,{unit:'m',selling_price:99.99,attributes:{quantity_step:.005}})]}));await open(page);await qty(page).fill('1.235')
 await expect(page.locator('.p28Totals')).toContainText('₹123.49');await expect(page.locator('.p28Totals')).toContainText('₹22.23');await expect(page.locator('.p28Totals')).toContainText('₹145.72');await expect(buy(page)).toBeEnabled();expect(await qty(page).evaluate(e=>e.validity.stepMismatch)).toBe(false)
 await qty(page).fill('1.2351');await expect(buy(page)).toBeDisabled();await expect(page.locator('.p28Totals')).toHaveCount(0)
})
for(const rate of [0,5,18])test(`published GST ${rate}% retained without fallback`,async({page})=>{
 await install(page,product({gst_rate:rate,product_variants:[variant(A)]}));await open(page);await qty(page).fill('3');await expect(page.locator('.p28Totals')).toContainText(`₹${(300*(1+rate/100)).toFixed(2)}`);await expect(panel(page).locator('.p28PriceCard')).toContainText(`${rate}% GST`)
})
for(const rate of [null,'bad'])test(`unknown GST ${rate} stays enquiry-only`,async({page})=>{
 await install(page,product({gst_rate:rate,product_variants:[variant(A)]}));await open(page);await expect(panel(page).locator('.p28PriceCard')).toContainText('Price on request');await expect(buy(page)).toHaveCount(0);await expect(panel(page).getByRole('link',{name:'Request price and availability'})).toBeVisible()
})
test('malformed published increment blocks purchase rather than choosing a default',async({page})=>{
 await install(page,product({product_variants:[variant(A,{attributes:{quantity_step:0}})]}));await open(page);await expect(buy(page)).toHaveCount(0);await expect(panel(page)).toContainText('quantity rules need confirmation');await expect(panel(page)).not.toContainText('NaN')
})
test('unknown stock and out-of-stock have distinct accurate states',async({page})=>{
 const s=await install(page,product({product_variants:[variant(A,{stock_qty:null})]}));await open(page);await expect(page.locator('.p28Stock')).toContainText('Stock needs confirmation');await expect(buy(page)).toBeDisabled()
 s.product.product_variants[0].stock_qty=0;await open(page);await expect(page.locator('.p28Stock')).toContainText('Out of stock');await expect(buy(page)).toBeDisabled()
})
test('all available stock in cart is not mislabeled as out-of-stock',async({page})=>{
 await install(page,product({product_variants:[variant(A,{stock_qty:6})]}),[saved(6)]);await open(page);await expect(page.locator('.p28Stock')).toContainText('All available stock is already in your cart');await expect(buy(page)).toBeDisabled();await expect(panel(page).getByRole('link',{name:'Review items already in your cart'})).toBeVisible()
})
test('existing cart stock limit applies to the selected addition',async({page})=>{
 await install(page,product({product_variants:[variant(A,{stock_qty:6})]}),[saved(5)]);await open(page);await qty(page).fill('2');await expect(buy(page)).toBeDisabled();await qty(page).fill('1');await buy(page).click();await expect.poll(async()=> (await cartItems(page))[0]?.qty).toBe(6);await expect(page.locator('.p28Stock')).toContainText('All available stock')
})
test('price/GST change on recheck updates screen but requires another deliberate click',async({page})=>{
 const state=await install(page,product({product_variants:[variant(A)]}));await open(page);state.recheck=product({gst_rate:0,product_variants:[variant(A,{selling_price:150})]})
 await buy(page).click();await expect(panel(page)).toContainText('Nothing was added');await expect(panel(page).locator('.p28PriceCard')).toContainText('₹150.00');await expect(panel(page).locator('.p28PriceCard')).toContainText('0% GST');expect(await cartItems(page)).toHaveLength(0)
 await buy(page).click();await expect.poll(async()=> (await cartItems(page)).length).toBe(1);const [i]=await cartItems(page);expect(i.price).toBe(150);expect(i.gstRate).toBe(0);expect(state.writes).toEqual([])
})
test('falling stock recheck refreshes the visible stock and retains editable quantity',async({page})=>{
 const s=await install(page,product({product_variants:[variant(A)]}));await open(page);await qty(page).fill('4');s.recheck=product({product_variants:[variant(A,{stock_qty:2})]})
 await buy(page).click();await expect(page.locator('.p28Stock')).toContainText('2 pcs in stock');await expect(qty(page)).toHaveValue('4');await expect(buy(page)).toBeDisabled();expect(await cartItems(page)).toHaveLength(0)
 await qty(page).fill('2');await buy(page).click();await expect.poll(async()=> (await cartItems(page))[0]?.qty).toBe(2)
})
test('inactive option discovered by recheck disappears and cannot reach cart',async({page})=>{
 const s=await install(page);await open(page);s.recheck=product({product_variants:[variant(A,{is_active:false}),variant(B)]})
 await buy(page).click();await expect(panel(page)).toContainText('The option in this link is unavailable');await expect(panel(page).getByLabel('32A option',{exact:false})).toHaveCount(0);await panel(page).getByLabel('63A option',{exact:false}).check();await expect(panel(page).locator('.p28Meta')).toContainText('FIX-63');expect(await cartItems(page)).toHaveLength(0)
})
test('network recheck failure keeps quantity and does not add anything',async({page})=>{
 // Supabase can retry 503 responses. Wait through the application's bounded ten-second request window.
 const s=await install(page);await open(page);await qty(page).fill('3');s.fail=true;await buy(page).click();await expect(panel(page)).toContainText('Could not verify',{timeout:15000});await expect(qty(page)).toHaveValue('3');await expect(buy(page)).toBeEnabled();expect(await cartItems(page)).toHaveLength(0)
})
test('a recheck for a departed selection cannot add the old SKU',async({page})=>{
 const s=await install(page);await open(page);await panel(page).getByLabel('63A option',{exact:false}).check();let release;s.hold=new Promise(r=>release=r)
 await buy(page).click();await expect.poll(()=>s.checks).toBe(1);await page.goBack();await expect(panel(page).locator('.p28Meta')).toContainText('FIX-32');release();await expect(buy(page)).toBeEnabled();expect(await cartItems(page)).toHaveLength(0)
})
test('zero-price option does not substitute another variant price',async({page})=>{
 await install(page,product({product_variants:[variant(A,{selling_price:0}),variant(B)]}));await open(page);await expect(panel(page).locator('.p28PriceCard')).toContainText('Price on request');await expect(panel(page).locator('.p28PriceCard')).not.toContainText('₹236.00');await expect(buy(page)).toHaveCount(0)
})
test('no active variants means enquiry only, without an invented selection',async({page})=>{
 await install(page,product({product_variants:[variant(H)]}));await open(page,null);await expect(panel(page).locator('.p28Variants')).toHaveCount(0);await expect(buy(page)).toHaveCount(0);await expect(panel(page).locator('.p28PriceCard')).toContainText('Price on request')
})
test('unsupported order total is blocked while the quantity remains editable',async({page})=>{
 await install(page,product({product_variants:[variant(A,{selling_price:1000000000,stock_qty:20})]}));await open(page);await qty(page).fill('10');await expect(buy(page)).toBeDisabled();await expect(page.locator('#product-quantity-error')).toContainText('unsupported order total');await expect(qty(page)).toHaveValue('10')
})
test('mobile price, quantity and purchase controls reflect the same selected option',async({page})=>{
 await page.setViewportSize({width:390,height:844});await install(page);await open(page);await panel(page).getByLabel('63A option',{exact:false}).check();await expect(page.locator('.p28MobileBar')).toContainText('₹236.00')
 await qty(page).fill('11');await expect(page.locator('.p28MobileBar').getByRole('button',{name:'Add to Cart'})).toBeDisabled();await qty(page).fill('2');await expect(page.locator('.p28MobileBar').getByRole('button',{name:'Add to Cart'})).toBeEnabled()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await panel(page).locator('.p28PriceCard').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/part283-mobile-variant.png'})
})

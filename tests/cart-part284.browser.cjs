const {test,expect}=require('@playwright/test')
const V='22222222-2222-4222-8222-222222222222'
const product=(patch={})=>({id:'11111111-1111-4111-8111-111111111111',name:'Cart handoff fixture',slug:'cart-fixture',status:'active',category_id:'c1',product_type:'standard',gst_rate:18,min_order_qty:1,featured:false,sort_order:0,short_description:'Isolated cart hand-off test data, not a saleable product.',description:'Isolated cart hand-off test data, not a saleable product.',specifications:{},inclusions:[],applications:[],product_badges:[],warranty_months:null,lead_time_days:null,hsn_code:null,datasheet_url:null,installation_guide_url:null,categories:{name:'MCB',slug:'mcb',is_active:true},brands:null,product_images:[],product_variants:[{id:V,sku:'CART-FIX',title:'Standard',selling_price:100,stock_qty:2,unit:'pcs',is_active:true,attributes:{}}],...patch})
async function install(page,initial=product(),cart=[]){
 const state={product:structuredClone(initial)}
 await page.addInitScript(cart=>{try{localStorage.setItem('nis-cart',JSON.stringify(cart))}catch{}},cart)
 await page.route('**/*.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url())
  if(!['GET','OPTIONS'].includes(req.method())){await route.abort();throw new Error('Production write blocked by test fixture')}
  let rows=[]
  if(u.pathname.endsWith('/products')&&!u.searchParams.get('id')?.startsWith('neq.'))rows=[structuredClone(state.product)]
  const single=req.headers().accept?.includes('vnd.pgrst.object')
  await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`},body:JSON.stringify(single?rows[0]||null:rows)})
 })
 return state
}
const panel=page=>page.locator('.p28Purchase')
const addToCart=page=>panel(page).getByRole('button',{name:'Add to Cart',exact:true})
const buyNow=page=>panel(page).getByRole('button',{name:'Buy Now',exact:true})
const cartOf=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('nis-cart')||'[]'))
async function open(page){await page.goto('/product/cart-fixture');await expect(page.getByRole('heading',{name:'Cart handoff fixture',exact:true})).toBeVisible()}

test('repeated Add to Cart clicks merge into a single persisted line, not a duplicate',async({page})=>{
 await install(page);await open(page)
 await addToCart(page).click();await expect(page.getByText('Added 1 pcs to cart.')).toBeVisible()
 await addToCart(page).click();await expect(page.getByText('Added 1 pcs to cart.')).toBeVisible()
 const cart=await cartOf(page)
 expect(cart.length).toBe(1);expect(cart[0].qty).toBe(2)
 // A same-tab client-side transition (not a fresh navigation) proves the merged
 // total is what CartProvider actually holds, not just what was last written to disk.
 await page.getByRole('link',{name:/Cart with/}).click()
 await expect(page.locator('.cartInfo')).toHaveCount(1);await expect(page.locator('.cartCommerce')).toContainText('2')
})

test('Buy Now adds the selection and opens checkout with it, without placing a real order',async({page})=>{
 await install(page);await open(page)
 await buyNow(page).click()
 await expect(page).toHaveURL(/\/checkout$/)
 await expect(page.getByRole('heading',{name:'Checkout'})).toBeVisible()
 const cart=await cartOf(page)
 expect(cart.length).toBe(1);expect(cart[0].qty).toBe(1);expect(cart[0].productVariantId).toBe(V)
})

test('cart persists across reload and a malformed saved line is dropped instead of breaking the page',async({page})=>{
 const corrupt=[
  {id:'broken-gst',kind:'standard',name:'Broken GST line',variant:'x',price:100,qty:1,gstRate:'eighteen'},
  {id:'broken-custom',kind:'custom',name:'Incomplete build',variant:'custom',price:500,qty:1},
  {id:V,kind:'standard',productVariantId:V,name:'Cart handoff fixture',variant:'Standard',price:100,gstRate:18,qty:1}
 ]
 await install(page,product(),corrupt)
 await page.goto('/cart')
 await expect(page.locator('.cartInfo')).toHaveCount(1)
 await expect(page.locator('.cartInfo')).toContainText('Cart handoff fixture')
 await page.reload();await expect(page.locator('.cartInfo')).toHaveCount(1);await expect(page.locator('.cartInfo')).toContainText('Cart handoff fixture')
})

test('two tabs sharing one cart converge on the true remaining stock instead of overselling',async({page,context})=>{
 await install(page);await open(page)
 const page2=await context.newPage();await install(page2);await page2.goto('/product/cart-fixture');await expect(page2.getByRole('heading',{name:'Cart handoff fixture',exact:true})).toBeVisible()
 await addToCart(page).click();await expect(page.getByText('Added 1 pcs to cart.')).toBeVisible()
 // Tab 2 never reloads, but its own cart state (and therefore its stock math) must
 // pick up tab 1's write; it should now refuse the full stock and only offer what remains.
 await expect(panel(page2).locator('.p28Stock')).toContainText('1 already in cart')
 await expect(panel(page2).locator('#product-quantity')).toHaveValue('1')
 await panel(page2).locator('#product-quantity').fill('2')
 await expect(panel(page2).locator('#product-quantity-error')).toContainText(/stock/i)
 await expect(addToCart(page2)).toBeDisabled()
 await panel(page2).locator('#product-quantity').fill('1')
 await addToCart(page2).click();await expect(page2.getByText('Added 1 pcs to cart.')).toBeVisible()
 const cart=await cartOf(page)
 expect(cart.length).toBe(1);expect(cart[0].qty).toBe(2)
 await page2.close()
})

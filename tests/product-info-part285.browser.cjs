const {test,expect}=require('@playwright/test')
const V='22222222-2222-4222-8222-222222222222'
const related1='55555555-5555-4555-8555-555555555555'
function baseProduct(patch={}){
  return {id:'11111111-1111-4111-8111-111111111111',name:'Info fixture MCB',slug:'info-fixture',status:'active',category_id:'c1',product_type:'standard',gst_rate:18,min_order_qty:1,featured:false,sort_order:0,
    short_description:'Isolated product-information test fixture, not a saleable product.',description:null,
    specifications:{},inclusions:[],applications:[],product_badges:[],warranty_months:null,lead_time_days:null,hsn_code:null,datasheet_url:null,installation_guide_url:null,
    categories:{name:'MCB',slug:'mcb',is_active:true},brands:null,product_images:[],
    product_variants:[{id:V,sku:'INFO-32',title:'32A option',selling_price:100,stock_qty:10,unit:'pcs',is_active:true,attributes:{}}],
    ...patch}
}
function relatedProduct(id,patch={}){
  return {id,name:'Related fixture',slug:'related-fixture-'+id.slice(0,8),status:'active',category_id:'c1',product_type:'standard',gst_rate:18,min_order_qty:1,featured:false,sort_order:0,
    short_description:'',description:null,specifications:{},inclusions:[],applications:[],product_badges:[],warranty_months:null,lead_time_days:null,hsn_code:null,datasheet_url:null,installation_guide_url:null,
    categories:{name:'MCB',slug:'mcb',is_active:true},brands:null,product_images:[],
    product_variants:[{id:id+'-v',sku:'REL',title:'Standard',selling_price:50,stock_qty:5,unit:'pcs',is_active:true,attributes:{}}],
    ...patch}
}
async function install(page,{product=baseProduct(),related=[]}={}){
  const state={relatedRequests:[]}
  await page.route('**/*.supabase.co/**',async route=>{
    const req=route.request(),u=new URL(req.url())
    if(!['GET','OPTIONS'].includes(req.method())){await route.abort();throw new Error('Unexpected write in fixture test: '+req.url())}
    let rows=[]
    if(u.pathname.endsWith('/products')){
      const idParam=u.searchParams.get('id')
      if(idParam?.startsWith('neq.')){state.relatedRequests.push(u.toString());rows=related.map(r=>structuredClone(r))}
      else rows=[structuredClone(product)]
    }
    const single=req.headers().accept?.includes('vnd.pgrst.object')
    await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`},body:JSON.stringify(single?rows[0]||null:rows)})
  })
  return state
}
async function open(page){await page.goto('/product/info-fixture');await expect(page.getByRole('heading',{name:'Info fixture MCB',exact:true})).toBeVisible()}

test('unpublished warranty, lead time, specifications, inclusions and documents show as unpublished, never guessed',async({page})=>{
  await install(page);await open(page)
  await expect(page.locator('.p28Meta')).not.toContainText('Warranty')
  await expect(page.locator('.p28Meta')).not.toContainText('lead time')
  await page.getByRole('tab',{name:'Specifications'}).click()
  await expect(page.getByRole('tabpanel')).toContainText('No structured specifications have been published.')
  await page.getByRole('tab',{name:'In the box'}).click()
  await expect(page.getByRole('tabpanel')).toContainText('Package contents have not been published')
  await page.getByRole('tab',{name:'Downloads'}).click()
  await expect(page.getByRole('tabpanel')).toContainText('No datasheet or installation guide has been published')
  await expect(page.getByRole('tab',{name:/Downloads/})).not.toContainText('(')
  const body=await page.locator('main').innerText()
  for(const guess of ['IP65','Solar Ready','EPC Ready','Residential rooftop'])expect(body).not.toContain(guess)
})

test('published warranty, lead time, HSN, specifications and inclusions render exactly what was published',async({page})=>{
  await install(page,{product:baseProduct({warranty_months:12,lead_time_days:5,hsn_code:'85369090',specifications:{Voltage:'415V'},inclusions:['1x MCB','User manual'],
    product_variants:[{id:V,sku:'INFO-32',title:'32A option',selling_price:100,stock_qty:10,unit:'pcs',is_active:true,attributes:{Current:'32A'}}]})})
  await open(page)
  await expect(page.locator('.p28Meta')).toContainText('Warranty: 12 months')
  await expect(page.locator('.p28Meta')).toContainText('Published lead time: 5 days')
  await page.getByRole('tab',{name:'Specifications'}).click()
  const specs=page.getByRole('tabpanel')
  await expect(specs).toContainText('Voltage')
  await expect(specs).toContainText('415V')
  await expect(specs).toContainText('Current')
  await expect(specs).toContainText('32A')
  await expect(specs).toContainText('85369090')
  await page.getByRole('tab',{name:'In the box'}).click()
  await expect(page.getByRole('tabpanel')).toContainText('1x MCB')
  await expect(page.getByRole('tabpanel')).toContainText('User manual')
})

test('a variant attribute overrides only the matching specification key, not the whole table',async({page})=>{
  await install(page,{product:baseProduct({specifications:{Voltage:'415V',Poles:'2'},
    product_variants:[{id:V,sku:'INFO-32',title:'32A option',selling_price:100,stock_qty:10,unit:'pcs',is_active:true,attributes:{Voltage:'240V'}}]})})
  await open(page)
  await page.getByRole('tab',{name:'Specifications'}).click()
  const specs=page.getByRole('tabpanel')
  await expect(specs).toContainText('240V')
  await expect(specs).not.toContainText('415V')
  await expect(specs).toContainText('Poles')
  await expect(specs).toContainText('2')
})

test('safe document links render; an unsafe scheme is dropped instead of being linked',async({page})=>{
  await install(page,{product:baseProduct({datasheet_url:'https://cdn.example.com/fixture-datasheet.pdf',installation_guide_url:'javascript:alert(1)'})})
  await open(page)
  await page.getByRole('tab',{name:/Downloads/}).click()
  const panel=page.getByRole('tabpanel')
  const datasheet=panel.getByRole('link',{name:/Product datasheet/i})
  await expect(datasheet).toBeVisible()
  await expect(datasheet).toHaveAttribute('href','https://cdn.example.com/fixture-datasheet.pdf')
  await expect(datasheet).toHaveAttribute('target','_blank')
  await expect(datasheet).toHaveAttribute('rel',/noopener/)
  await expect(panel.getByRole('link',{name:/Installation guide/i})).toHaveCount(0)
  await expect(panel.locator('a[href^="javascript:"]')).toHaveCount(0)
})

test('related products query asks for the same category, excludes the current item, and renders what is returned',async({page})=>{
  const state=await install(page,{product:baseProduct(),related:[relatedProduct(related1,{name:'Related same category'})]})
  await open(page)
  const relatedSection=page.locator('.p28Related')
  await expect(relatedSection.getByText('Related same category')).toBeVisible()
  expect(state.relatedRequests.length).toBeGreaterThan(0)
  const requested=new URL(state.relatedRequests[0])
  expect(requested.searchParams.get('category_id')).toBe('eq.c1')
  expect(requested.searchParams.get('id')).toBe(`neq.${baseProduct().id}`)
  expect(requested.searchParams.get('status')).toBe('eq.active')
})

test('no related products published renders no related section',async({page})=>{
  await install(page,{product:baseProduct(),related:[]})
  await open(page)
  await expect(page.locator('.p28Related')).toHaveCount(0)
})

test('bulk enquiry link carries the exact selected SKU and quantity for a second variant',async({page})=>{
  await install(page,{product:baseProduct({product_variants:[
    {id:V,sku:'INFO-32',title:'32A option',selling_price:100,stock_qty:10,unit:'pcs',is_active:true,attributes:{}},
    {id:V+'-b',sku:'INFO-63',title:'63A option',selling_price:200,stock_qty:4,unit:'pcs',is_active:true,attributes:{}}
  ]})})
  await open(page)
  await page.getByLabel('63A option',{exact:false}).check()
  await page.locator('#product-quantity').fill('3')
  const link=page.getByRole('link',{name:/Bulk \/ project enquiry/})
  await expect(link).toHaveAttribute('href',new RegExp(`variant=${V}-b`))
  await expect(link).toHaveAttribute('href',/quantity=3/)
})

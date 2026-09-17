// Read-only release gate. No orders, messages or catalogue writes are created.
// Run after phase B. Buyer/admin JWTs are optional environment variables;
// never paste them into command arguments or commit them.
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://cdtbwuagqxkknkccpkcr.supabase.co'
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_M81dfHhhhIn5jIUkSlDNVg_ml07slT-'
const tables=[['product_variants','variant'],['components','component'],['enclosures','enclosure']]
const failures=[]
async function request(path,jwt,body){
  const headers={apikey:key,...(jwt?{Authorization:`Bearer ${jwt}`}:{})}
  if(body)headers['Content-Type']='application/json'
  const response=await fetch(`${url}/rest/v1/${path}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)})
  return {status:response.status,data:await response.json()}
}
function check(ok,label){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failures.push(label)}
try{
  for(const [label,jwt]of [['anonymous',null],...(process.env.NIS_TEST_BUYER_JWT?[['buyer',process.env.NIS_TEST_BUYER_JWT]]:[])]){
    for(const [table]of tables){
      const safe=await request(`${table}?select=id,selling_price&limit=1`,jwt)
      check(safe.status===200&&Array.isArray(safe.data),`${label}: ${table} selling-price query works`)
      for(const projection of ['cost_price','*']){
        const blocked=await request(`${table}?select=${encodeURIComponent(projection)}&limit=1`,jwt)
        check([400,401,403].includes(blocked.status)&&blocked.data?.code==='42501',`${label}: ${table} ${projection==='*'?'wildcard':'cost'} query denied`)
      }
    }
    const blocked=await request('rpc/admin_catalogue_costs',jwt,{p_item_type:'variant',p_item_ids:[],p_module:'products'})
    check([400,401,403].includes(blocked.status)&&blocked.data?.code==='42501',`${label}: admin cost endpoint denied`)
  }
  if(process.env.NIS_TEST_ADMIN_JWT){
    for(const [table,kind]of tables){
      const safe=await request(`${table}?select=id&limit=1`,process.env.NIS_TEST_ADMIN_JWT)
      if(safe.status!==200||!safe.data?.[0]?.id){check(false,`admin: ${table} test item available`);continue}
      const allowed=await request('rpc/admin_catalogue_costs',process.env.NIS_TEST_ADMIN_JWT,{p_item_type:kind,p_item_ids:[safe.data[0].id],p_module:'pricing'})
      check(allowed.status===200&&allowed.data?.length===1&&Object.hasOwn(allowed.data[0],'cost_price'),`admin: ${table} protected cost lookup works`)
    }
  }
  if(!process.env.NIS_TEST_BUYER_JWT)console.log('NOT RUN authenticated buyer HTTP checks (no test token supplied).')
  if(!process.env.NIS_TEST_ADMIN_JWT)console.log('NOT RUN authenticated admin HTTP checks (no test token supplied).')
}catch(error){console.error('Verification could not complete:',error instanceof Error?error.message:'request failed');process.exitCode=1}
if(failures.length)process.exitCode=1

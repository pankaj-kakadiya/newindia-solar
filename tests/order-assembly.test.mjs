import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migrationUrl=new URL('../supabase/migrations/20260919153000_start_order_assembly_jobs.sql',import.meta.url)
const orderPageUrl=new URL('../app/admin/orders/[id]/page.tsx',import.meta.url)

test('order assembly RPC is authorized, idempotent and recipe-backed',async()=>{
  const sql=await readFile(migrationUrl,'utf8')
  assert.match(sql,/has_admin_permission\('production','create'\)/)
  assert.match(sql,/production_jobs_one_per_order_item/)
  assert.match(sql,/where order_item_id=p_order_item_id/)
  assert.match(sql,/where variant_id=oi\.variant_id and status='active'/)
  assert.match(sql,/manufacturing_recipe_costs\(r\.id\)/)
  assert.match(sql,/insert into public\.production_bom_items/)
  assert.match(sql,/insert into public\.inventory_reservations/)
  assert.match(sql,/grant execute on function public\.start_order_item_assembly\(uuid\) to authenticated/)
})

test('planned jobs can be created before stock and reserved atomically later',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260919183500_allow_planned_assembly_jobs.sql',import.meta.url),'utf8')
  assert.match(sql,/reserve_production_job_materials/)
  assert.match(sql,/Validate the whole BOM first so reservation remains all-or-nothing/)
  assert.doesNotMatch(sql,/Only % unit\(s\) can be assembled/)
  assert.match(sql,/if v_cost\.buildable_qty>=p_quantity then perform public\.reserve_production_job_materials/)
  assert.match(sql,/if v_cost\.buildable_qty>=oi\.quantity then perform public\.reserve_production_job_materials/)
})

test('order page starts or opens the exact assembly job',async()=>{
  const source=await readFile(orderPageUrl,'utf8')
  assert.match(source,/rpc\('start_order_item_assembly'/)
  assert.match(source,/Create Assembly/)
  assert.match(source,/\/admin\/production\?job=\$\{data\}/)
  assert.match(source,/href=\{`\/admin\/production\?job=\$\{job\.id\}`\}/)
})

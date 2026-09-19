import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {calculateGstBreakdown,calculateLiveManufacturingCost} from '../lib/manufacturing-costs.ts'

test('calculates GST-exclusive, GST amount and GST-inclusive values', () => {
  assert.deepEqual(calculateGstBreakdown(1000,18), {
    exclusive:1000,
    gst_rate:18,
    gst_amount:180,
    inclusive:1180,
  })
  assert.equal(calculateGstBreakdown('2500','12').inclusive,2800)
})

test('calculates live component and finished-product cost with wastage and extras', () => {
  const result = calculateLiveManufacturingCost([
    {item_type:'component',item_id:'mcb',quantity:2,wastage_percent:5},
    {item_type:'variant',item_id:'dcdb',quantity:1,wastage_percent:0},
  ], {
    component:[{id:'mcb',name:'AC MCB',cost_price:100,stock_qty:20,unit:'pcs'}],
    enclosure:[],
    variant:[{id:'dcdb',title:'2 In 2 Out',products:{name:'DCDB'},cost_price:500,stock_qty:4,unit:'pcs'}],
  }, {labour_cost:100,overhead_cost:50,packaging_cost:25,target_margin_percent:25})

  assert.equal(result.material_cost,710)
  assert.equal(result.total_cost,885)
  assert.equal(result.recommended_selling_price,1180)
  assert.equal(result.missing_cost_count,0)
})

test('distinguishes a missing cost from a valid zero cost', () => {
  const catalogues = {
    component:[{id:'missing',name:'Missing',cost_price:null},{id:'free',name:'Free',cost_price:0}],
    enclosure:[], variant:[],
  }
  const result = calculateLiveManufacturingCost([
    {item_type:'component',item_id:'missing',quantity:1,wastage_percent:0},
    {item_type:'component',item_id:'free',quantity:1,wastage_percent:0},
  ], catalogues, {labour_cost:0,overhead_cost:0,packaging_cost:0,target_margin_percent:0})
  assert.equal(result.missing_cost_count,1)
  assert.equal(result.lines[1].missing_cost,false)
})

test('calculates fractional cable quantities in metres instead of pieces', () => {
  const result = calculateLiveManufacturingCost([
    {item_type:'component',item_id:'cable',quantity:1.75,wastage_percent:10},
  ], {
    component:[{id:'cable',name:'4 sq mm cable',cost_price:40,stock_qty:100,unit:'mtr'}],
    enclosure:[], variant:[],
  }, {labour_cost:0,overhead_cost:0,packaging_cost:0,target_margin_percent:0})
  assert.equal(result.lines[0].unit,'mtr')
  assert.ok(Math.abs(result.lines[0].required_qty-1.925)<1e-9)
  assert.ok(Math.abs(result.material_cost-77)<1e-9)
})

test('recipe migration grants production cost access and atomically syncs product cost', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260919125742_fix_manufacturing_recipe_cost_sync.sql',import.meta.url),'utf8')
  assert.match(migration,/p_module in \([^)]*'production'/)
  assert.match(migration,/update public\.product_variants\s+set cost_price=v_total_cost/)
  assert.match(migration,/Every selected BOM material must have a cost price/)
})

test('meter-unit migration keeps recipe and production units aligned with the material master', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260919203000_meter_based_material_units.sql',import.meta.url),'utf8')
  assert.match(migration,/where lower\(trim\(coalesce\(category,''\)\)\)='solar cable'/)
  assert.match(migration,/before insert or update of component_id,enclosure_id,variant_id,unit/)
  assert.match(migration,/update public\.production_bom_items/)
})

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const T=id(1),E=id(2),BUYER=id(3),OTHER=id(4),M=id(30),EXTRA=id(31);
const picks=[{value_id:id(20),quantity:1},{value_id:id(21),quantity:1},{value_id:id(23),quantity:1}];
const migration=new URL('../supabase/migrations/20260917024057_secure_custom_configuration_pricing.sql',import.meta.url);

test('custom configuration security on isolated PostgreSQL',async t=>{
  const db=new PGlite();
  await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(migration,'utf8'));
  // Re-run the checkout and production-snapshot scenarios after Step 2 ACLs.
  const migrationDir=new URL('../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(migrationDir)).sort())if(/_(admin_catalogue_cost_access|restrict_catalogue_cost_reads)\.sql$/.test(name))await db.exec(await readFile(new URL(name,migrationDir),'utf8'));
  await db.exec(`
    insert into configurator_templates(id,type,name,slug,base_assembly_charge) values('${T}','acdb','Test ACDB','test-acdb',10);
    insert into enclosures(id,name,selling_price,cost_price,low_stock_threshold) values('${E}','Test enclosure',200,90,0);
    insert into components(id,category,name,selling_price,cost_price,gst_rate,low_stock_threshold) values('${M}','AC MCB','Test MCB',100,40,5,0),('${EXTRA}','Terminal','Test terminal',7,3,0,0);
    insert into configurator_options(id,template_id,option_key,label,option_type,required,allow_quantity,min_quantity,max_quantity) values
      ('${id(10)}','${T}','enclosure','Enclosure','enclosure',true,false,1,1),
      ('${id(11)}','${T}','protection','MCB','component',true,true,1,5),
      ('${id(12)}','${T}','voltage','Voltage','select',true,false,1,1),
      ('${id(13)}','${T}','extras','Extras','multi',false,true,1,10);
    insert into configurator_option_values(id,option_id,label,value,enclosure_id) values('${id(20)}','${id(10)}','Enclosure','box','${E}');
    insert into configurator_option_values(id,option_id,label,value,component_id) values
      ('${id(21)}','${id(11)}','MCB','mcb','${M}'),('${id(22)}','${id(11)}','Alternate MCB','alt','${M}'),('${id(24)}','${id(13)}','Terminal','terminal','${EXTRA}');
    insert into configurator_option_values(id,option_id,label,value) values('${id(23)}','${id(12)}','230V','230');
    insert into configurator_layout_approvals(template_id,enclosure_id,fingerprint,reviewed_by,review_note)
      values('${T}','${E}',nis_configuration_fingerprint('${T}','${E}'),'${OTHER}','Synthetic test approval');
  `);
  const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
  async function buyer(who=BUYER){await q("select set_config('request.jwt.claim.sub',$1,true)",[who]);await db.exec('set local role authenticated');}
  async function admin(sql,args=[]){await db.exec('reset role');return q(sql,args);}
  async function approve(){await admin('update configurator_layout_approvals set fingerprint=nis_configuration_fingerprint(template_id,enclosure_id)');}
  async function save(selections=picks,preview={}){return (await q('select public.save_visual_configuration($1,$2,$3,$4) as result',[T,'Test build',JSON.stringify(selections),JSON.stringify(preview)]))[0].result;}
  async function cart(config,owner=BUYER,quantity=1){const cartId=(await admin('insert into carts(user_id) values($1) returning id',[owner]))[0].id;await admin('insert into cart_items(cart_id,custom_configuration_id,quantity,unit_price) values($1,$2,$3,1)',[cartId,config,quantity]);return cartId;}
  async function order(cartId){return (await q("select place_order_from_cart($1,'{}','{}','{}',false,null,null,null,'bank_transfer',null) as result",[cartId]))[0].result;}
  async function rejects(fn,pattern){await db.exec('savepoint attempted');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to attempted; release attempted');}}
  async function scenario(name,fn){await t.test(name,async()=>{await db.exec('begin');try{await fn();}finally{await db.exec('rollback');}});}
  try{
    await scenario('valid approved configuration uses source prices, line tax and assembly',async()=>{
      await buyer();const s=await save();assert.equal(s.subtotal,300);assert.equal(s.gst_amount,42.8);assert.equal(s.final_price,352.8);assert.equal(s.pricing_version,1);
      assert.equal(s.bom_snapshot.length,2);assert.equal(JSON.stringify(s).includes('cost_price'),false);
      assert.equal((await q('select count(*)::int n from custom_configuration_selections'))[0].n,3);
    });
    await scenario('legacy save RPC uses the same validated pricing engine',async()=>{
      await buyer();const s=(await q('select save_custom_configuration($1,$2,$3::uuid[]) result',[T,'Legacy',picks.map(x=>x.value_id)]))[0].result;assert.equal(s.final_price,352.8);
    });
    await scenario('valid DCDB uses the same authenticated server pricing path',async()=>{
      await admin("update configurator_templates set type='dcdb'");await admin("update components set category='DC MCB' where id=$1",[M]);await approve();await buyer();assert.equal((await save()).final_price,352.8);
    });
    await scenario('buyer cannot directly insert a configuration, even with column grants',async()=>{
      await buyer();await rejects(()=>q('insert into custom_configurations(user_id,template_id,final_price) values($1,$2,1)',[BUYER,T]),/permission denied/);
    });
    await scenario('buyer cannot alter price, BOM, owner, status, approval version or selections',async()=>{
      await buyer();const s=await save();
      for(const [field,value]of [['final_price','1'],['subtotal','1'],['bom_snapshot',"'[]'::jsonb"],['selected_options',"'{}'::jsonb"],['pricing_version','0'],['status',"'approved'"],['user_id',`'${OTHER}'::uuid`]])await rejects(()=>q(`update custom_configurations set ${field}=${value} where id=$1`,[s.id]),/permission denied/);
      await rejects(()=>q('delete from custom_configurations where id=$1',[s.id]),/permission denied/);
    });
    await scenario('buyer cannot insert, update or delete selection snapshots',async()=>{
      await buyer();const s=await save();await rejects(()=>q('update custom_configuration_selections set quantity=999 where configuration_id=$1',[s.id]),/permission denied/);
      await rejects(()=>q('delete from custom_configuration_selections where configuration_id=$1',[s.id]),/permission denied/);
      await rejects(()=>q('insert into custom_configuration_selections(configuration_id,option_id,option_value_id) values($1,$2,$3)',[s.id,id(10),id(20)]),/permission denied/);
    });
    await scenario('private pricing helpers are not buyer-callable',async()=>{
      await buyer();await rejects(()=>q('select nis_private.price_custom_configuration($1,$2)',[T,JSON.stringify(picks)]),/permission denied/);
    });
    await scenario('anonymous cannot call save or order RPCs',async()=>{
      await db.exec('set local role anon');await rejects(()=>save(),/permission denied/);await rejects(()=>order(id(90)),/permission denied/);
    });
    await scenario('authenticated role without a user ID is rejected',async()=>{
      await buyer('');await rejects(()=>save(),/Authentication required/);
    });
    await scenario('restricted staff cannot bypass configurator create permission through RPC',async()=>{
      await admin("select set_config('test.staff','true',true)");await buyer();await rejects(()=>save(),/create permission required/);
    });
    await scenario('permitted staff can save through RPC but cannot directly forge prices',async()=>{
      await admin("select set_config('test.staff','true',true),set_config('test.can_create','true',true)");await buyer();const s=await save();assert.equal(s.final_price,352.8);await rejects(()=>q('update custom_configurations set final_price=1 where id=$1',[s.id]),/permission denied/);
    });
    for(const [label,input,pattern]of [
      ['null selections',null,/array/],['non-array selections',{},/array/],['empty selections',[],/selection count/],
      ['missing required group',picks.slice(0,2),/Required/],['unknown value',[...picks,{value_id:id(999),quantity:1}],/Invalid or inactive/],
      ['duplicate value',[...picks,picks[1]],/Duplicate/],['two values in a single group',[...picks,{value_id:id(22),quantity:1}],/only one/],
      ...[0,-1,1.5,6,'1',null].map(qty=>[`invalid quantity ${JSON.stringify(qty)}`,[picks[0],{...picks[1],quantity:qty},picks[2]],/quantity|Quantity/]),
      ['multiple enclosures',[{...picks[0],quantity:2},...picks.slice(1)],/Quantity/]
    ])await scenario(label,async()=>{await buyer();await rejects(()=>save(input),pattern);});
    for(const [label,sql,pattern]of [
      ['inactive template',`update configurator_templates set is_active=false`,/inactive/],
      ['quotation-only template',`update configurator_templates set preview_settings='{"commerce_mode":"quote"}'`,/quotation/],
      ['inactive option',`update configurator_option_values set is_active=false where id='${id(21)}'`,/inactive/],
      ['inactive component',`update components set is_active=false where id='${M}'`,/unavailable/],
      ['inactive enclosure',`update enclosures set is_active=false`,/unavailable/],
      ['unpriced component',`update components set selling_price=0 where id='${M}'`,/quotation/],
      ['quote-required component',`update components set visual_settings='{"pricing_status":"quote_required"}' where id='${M}'`,/quotation/],
      ['zero enclosure price',`update enclosures set selling_price=0`,/quotation/],
      ['negative final component price',`update configurator_option_values set price_adjustment=-101 where id='${id(21)}'`,/pricing/],
      ['negative assembly',`update configurator_templates set base_assembly_charge=-1`,/pricing/],
      ['AC/DC mismatch',`update components set category='DC MCB' where id='${M}'`,/incompatible/],
      ['unsupported enclosure',`update enclosures set supported_types=array['dcdb']`,/does not support/],
      ['missing approval',`delete from configurator_layout_approvals`,/technical approval/],
      ['outdated approval',`update components set specifications='{"rating":"changed"}' where id='${M}'`,/technical approval/],
      ['below minimum',`update configurator_options set min_quantity=2 where id='${id(11)}'`,/Quantity/]
    ])await scenario(label,async()=>{await admin(sql);await buyer();await rejects(()=>save(),pattern);});
    await scenario('deny rules override layout approval',async()=>{
      await admin('insert into configurator_component_compatibility(template_id,component_id,allowed) values($1,$2,false)',[T,M]);await approve();await buyer();await rejects(()=>save(),/compatibility/);
    });
    await scenario('component rule quantity limits are enforced',async()=>{
      await admin('insert into configurator_component_compatibility(template_id,component_id,min_qty,max_qty) values($1,$2,1,1)',[T,M]);await approve();await buyer();await rejects(()=>save([picks[0],{...picks[1],quantity:2},picks[2]]),/compatibility/);
    });
    await scenario('forged preview cannot grant approval or set price',async()=>{
      await admin('delete from configurator_layout_approvals');await buyer();await rejects(()=>save(picks,{approved:true,final_price:1,approval_fingerprint:'fake'}),/technical approval/);
    });
    await scenario('zero component GST is preserved',async()=>{
      await admin('update components set gst_rate=0 where id=$1',[M]);await approve();await buyer();const s=await save();assert.equal(s.gst_amount,37.8);
    });
    await scenario('buyer B cannot read or order buyer A configuration',async()=>{
      await buyer();const s=await save();const cid=await cart(s.id,OTHER);await buyer(OTHER);assert.equal((await q('select id from custom_configurations where id=$1',[s.id])).length,0);await rejects(()=>order(cid),/not found/);
    });
    await scenario('valid custom order is priced again, ignoring cart unit_price',async()=>{
      await buyer();const s=await save();const cid=await cart(s.id,BUYER,2);await buyer();const o=await order(cid);assert.equal(o.grand_total,705.6);assert.equal(o.payment_status,'pending');
      const rows=await admin('select unit_price,tax_amount,line_total,configuration_snapshot from order_items where order_id=$1',[o.order_id]);assert.equal(Number(rows[0].unit_price),310);assert.equal(Number(rows[0].tax_amount),85.6);assert.equal(Number(rows[0].line_total),705.6);assert.equal(JSON.stringify(rows[0]).includes('cost_price'),false);
      const costs=await admin('select component_name,unit_cost_snapshot from production_bom_items order by component_name');assert.equal(costs.length,2);assert.deepEqual(costs.map(x=>Number(x.unit_cost_snapshot)),[40,90]);
      await buyer();await rejects(()=>order(cid),/empty/);
    });
    for(const [label,sql,pattern]of [
      ['legacy untrusted saved row','update custom_configurations set pricing_version=0',/rebuilt/],
      ['tampered saved totals','update custom_configurations set subtotal=1,final_price=1',/changed/],
      ['tampered BOM',"update custom_configurations set bom_snapshot='[]'",/changed/],
      ['revoked template','update configurator_templates set is_active=false',/inactive/],
      ['revoked approval','delete from configurator_layout_approvals',/technical approval/],
      ['price changed after save',`update components set selling_price=101 where id='${M}'`,/changed/]
    ])await scenario(`checkout rejects ${label} and rolls back the entire order`,async()=>{
      await buyer();const s=await save();const cid=await cart(s.id);await admin(sql);await buyer();await rejects(()=>order(cid),pattern);
      assert.equal((await admin('select count(*)::int n from orders'))[0].n,0);assert.equal((await admin('select count(*)::int n from payments'))[0].n,0);assert.equal((await admin('select count(*)::int n from cart_items'))[0].n,1);
    });
    await scenario('standard order branch still prices from the variant',async()=>{
      await admin("insert into products(id,name,slug,status) values($1,'Fixture product','fixture','active')",[id(70)]);await admin("insert into product_variants(id,product_id,sku,title,selling_price,low_stock_threshold) values($1,$2,'TEST','Fixture',10,0)",[id(71),id(70)]);
      const cid=(await admin('insert into carts(user_id) values($1) returning id',[BUYER]))[0].id;await admin('insert into cart_items(cart_id,variant_id,quantity,unit_price) values($1,$2,2,1)',[cid,id(71)]);await buyer();const o=await order(cid);assert.equal(o.grand_total,23.6);
    });
  }finally{await db.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BUYER=id(1),ADMIN=id(2),STAFF=id(3),SUSPENDED=id(4),UNKNOWN=id(5);
const tables=[['product_variants','variant','products'],['components','component','components'],['enclosures','enclosure','inventory']];
const scopes={variant:['products','pricing','inventory','purchasing','workflows'],component:['components','configurator','pricing','inventory','purchasing','workflows'],enclosure:['configurator','pricing','inventory','purchasing','workflows']};
const migrations=new URL('../supabase/migrations/',import.meta.url);
const migration=async suffix=>readFile(new URL((await readdir(migrations)).find(name=>name.endsWith(suffix)),migrations),'utf8');

test('catalogue cost authorization on isolated PostgreSQL',async t=>{
  const db=new PGlite();
  await db.exec(await readFile(new URL('./fixtures/custom-pricing-schema.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('./fixtures/catalogue-cost-permissions.sql',import.meta.url),'utf8'));
  await db.exec(`
    insert into profiles values ('${BUYER}','customer',null,'active'),('${ADMIN}','admin',null,'active'),('${STAFF}','staff','catalogue','active'),('${SUSPENDED}','admin',null,'suspended');
    insert into admin_role_permissions values ('catalogue','products',true,true,true,false,false,false),('catalogue','components',true,true,true,false,false,false),('catalogue','inventory',true,true,true,false,false,false);
    insert into products(id,name,slug,status) values('${id(10)}','Synthetic product','synthetic','active');
    insert into product_variants(id,product_id,sku,title,selling_price,cost_price,low_stock_threshold) values('${id(20)}','${id(10)}','TEST','Test',100,37.25,0);
    insert into components(id,category,name,selling_price,cost_price,low_stock_threshold) values('${id(20)}','Terminal','Test',100,37.25,0);
    insert into enclosures(id,name,selling_price,cost_price,low_stock_threshold) values('${id(20)}','Test',100,37.25,0);
    insert into product_variants(id,product_id,sku,title,is_active,cost_price,low_stock_threshold,selling_price) values('${id(21)}','${id(10)}','PRIVATE','Inactive',false,81,0,100);
    insert into components(id,category,name,is_active,cost_price,low_stock_threshold,selling_price) values('${id(21)}','Terminal','Inactive',false,81,0,100);
    insert into enclosures(id,name,is_active,cost_price,low_stock_threshold,selling_price) values('${id(21)}','Inactive',false,81,0,100);
  `);
  await db.exec(await migration('_admin_catalogue_cost_access.sql'));
  await db.exec(await migration('_restrict_catalogue_cost_reads.sql'));
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
  async function role(who,dbRole='authenticated'){await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,true)",[who||'']);await db.exec(`set local role ${dbRole}`);}
  async function owner(sql,args=[]){await db.exec('reset role');return q(sql,args);}
  async function reject(fn,pattern=/permission denied|access required|permission required/){await db.exec('savepoint denied');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to denied; release denied');}}
  async function scenario(name,fn){await t.test(name,async()=>{await db.exec('begin');try{await fn();}finally{await db.exec('rollback');}});}
  const costs=(kind='variant',module='products',ids=[id(20)])=>q('select * from admin_catalogue_costs($1,$2::uuid[],$3)',[kind,ids,module]);
  try {
    for(const [table,kind,module] of tables){
      for(const [label,who,dbRole] of [['anonymous',null,'anon'],['buyer',BUYER,'authenticated']]){
        await scenario(`${label}: ${table} safe reads preserve active-row RLS`,async()=>{
          await role(who,dbRole);const rows=await q(`select id,selling_price from ${table}`);assert.equal(rows.length,1);assert.equal(Number(rows[0].selling_price),100);
        });
        await scenario(`${label}: ${table} blocks explicit, wildcard, whole-row, filter, sort and aggregate cost reads`,async()=>{
          await role(who,dbRole);
          for(const sql of [`select cost_price from ${table}`,`select * from ${table}`,`select to_jsonb(t) from ${table} t`,`select id from ${table} where cost_price>0`,`select id from ${table} order by cost_price`,`select sum(cost_price) from ${table}`])await reject(()=>q(sql));
          await reject(()=>costs(kind,module));
        });
      }
      await scenario(`${table}: inherited PUBLIC and explicit cost grants are removed`,async()=>{
        for(const roleName of ['anon','authenticated']){const [r]=await q('select has_column_privilege($1,$2,$3,$4) allowed',[roleName,table,'cost_price','select']);assert.equal(r.allowed,false);}
        const [r]=await q(`select count(*)::int n from ${table} where cost_price=37.25`);assert.equal(r.n,1);
      });
      await scenario(`${table}: active staff can read costs through their permitted module`,async()=>{
        await role(STAFF);const rows=await costs(kind,module,[id(20),id(21)]);assert.deepEqual(rows.map(r=>Number(r.cost_price)).sort((a,b)=>a-b),[37.25,81]);
        await reject(()=>q(`select cost_price from ${table}`));
      });
      await scenario(`${table}: authorized direct updates and inserts preserve costs without SELECT cost privilege`,async()=>{
        await role(STAFF);await q(`update ${table} set cost_price=42.50 where id=$1`,[id(20)]);
        assert.equal(Number((await costs(kind,module))[0].cost_price),42.5);
        const payload=table==='product_variants'?`product_id,sku,title` : table==='components'?`category,name`:'name';
        const values=table==='product_variants'?`'${id(10)}','NEW','New'`:table==='components'?`'Terminal','New'`:`'New'`;
        await q(`insert into ${table}(id,${payload},cost_price,low_stock_threshold,selling_price) values($1,${values},12,0,100)`,[id(22)]);
        assert.equal(Number((await costs(kind,module,[id(22)]))[0].cost_price),12);
      });
      await scenario(`${table}: buyer cannot change stored costs`,async()=>{
        await role(BUYER);await q(`update ${table} set cost_price=1 where id=$1`,[id(20)]);
        await role(ADMIN);assert.equal(Number((await costs(kind,module))[0].cost_price),37.25);
      });
    }
    await scenario('anonymous cannot execute endpoint even with an admin-shaped claim',async()=>{await role(ADMIN,'anon');await reject(()=>costs());});
    for(const who of [BUYER,SUSPENDED,UNKNOWN,null])await scenario(`reject unauthorized identity ${who||'missing'}`,async()=>{await role(who);await reject(()=>costs());});
    await scenario('staff without requested module permission is denied',async()=>{await role(STAFF);await reject(()=>costs('variant','pricing'));});
    await scenario('explicit deny overrides a staff role grant',async()=>{
      await q('insert into admin_user_permissions values($1,$2,$3,false)',[STAFF,'products','view']);await role(STAFF);await reject(()=>costs());
    });
    await scenario('permission changes take effect on the next request without refreshing the JWT',async()=>{
      await role(STAFF);assert.equal((await costs()).length,1);await owner('update admin_role_permissions set can_view=false');await role(STAFF);await reject(()=>costs());
    });
    await scenario('staff suspension immediately closes the endpoint',async()=>{
      await role(STAFF);assert.equal((await costs()).length,1);await owner("update profiles set staff_status='suspended' where id=$1",[STAFF]);await role(STAFF);await reject(()=>costs());
    });
    await scenario('admin can read each intentionally supported module and item scope',async()=>{
      await role(ADMIN);for(const [kind,modules]of Object.entries(scopes))for(const module of modules)assert.equal(Number((await costs(kind,module))[0].cost_price),37.25);
    });
    await scenario('unrelated or null scope cannot be used as a permission bypass',async()=>{
      await role(ADMIN);for(const [kind,module]of [['variant','dashboard'],['variant','configurator'],['enclosure','products'],['invalid','products'],[null,'products'],['variant',null]])await reject(()=>costs(kind,module),/Unsupported catalogue cost scope/);
    });
    await scenario('bounded lookup handles empty, duplicate, missing and null-cost items',async()=>{
      await q('update product_variants set cost_price=null where id=$1',[id(21)]);await role(ADMIN);
      assert.equal((await costs('variant','products',[])).length,0);
      assert.equal((await costs('variant','products',[id(20),id(20)])).length,1);
      assert.equal((await costs('variant','products',[id(99)])).length,0);
      assert.equal((await costs('variant','products',[id(21)]))[0].cost_price,null);
      await reject(()=>costs('variant','products',null),/at most 1000/);
      await reject(()=>costs('variant','products',[null]),/at most 1000/);
      await reject(()=>costs('variant','products',Array(1001).fill(id(20))),/at most 1000/);
    });
    await scenario('future columns are denied by default',async()=>{
      await q('alter table product_variants add column future_internal_value text');await role(BUYER);await reject(()=>q('select future_internal_value from product_variants'));
    });
  } finally {await db.close();}
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),vm=require('vm'),{PGlite}=require('@electric-sql/pglite');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/accounting-workspace.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,Intl,Date,Number,Error});
const {financialYearStart,paise,validateLines,csvCell}=exportsObject;
test('Indian financial year and exact monetary validation',()=>{
 assert.equal(financialYearStart('2026-02-01'),'2025-04-01');assert.equal(financialYearStart('2026-04-01'),'2026-04-01');assert.equal(paise('12.01'),1201);
 for(const value of ['-1','1.001','NaN','Infinity','1e3'])assert.throws(()=>paise(value));
 assert.equal(validateLines([{account_code:'A',debit:'0.30',credit:''},{account_code:'B',debit:'',credit:'0.10'},{account_code:'C',debit:'',credit:'0.20'}]).debit,.3);
 assert.throws(()=>validateLines([{account_code:'A',debit:'1',credit:''},{account_code:'B',debit:'',credit:'.999'}]));assert.equal(csvCell('=1+1'),'"\'=1+1"');
});
test('accounting database: permissions, atomic posting, retries, ledgers, period and closing balances',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;create table profiles(id uuid primary key);insert into profiles values('00000000-0000-0000-0000-000000000001');create function has_admin_permission(text,text) returns boolean language sql as $$select current_setting('test.permission',true) in ($2,'all')$$;create function is_staff_or_admin() returns boolean language sql as $$select true$$;create sequence accounting_entry_sequence;`);
 const base=fs.readFileSync('supabase/migrations/20260917231944_admin_operations_fifo_accounting.sql','utf8');await db.exec(base.slice(base.indexOf('create table if not exists public.accounting_accounts'),base.indexOf('create or replace function public.accounting_trial_balance')));
 await db.exec(fs.readFileSync('supabase/migrations/20260926000423_accounting_workspace.sql','utf8'));
 const ledger=()=>db.query("select accounting_create_ledger('BANK2','Second Bank','Bank Accounts')");
 await db.exec("set role authenticated;set test.permission='none'");await assert.rejects(ledger(),/permission/);await assert.rejects(db.query("select * from accounting_workspace_balances('2026-04-01','2026-09-01')"),/permission/);
 await db.exec("set test.permission='all'");await ledger();await assert.rejects(ledger(),/unique/);
 const post=(id,date,lines)=>db.query("select accounting_post_manual($1,'journal',$2,'test','Test entry',$3::jsonb) id",[id,date,JSON.stringify(lines)]);
 const lines=[{account_code:'1000',debit:100,credit:0},{account_code:'3000',debit:0,credit:100}];
 const id='10000000-0000-0000-0000-000000000001';const first=(await post(id,'2026-03-01',lines)).rows[0].id;assert.equal((await post(id,'2026-03-01',lines)).rows[0].id,first);
 await post('10000000-0000-0000-0000-000000000002','2026-04-01',[{account_code:'1000',debit:25,credit:0},{account_code:'4000',debit:0,credit:25}]);
 for(const bad of [[{account_code:'1000',debit:1.001,credit:0},{account_code:'3000',debit:0,credit:1.001}],[{account_code:'1000',debit:1,credit:0},{account_code:'3000',debit:0,credit:2}],[{account_code:'missing',debit:1,credit:0},{account_code:'3000',debit:0,credit:1}]])await assert.rejects(post('10000000-0000-0000-0000-000000000003','2026-04-02',bad));
 assert.equal(Number((await db.query('select count(*) n from accounting_entries')).rows[0].n),2);
 const rows=(await db.query("select * from accounting_workspace_balances('2026-04-01','2026-04-30')")).rows;const cash=rows.find(r=>r.code==='1000');assert.equal(Number(cash.opening),100);assert.equal(Number(cash.debit),25);assert.equal(Number(cash.closing),125);
 assert.equal(rows.reduce((s,r)=>s+Number(r.closing),0),0);
 await db.exec("set test.permission='view'");await assert.rejects(post('10000000-0000-0000-0000-000000000004','2026-04-02',lines),/permission/);
 await db.exec('set role anon');await assert.rejects(db.query("select * from accounting_workspace_balances('2026-04-01','2026-04-30')"),/permission/);
 }finally{await db.close();}
});

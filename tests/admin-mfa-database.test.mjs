import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

test('MFA database gates, profile protection and first-login proof on PostgreSQL',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await readFile(new URL('./fixtures/admin-mfa-schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20260921171535_complete_admin_mfa_flow.sql',import.meta.url),'utf8'))
  await db.exec('create trigger profiles_protect_access_fields before insert or update on public.profiles for each row execute function public.protect_profile_access_fields()')
  await db.exec(await readFile(new URL('./fixtures/admin-mfa-regression.sql',import.meta.url),'utf8'))
  const result=await db.query("select count(*)::int count from pg_policies where policyname='nis_internal_session_gate'")
  assert.equal(result.rows[0].count,2)
 }finally{await db.close()}
})

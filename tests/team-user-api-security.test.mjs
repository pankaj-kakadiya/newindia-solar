import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const route=await readFile(new URL('../app/api/admin/team-users/route.ts',import.meta.url),'utf8')

test('all team-user endpoints enforce owner-admin authorization',()=>{
 assert.match(route,/ownerAdmin\(request,'view'\)/)
 assert.match(route,/ownerAdmin\(request,'create'\)/)
 assert.match(route,/ownerAdmin\(request,'edit'\)/)
 assert.match(route,/auth\.access\?\.role!==['"]admin['"]/)
})

test('service credentials remain server-only and passwords are never returned by list users',()=>{
 assert.match(route,/process\.env\.SUPABASE_SERVICE_ROLE_KEY/)
 assert.doesNotMatch(route,/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/)
 const getBody=route.slice(route.indexOf('export async function GET'),route.indexOf('export async function POST'))
 assert.doesNotMatch(getBody,/encrypted_password|temporary_password/)
})

test('profile write failure rolls back the newly-created auth user',()=>{
 assert.match(route,/admin\.auth\.admin\.deleteUser\(created\.user\.id\)/)
})

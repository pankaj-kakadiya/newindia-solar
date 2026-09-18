import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const page=await readFile(new URL('../app/admin/access/page.tsx',import.meta.url),'utf8')
const users=await readFile(new URL('../components/admin/AdminUsersPanel.tsx',import.meta.url),'utf8')
const migration=await readFile(new URL('../supabase/migrations/20260918170704_complete_role_permission_matrix.sql',import.meta.url),'utf8')

test('role changes are staged and saved with an upsert',()=>{
 assert.match(page,/Save Role Access/)
 assert.match(page,/upsert\(rows,\{onConflict:'role_key,module_key'\}\)/)
 assert.match(page,/Unsaved role changes/)
 assert.match(page,/Discard/)
})

test('permission dependencies prevent hidden write access',()=>{
 assert.match(page,/key!==['"]can_view['"]&&value\)next\.can_view=true/)
 assert.match(page,/key===['"]can_view['"]&&!value\)for\(const \[action\] of actions\)next\[action\]=false/)
})

test('team users support explicit individual allow and block rules',()=>{
 assert.match(users,/Additional Access Overrides/)
 assert.match(users,/Save Additional Access/)
 assert.match(users,/admin_user_permissions/)
 assert.match(users,/<option value="allow">Allow<\/option><option value="deny">Block<\/option>/)
})

test('migration backfills and prevents missing role-module rows',()=>{
 assert.match(migration,/cross join public\.admin_modules/)
 assert.match(migration,/on conflict \(role_key, module_key\) do nothing/)
 assert.match(migration,/sync_permissions_after_admin_module_insert/)
 assert.match(migration,/sync_permissions_after_admin_role_insert/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const files=['../supabase/migrations/20260920143000_secure_support_chat.sql','../supabase/migrations/20260920175500_secure_support_chat_hardening.sql','../supabase/migrations/20260920182000_support_team_permission_sync.sql','../supabase/migrations/20260920202849_simple_account_support.sql']
const sql=(await Promise.all(files.map(x=>readFile(new URL(x,import.meta.url),'utf8')))).join('\n').toLowerCase()

test('all exposed support tables enable row level security',()=>{
 for(const table of ['support_teams','support_team_members','support_crypto_identities','support_conversations','support_conversation_keys','support_messages','support_conversation_reads'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`))
})
test('anonymous roles cannot execute privileged support functions',()=>{
 assert.match(sql,/revoke all on function[\s\S]*support_create_conversation[\s\S]*from public,anon/)
 assert.match(sql,/grant execute on function[\s\S]*support_create_conversation[\s\S]*to authenticated/)
})
test('message content remains in the RLS-protected support message schema',()=>{
 assert.match(sql,/create table public\.support_messages[\s\S]*ciphertext text not null[\s\S]*iv text not null/)
 assert.doesNotMatch(sql,/create table public\.support_messages[\s\S]*\bbody text\b/)
})
test('team access synchronizes support permissions',()=>{
 assert.match(sql,/support_set_team_member/)
 assert.match(sql,/admin_user_permissions/)
})
test('simple chat creation requires authentication and restricts function execution',()=>{
 assert.match(sql,/support_create_simple_conversation/)
 assert.match(sql,/if auth\.uid\(\) is null then/)
 assert.match(sql,/revoke all on function public\.support_create_simple_conversation[\s\S]*from public,anon/)
 assert.match(sql,/grant execute on function public\.support_create_simple_conversation[\s\S]*to authenticated/)
})

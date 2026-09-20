import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const root=new URL('../',import.meta.url)

test('support launcher stays floating and adapts to mobile screens',async()=>{
 const css=await readFile(new URL('app/support-chat-controls-v8.css',root),'utf8')
 assert.match(css,/\.supportLauncher\s*\{[^}]*position:fixed/s)
 assert.match(css,/@media\(max-width:700px\)/)
 assert.match(css,/safe-area-inset-bottom/)
 assert.match(css,/width:60px/)
})

test('launcher opens the support page directly without an intermediate popup',async()=>{
 const component=await readFile(new URL('components/support/SupportLauncher.tsx',root),'utf8')
 assert.match(component,/href=\{href\}/)
 assert.match(component,/aria-label="Open New India Solar support chat"/)
 assert.match(component,/Chat support/)
 assert.doesNotMatch(component,/role="dialog"|aria-expanded|setOpen/)
})

test('buyer guided support opens without forms, PINs or device activation screens',async()=>{
 const workspace=await readFile(new URL('components/support/SecureSupportWorkspace.tsx',root),'utf8')
 assert.match(workspace,/support_create_simple_conversation/)
 assert.match(workspace,/CHOOSE A QUICK QUESTION/)
 assert.match(workspace,/Talk to an agent/)
 assert.match(workspace,/p_priority:'high'/)
 assert.match(workspace,/No form or setup required/)
 assert.doesNotMatch(workspace,/Secure Chat PIN|Activate this browser|AUTOMATIC DEVICE PROTECTION/)
 assert.doesNotMatch(workspace,/createDeviceSupportIdentity|unlockDeviceSupportIdentity/)
 assert.doesNotMatch(workspace,/showCreate|New conversation|Start chat/)
})

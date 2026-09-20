import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const root=new URL('../',import.meta.url)

test('support launcher stays floating and adapts to mobile screens',async()=>{
 const css=await readFile(new URL('app/support-chat-controls-v8.css',root),'utf8')
 assert.match(css,/\.supportLauncher\s*\{[^}]*position:fixed/s)
 assert.match(css,/\.supportLauncher aside\s*\{[^}]*position:absolute/s)
 assert.match(css,/@media\(max-width:700px\)/)
 assert.match(css,/max-height:calc\(100dvh - 110px\)/)
 assert.match(css,/safe-area-inset-bottom/)
})

test('launcher exposes an accessible popup control',async()=>{
 const component=await readFile(new URL('components/support/SupportLauncher.tsx',root),'utf8')
 assert.match(component,/aria-expanded=\{open\}/)
 assert.match(component,/aria-controls="support-launcher-panel"/)
 assert.match(component,/role="dialog"/)
 assert.match(component,/event\.key==='Escape'/)
})

test('buyer and admin support open without PIN or device activation screens',async()=>{
 const workspace=await readFile(new URL('components/support/SecureSupportWorkspace.tsx',root),'utf8')
 assert.match(workspace,/support_create_simple_conversation/)
 assert.match(workspace,/ACCOUNT SUPPORT/)
 assert.match(workspace,/Start chat/)
 assert.doesNotMatch(workspace,/Secure Chat PIN|Activate this browser|AUTOMATIC DEVICE PROTECTION/)
 assert.doesNotMatch(workspace,/createDeviceSupportIdentity|unlockDeviceSupportIdentity/)
})

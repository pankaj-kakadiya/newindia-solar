import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const root=new URL('../',import.meta.url)

test('support launcher stays floating and adapts to mobile screens',async()=>{
 const css=await readFile(new URL('app/support-chat-controls-v8.css',root),'utf8')
 assert.match(css,/\.supportLauncher\s*\{[^}]*position:fixed/s)
 assert.match(css,/\.supportPopup\s*\{[^}]*position:absolute/s)
 assert.match(css,/@media\(max-width:700px\)/)
 assert.match(css,/safe-area-inset-bottom/)
 assert.match(css,/width:60px/)
 assert.match(css,/@media\(max-width:700px\)[\s\S]*\.supportPopup\{position:fixed/s)
 assert.match(css,/height:min\(680px,calc\(100dvh - 102px\)\)/)
})

test('launcher opens an accessible guided popup without leaving the current page',async()=>{
 const component=await readFile(new URL('components/support/SupportLauncher.tsx',root),'utf8')
 assert.match(component,/role="dialog"/)
 assert.match(component,/aria-expanded=\{open\}/)
 assert.match(component,/setOpen\(value=>!value\)/)
 assert.match(component,/Chat support/)
 assert.match(component,/QUICK QUESTIONS/)
 assert.match(component,/Talk to an agent/)
 assert.match(component,/support_create_simple_conversation/)
 assert.match(component,/p_priority:'high'/)
 assert.doesNotMatch(component,/href=\{signedIn\?'\/account\/support'/)
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

test('popup and full support page share the same guided answers',async()=>{
 const content=await readFile(new URL('components/support/support-content.ts',root),'utf8')
 const launcher=await readFile(new URL('components/support/SupportLauncher.tsx',root),'utf8')
 const workspace=await readFile(new URL('components/support/SecureSupportWorkspace.tsx',root),'utf8')
 assert.match(content,/Which ACDB or DCDB is right/)
 assert.match(content,/Where is my order/)
 assert.match(launcher,/supportQuickAnswers/)
 assert.match(workspace,/supportQuickAnswers/)
})

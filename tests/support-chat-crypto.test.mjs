import test from 'node:test'
import assert from 'node:assert/strict'
import {createConversationKey,createDeviceSupportIdentity,createSupportIdentity,decryptSupportText,encryptSupportText,isDeviceSupportIdentity,unlockDeviceSupportIdentity,unlockSupportIdentity,unwrapConversationKey,validateSupportPin,wrapConversationKey} from '../lib/support-crypto.ts'

function installMemoryIndexedDb(){
 const records=new Map()
 let initialized=false
 globalThis.indexedDB={
  open(){
   const request={result:null,error:null}
   queueMicrotask(()=>{
    request.result={
     objectStoreNames:{contains:()=>initialized},
     createObjectStore(){initialized=true},
     close(){},
     transaction(){
      const transaction={
       error:null,oncomplete:null,onerror:null,onabort:null,
       objectStore(){return{
        put(value,key){records.set(key,value);queueMicrotask(()=>transaction.oncomplete?.())},
        get(key){const read={result:undefined,error:null,onsuccess:null,onerror:null};queueMicrotask(()=>{read.result=records.get(key);read.onsuccess?.()});return read}
       }}
      }
      return transaction
     }
    }
    if(!initialized)request.onupgradeneeded?.()
    request.onsuccess?.()
   })
   return request
  }
 }
}

test('Secure Chat PIN policy rejects weak PINs',()=>{
 assert.match(validateSupportPin('short'),/8 characters/)
 assert.match(validateSupportPin('onlyletters'),/letter and one number/)
 assert.equal(validateSupportPin('Solar2026'), '')
})

test('identity private key remains PIN-wrapped and unlocks with the correct PIN',async()=>{
 const created=await createSupportIdentity('Solar2026','00000000-0000-0000-0000-000000000001')
 assert.ok(created.encrypted_private_key.length>100)
 assert.equal(JSON.stringify(created).includes('"d"'),false)
 const privateKey=await unlockSupportIdentity({...created,user_id:'00000000-0000-0000-0000-000000000001'},'Solar2026')
 assert.equal(privateKey.type,'private')
 await assert.rejects(()=>unlockSupportIdentity({...created,user_id:'00000000-0000-0000-0000-000000000001'},'Wrong2026'),/Incorrect Secure Chat PIN/)
})

test('buyer identity uses a non-extractable device key and unlocks without a PIN',async()=>{
 installMemoryIndexedDb()
 const userId='00000000-0000-0000-0000-000000000003'
 const created=await createDeviceSupportIdentity(userId)
 assert.equal(isDeviceSupportIdentity({...created,user_id:userId}),true)
 assert.equal(JSON.stringify(created).includes('privateKey'),true)
 assert.equal(created.encrypted_private_key.includes('"d"'),false)
 const privateKey=await unlockDeviceSupportIdentity({...created,user_id:userId})
 assert.equal(privateKey.type,'private')
 assert.equal(privateKey.extractable,false)
})

test('conversation key wrapping and authenticated message encryption round-trip',async()=>{
 const identity=await createSupportIdentity('Buyer2026','00000000-0000-0000-0000-000000000002')
 const conversationKey=await createConversationKey()
 const envelope=await wrapConversationKey(conversationKey,{user_id:'00000000-0000-0000-0000-000000000002',display_name:'Buyer',public_key_jwk:identity.public_key_jwk,key_version:1})
 const unlocked=await unwrapConversationKey(envelope.wrapped_key,identity.privateKey)
 const encrypted=await encryptSupportText(unlocked,'Private order details','support:test')
 assert.notEqual(encrypted.ciphertext,'Private order details')
 assert.equal(await decryptSupportText(unlocked,encrypted.ciphertext,encrypted.iv,'support:test'),'Private order details')
 assert.equal(await decryptSupportText(unlocked,encrypted.ciphertext,encrypted.iv,'wrong-context'),'Encrypted content could not be verified.')
})

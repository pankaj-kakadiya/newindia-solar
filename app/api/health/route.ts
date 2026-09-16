import {NextResponse} from 'next/server'
import {serviceClient} from '../../../lib/transactionRuntime'

export async function GET(){
 const started=Date.now(),db=serviceClient()
 if(!db)return NextResponse.json({ok:false,service:'newindia-solar',database:'unconfigured',timestamp:new Date().toISOString()},{status:503,headers:{'Cache-Control':'no-store'}})
 try{
  const {error}=await db.from('system_settings').select('settings_key').limit(1)
  if(error)throw error
  return NextResponse.json({ok:true,service:'newindia-solar',database:'ok',latency_ms:Date.now()-started,timestamp:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})
 }catch{
  return NextResponse.json({ok:false,service:'newindia-solar',database:'degraded',timestamp:new Date().toISOString()},{status:503,headers:{'Cache-Control':'no-store'}})
 }
}

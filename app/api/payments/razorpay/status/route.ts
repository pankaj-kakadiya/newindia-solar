import {NextResponse} from 'next/server'
import {serviceClient} from '../../../../../lib/transactionRuntime'
import {paymentReady} from '../../../../../lib/payment-security'

export async function GET(){
 const headers={'Cache-Control':'no-store'}
 const db=serviceClient();if(!db)return NextResponse.json({available:false},{headers})
 const {data,error}=await db.from('integration_settings').select('is_enabled,environment').eq('integration_key','payment').single()
 return NextResponse.json({available:!error&&paymentReady(data,process.env)},{headers})
}

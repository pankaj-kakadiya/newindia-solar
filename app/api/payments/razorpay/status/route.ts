import {NextResponse} from 'next/server'
import {serviceClient} from '../../../../../lib/transactionRuntime'

export async function GET(){
 const db=serviceClient();if(!db)return NextResponse.json({available:false})
 const {data}=await db.from('integration_settings').select('is_enabled').eq('integration_key','payment').single()
 const available=Boolean(data?.is_enabled&&process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY)
 return NextResponse.json({available},{headers:{'Cache-Control':'no-store'}})
}

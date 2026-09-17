import {timingSafeEqual} from 'node:crypto'

/** Buffer.from(hex) silently truncates malformed input: validate before decoding. */
export function secureEqualHex(a:string,b:string){
 if(!/^[a-fA-F0-9]{64}$/.test(a)||!/^[a-fA-F0-9]{64}$/.test(b))return false
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'))
}

export function paymentPaise(value:unknown):number|null{
 if((typeof value!=='string'&&typeof value!=='number')||String(value).trim()==='')return null
 const number=Number(value),amount=Math.round(number*100)
 return Number.isFinite(number)&&number>0&&Number.isSafeInteger(amount)&&amount>0?amount:null
}

export function paymentReady(integration:{is_enabled?:boolean;environment?:string}|null,env:Record<string,string|undefined>){
 const prefix=integration?.environment==='live'?'rzp_live_':integration?.environment==='sandbox'?'rzp_test_':null
 return Boolean(integration?.is_enabled&&prefix&&env.RAZORPAY_KEY_ID?.startsWith(prefix)&&env.RAZORPAY_KEY_SECRET?.trim()&&env.RAZORPAY_WEBHOOK_SECRET?.trim()&&env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export function matchesPayment(entity:any,orderId:string,paymentId:string,amount:number|null){
 return amount!==null&&entity?.id===paymentId&&entity?.order_id===orderId&&entity?.currency==='INR'&&Number.isSafeInteger(entity?.amount)&&entity.amount===amount
}

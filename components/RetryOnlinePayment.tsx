'use client'

import {useEffect,useState} from 'react'
import {CreditCard,Loader2} from 'lucide-react'
import {supabase} from '../lib/supabase'

async function loadRazorpay(){
 if((window as any).Razorpay)return true
 return await new Promise<boolean>(resolve=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.async=true;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.body.appendChild(s)})
}

export default function RetryOnlinePayment({orderNumber}:{orderNumber:string}){
 const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('Checking online payment availability…')
 useEffect(()=>{fetch('/api/payments/razorpay/status',{cache:'no-store'}).then(r=>r.json()).then(j=>{const ok=Boolean(j?.available);setAvailable(ok);setMessage(ok?'Your order is safe. You can retry online payment without creating a second order.':'Online payment is not currently available. Your order remains payment-pending; use bank transfer/payment link or contact our team.')}).catch(()=>setMessage('Could not check online payment availability. Your order remains safe and payment-pending.'))},[])
 async function retry(){
  setBusy(true);setMessage('Preparing secure payment…')
  try{
   const {data:session}=await supabase.auth.getSession(),token=session.session?.access_token||''
   if(!token)throw new Error('Please sign in again before retrying payment.')
   const cr=await fetch('/api/payments/razorpay/create',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({order_number:orderNumber})}),cj=await cr.json().catch(()=>({}))
   if(!cr.ok)throw new Error(cj.error||'Could not prepare payment retry.')
   if(!(await loadRazorpay()))throw new Error('Razorpay Checkout could not load. Try again or use bank transfer.')
   await new Promise<void>((resolve,reject)=>{
    const instance=new (window as any).Razorpay({key:cj.key_id,amount:cj.amount,currency:cj.currency,name:'New India Solar',description:`Order ${cj.order_number}`,order_id:cj.razorpay_order_id,prefill:cj.customer||{},handler:async(response:any)=>{try{const vr=await fetch('/api/payments/razorpay/verify',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(response)}),vj=await vr.json().catch(()=>({}));if(!vr.ok)throw new Error(vj.error||'Payment verification failed.');if(!vj.captured)throw new Error('Payment is authorized but not captured yet. The order remains payment-pending until capture is confirmed.');resolve()}catch(error){reject(error)}},modal:{ondismiss:()=>reject(new Error('Payment window closed. Your existing order remains payment-pending.'))}})
    instance.on('payment.failed',(response:any)=>reject(new Error(response?.error?.description||'Online payment failed. Your existing order is unchanged.')));instance.open()
   })
   window.location.href=`/checkout/success?order=${encodeURIComponent(orderNumber)}&payment=paid`
  }catch(error:any){setMessage(String(error?.message||error));setBusy(false)}
 }
 return <div style={{marginTop:18,padding:14,border:'1px solid #dfe5eb',borderRadius:12,background:'#f8fafc'}}><b style={{display:'block',marginBottom:6}}>Payment recovery</b><p style={{margin:'0 0 12px',color:'#64748b',fontSize:13}}>{message}</p>{available&&<button className="btn btnPrimary" onClick={retry} disabled={busy}>{busy?<><Loader2 className="spin" size={16}/> Retrying payment…</>:<><CreditCard size={16}/> Retry Online Payment</>}</button>}</div>
}

'use client'

import {FormEvent,useEffect,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Building2,CheckCircle2,CreditCard,Loader2,LockKeyhole,MapPin,ReceiptText} from 'lucide-react'
import {useCart} from '../../components/CartProvider'
import {supabase} from '../../lib/supabase'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'

const GST_RATE=18
const money=(n:number)=>`₹${Math.round(n).toLocaleString('en-IN')}`
const taxOf=(n:number)=>Math.round(n*GST_RATE/100)

async function loadRazorpay(){
 if((window as any).Razorpay)return true
 return await new Promise<boolean>(resolve=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.async=true;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.body.appendChild(s)})
}

export default function Checkout(){
  const {items,total,clear}=useCart();const router=useRouter();const [business,setBusiness]=useState(false);const [user,setUser]=useState<any>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [gatewayAvailable,setGatewayAvailable]=useState(false)
  const displayTax=taxOf(total),displayGrand=total+displayTax
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUser(data.user||null));fetch('/api/payments/razorpay/status',{cache:'no-store'}).then(r=>r.json()).then(j=>setGatewayAvailable(Boolean(j?.available))).catch(()=>setGatewayAvailable(false))},[])
  async function payOnline(orderNumber:string){
   const {data:session}=await supabase.auth.getSession();const token=session.session?.access_token||''
   const r=await fetch('/api/payments/razorpay/create',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({order_number:orderNumber})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not prepare online payment.')
   if(!(await loadRazorpay()))throw new Error('Razorpay Checkout could not load. Please use bank transfer or try again.')
   await new Promise<void>((resolve,reject)=>{
    const instance=new (window as any).Razorpay({key:j.key_id,amount:j.amount,currency:j.currency,name:'New India Solar',description:`Order ${j.order_number}`,order_id:j.razorpay_order_id,prefill:j.customer||{},theme:{},handler:async(response:any)=>{try{const vr=await fetch('/api/payments/razorpay/verify',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(response)});const vj=await vr.json().catch(()=>({}));if(!vr.ok)throw new Error(vj.error||'Payment verification failed.');resolve()}catch(err){reject(err)}},modal:{ondismiss:()=>reject(new Error('Payment window closed. Your order remains created with payment pending.'))}})
    instance.on('payment.failed',(response:any)=>reject(new Error(response?.error?.description||'Online payment failed.')));instance.open()
   })
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!user){router.push('/login?next=/checkout');return}if(!items.length){setMessage('Your cart is empty.');return}setBusy(true);setMessage('');const f=new FormData(e.currentTarget),paymentMethod=String(f.get('payment')||'bank_transfer')
    if(paymentMethod==='online'&&!gatewayAvailable){setBusy(false);setMessage('Online payment is not enabled yet. Choose bank transfer/payment link.');return}
    const {data:cart,error:cartErr}=await supabase.from('carts').insert({user_id:user.id}).select('id').single();if(cartErr||!cart){setBusy(false);setMessage(cartErr?.message||'Could not prepare cart.');return}
    for(const i of items){
      if(i.kind==='standard'){
        if(!i.productVariantId){setBusy(false);setMessage(`Missing live product variant for ${i.name}.`);return}
        const {data:v,error:vErr}=await supabase.from('product_variants').select('selling_price').eq('id',i.productVariantId).single();if(vErr||!v){setBusy(false);setMessage(vErr?.message||'Could not load product price.');return}
        const {error}=await supabase.from('cart_items').insert({cart_id:cart.id,variant_id:i.productVariantId,quantity:i.qty,unit_price:Number(v.selling_price),metadata:{source:'web'}});if(error){setBusy(false);setMessage(error.message);return}
      }else{
        if(!i.templateId){setBusy(false);setMessage('Custom configuration is incomplete.');return}
        let cfg:any=null;let cfgErr:any=null
        if(i.visualSelections?.length){const r=await supabase.rpc('save_visual_configuration',{p_template_id:i.templateId,p_config_name:i.name,p_selections:i.visualSelections.map(s=>({value_id:s.value_id,quantity:s.quantity})),p_preview_snapshot:i.visualPreview||{}});cfgErr=r.error;cfg=r.data}
        else{if(!i.selectedValueIds?.length){setBusy(false);setMessage('Custom configuration is incomplete.');return}const r=await supabase.rpc('save_custom_configuration',{p_template_id:i.templateId,p_config_name:i.name,p_selected_value_ids:i.selectedValueIds});cfgErr=r.error;cfg=r.data}
        if(cfgErr||!cfg){setBusy(false);setMessage(cfgErr?.message||'Could not price configuration.');return}
        const cfgRow=Array.isArray(cfg)?cfg[0]:cfg;if(Number(cfgRow?.final_price||0)<=0){setBusy(false);setMessage('This custom build is not priced yet.');return}
        const {error}=await supabase.from('cart_items').insert({cart_id:cart.id,custom_configuration_id:cfgRow.id,quantity:i.qty,unit_price:Number(cfgRow.final_price),metadata:{source:'web',configuration_code:cfgRow.configuration_code||null,visual:!!i.visualSelections?.length}});if(error){setBusy(false);setMessage(error.message);return}
      }
    }
    const shipping={full_name:f.get('name'),phone:f.get('phone'),address_line1:f.get('address'),city:f.get('city'),state:f.get('state'),postal_code:f.get('pin'),country:'India'},customer={name:f.get('name'),phone:f.get('phone'),email:user.email}
    const {data,error}=await supabase.rpc('place_order_from_cart',{p_cart_id:cart.id,p_customer_snapshot:customer,p_shipping_address:shipping,p_billing_address:shipping,p_business_purchase:business,p_company_name:business?String(f.get('company')||''):null,p_gstin:business?String(f.get('gstin')||''):null,p_po_number:business?String(f.get('po')||''):null,p_payment_method:paymentMethod,p_notes:'Website order'})
    if(error){setBusy(false);setMessage(error.message);return}
    const order=Array.isArray(data)?data[0]:data,orderNumber=String(order?.order_number||'');clear()
    if(paymentMethod==='online'){
      try{await payOnline(orderNumber);setBusy(false);router.push(`/checkout/success?order=${encodeURIComponent(orderNumber)}&payment=paid`)}catch(err:any){setBusy(false);setMessage(String(err?.message||err));router.push(`/checkout/success?order=${encodeURIComponent(orderNumber)}&payment=pending`)}
      return
    }
    setBusy(false);router.push(`/checkout/success?order=${encodeURIComponent(orderNumber)}`)
  }
  return <><StoreHeader/><main className="container checkoutPage"><div className="checkoutIntro"><span className="eyebrow darkEye">SECURE ORDER</span><h1>Checkout</h1><p>Business-ready checkout with GST details and server-verified pricing.</p></div><form className="checkoutForm" onSubmit={submit}><section className="checkoutMain">{!user&&<div className="checkoutAlert"><LockKeyhole size={18}/><div><b>Sign in required</b><span>Secure order creation is tied to your account.</span></div><Link href="/login?next=/checkout">Sign in / Create account</Link></div>}<div className="checkoutSection"><div className="checkoutSectionTitle"><Building2 size={20}/><div><h3>Purchase Type</h3><p>Choose personal or GST business purchase.</p></div></div><div className="toggle"><button type="button" className={!business?'active':''} onClick={()=>setBusiness(false)}>Individual</button><button type="button" className={business?'active':''} onClick={()=>setBusiness(true)}>Business / GST</button></div></div>{business&&<div className="checkoutSection"><div className="checkoutSectionTitle"><ReceiptText size={20}/><div><h3>Business Details</h3><p>Used for GST-ready order records.</p></div></div><div className="two"><label>Company Name<input name="company" required={business} placeholder="Registered business name"/></label><label>GSTIN<input name="gstin" required={business} placeholder="GST number"/></label></div><label>PO Number (optional)<input name="po" placeholder="Purchase order reference"/></label></div>}<div className="checkoutSection"><div className="checkoutSectionTitle"><MapPin size={20}/><div><h3>Contact & Shipping</h3><p>Where should this order be dispatched?</p></div></div><div className="two"><label>Full Name<input name="name" required placeholder="Contact person"/></label><label>Mobile<input name="phone" inputMode="tel" required placeholder="Mobile number"/></label></div><label>Address<input name="address" required placeholder="Address line"/></label><div className="three"><label>City<input name="city" required/></label><label>State<input name="state" defaultValue="Gujarat" required/></label><label>PIN Code<input name="pin" inputMode="numeric" required/></label></div></div><div className="checkoutSection"><div className="checkoutSectionTitle"><CreditCard size={20}/><div><h3>Payment Method</h3><p>Choose bank transfer or secure online payment when Razorpay is enabled.</p></div></div><label className="paymentChoice"><input type="radio" name="payment" value="bank_transfer" defaultChecked/><div><b>Bank Transfer / Payment Link</b><span>Order is created with payment pending.</span></div></label><label className={`paymentChoice ${gatewayAvailable?'':'disabledPayment'}`}><input type="radio" name="payment" value="online" disabled={!gatewayAvailable}/><div><b>UPI / Card / Netbanking</b><span>{gatewayAvailable?'Secure Razorpay checkout with server-side signature verification.':'Online gateway is currently disabled.'}</span></div></label></div>{message&&<div className="formError">{message}</div>}<button className="nisPrimaryBtn checkoutSubmit" disabled={busy||!items.length}>{busy?<><Loader2 className="spin" size={18}/> Processing secure order…</>:<><LockKeyhole size={18}/> Place Order</>}</button></section><aside className="summary checkoutSummary"><div className="checkoutSecure"><LockKeyhole size={16}/> Server-verified checkout</div><h2>Order Summary</h2>{items.map(i=>{const base=i.price*i.qty,tax=taxOf(base),incl=base+tax;return <div className="checkoutLine" key={i.id}><span>{i.name}<small>{i.variant}</small><small>Qty {i.qty} • Base {money(base)} + GST {money(tax)}</small></span><b>{money(incl)}<small> incl. GST</small></b></div>})}<div><span>Subtotal before GST</span><b>{money(total)}</b></div><div><span>GST @ {GST_RATE}%</span><b>{money(displayTax)}</b></div><div className="grand"><span>Total incl. GST</span><b>{money(displayGrand)}</b></div><div className="checkoutPoints"><span><CheckCircle2 size={14}/> Final standard pricing recalculated server-side</span><span><CheckCircle2 size={14}/> Visual custom builds re-priced from component master</span><span><CheckCircle2 size={14}/> Online payments signature-verified before marking paid</span></div><p className="summaryNote">Final prices and applicable GST are verified server-side before order creation.</p></aside></form></main><StoreFooter/></>
}

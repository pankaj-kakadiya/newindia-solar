'use client'

import {FormEvent,useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Building2,CheckCircle2,CreditCard,Loader2,LockKeyhole,MapPin,ReceiptText} from 'lucide-react'
import {useCart} from '../../components/CartProvider'
import {supabase} from '../../lib/supabase'
import {buyerFetch} from '../../lib/buyer-client'
import {addressInput,profileInput} from '../../lib/buyer-account'
import {money} from '../../lib/catalogue'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'

const roundMoney=(n:number)=>Math.round((n+Number.EPSILON)*100)/100

async function loadRazorpay(){
 if((window as any).Razorpay)return true
 return await new Promise<boolean>(resolve=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.async=true;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.body.appendChild(s)})
}

export default function Checkout(){
  const {items,clear}=useCart();const router=useRouter();const [business,setBusiness]=useState(false);const [user,setUser]=useState<any>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [gatewayAvailable,setGatewayAvailable]=useState(false)
  const [savedAddresses,setSavedAddresses]=useState<any[]>([])
  const [fields,setFields]=useState({name:'',phone:'',address:'',address2:'',city:'',state:'Gujarat',pin:'',company:'',gstin:''})
  const touched=useRef(false)
  function field(key:keyof typeof fields){return {value:fields[key],onChange:(e:React.ChangeEvent<HTMLInputElement>)=>{touched.current=true;setFields(x=>({...x,[key]:e.target.value}))}}}
  function applyAddress(a:any){touched.current=true;setFields(x=>({...x,name:a.contact_name||'',phone:a.phone||'',address:a.address_line1||'',address2:a.address_line2||'',city:a.city||'',state:a.state||'',pin:a.postal_code||''}))}
  const submitting=useRef(false)
  const attempt=useRef<{fingerprint:string;id:string}|null>(null)
  const [prices,setPrices]=useState<Record<string,{price:number;gst:number}>>({})
  useEffect(()=>{
    let active=true;setPrices({})
    const ids=items.filter(i=>i.kind==='standard'&&i.productVariantId).map(i=>i.productVariantId!)
    if(ids.length)supabase.from('product_variants').select('id,selling_price,products(gst_rate)').in('id',ids).then(({data,error})=>{
      if(!active||error)return
      const next:Record<string,{price:number;gst:number}>={}
      for(const row of data||[]){const product=Array.isArray(row.products)?row.products[0]:row.products;const price=Number(row.selling_price),gst=Number(product?.gst_rate);if(product?.gst_rate!=null&&Number.isFinite(price)&&price>0&&Number.isFinite(gst)&&gst>=0)next[row.id]={price,gst}}
      setPrices(next)
    })
    return()=>{active=false}
  },[items])
  const quoteLines=items.map(i=>{const p=prices[i.productVariantId||''];if(i.kind!=='standard'||!p)return null;const base=p.price*i.qty,tax=roundMoney(p.price*i.qty*p.gst/100);return {base,tax,total:roundMoney(base+tax)}})
  const quoteReady=items.length>0&&quoteLines.every(Boolean)
  const displayBase=roundMoney(quoteLines.reduce((sum,l)=>sum+(l?.base||0),0)),displayTax=roundMoney(quoteLines.reduce((sum,l)=>sum+(l?.tax||0),0)),displayGrand=roundMoney(displayBase+displayTax)
  useEffect(()=>{supabase.auth.getUser().then(async({data})=>{setUser(data.user||null);if(data.user){try{const account=await buyerFetch('account');setSavedAddresses(account.addresses);if(!touched.current){const a=account.addresses[0]||{},p=account.profile;setFields({name:a.contact_name||p.full_name||'',phone:a.phone||p.phone||data.user.phone||'',address:a.address_line1||'',address2:a.address_line2||'',city:a.city||'',state:a.state||'Gujarat',pin:a.postal_code||'',company:p.company_name||'',gstin:p.gstin||''});if(p.gstin)setBusiness(true)}}catch{}}});fetch('/api/payments/razorpay/status',{cache:'no-store'}).then(r=>r.json()).then(j=>setGatewayAvailable(Boolean(j?.available))).catch(()=>setGatewayAvailable(false))},[])
  async function payOnline(orderNumber:string){
   const {data:session}=await supabase.auth.getSession();const token=session.session?.access_token||''
   const r=await fetch('/api/payments/razorpay/create',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({order_number:orderNumber})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not prepare online payment.')
   if(!(await loadRazorpay()))throw new Error('Razorpay Checkout could not load. Please use bank transfer or try again.')
   return await new Promise<any>((resolve,reject)=>{
    const instance=new (window as any).Razorpay({key:j.key_id,amount:j.amount,currency:j.currency,name:'New India Solar',description:`Order ${j.order_number}`,order_id:j.razorpay_order_id,prefill:j.customer||{},theme:{},handler:async(response:any)=>{try{const vr=await fetch('/api/payments/razorpay/verify',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(response)});const vj=await vr.json().catch(()=>({}));if(!vr.ok)throw new Error(vj.error||'Payment verification failed.');resolve(vj)}catch(err){reject(err)}},modal:{ondismiss:()=>reject(new Error('Payment window closed. Your order remains created with payment pending.'))}})
    instance.on('payment.failed',(response:any)=>reject(new Error(response?.error?.description||'Online payment failed.')));instance.open()
   })
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(submitting.current)return
    if(!user){router.push('/login?next=/checkout');return}
    if(!items.length){setMessage('Your cart is empty.');return}
    submitting.current=true;setBusy(true);setMessage('')
    const f=new FormData(e.currentTarget),paymentMethod=String(f.get('payment')||'bank_transfer')
    try{
      if(paymentMethod==='online'&&!gatewayAvailable)throw new Error('Online payment is not enabled yet. Choose bank transfer/payment link.')
      const address=addressInput({contact_name:f.get('name'),phone:f.get('phone'),address_line1:f.get('address'),address_line2:f.get('address2'),city:f.get('city'),state:f.get('state'),postal_code:f.get('pin')})
      if(business)profileInput({full_name:f.get('name'),phone:f.get('phone'),company_name:f.get('company'),gstin:f.get('gstin')})
      const shipping={...address,full_name:address.contact_name},customer={name:address.contact_name,phone:address.phone,email:user.email}
      // Store only a digest and random cart ID, never shipping or contact details.
      const signature=JSON.stringify({user:user.id,items,shipping,business,company:f.get('company'),gstin:f.get('gstin'),po:f.get('po'),paymentMethod})
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature))
      const fingerprint=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')
      const storageKey=`nis-checkout-attempt:${user.id}`
      if(!attempt.current){try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved?.fingerprint===fingerprint&&typeof saved.id==='string')attempt.current=saved}catch{}}
      if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,id:crypto.randomUUID()}
      try{sessionStorage.setItem(storageKey,JSON.stringify(attempt.current))}catch{}
      const cartId=attempt.current!.id,lines:{variant_id?:string;custom_configuration_id?:string;quantity:number}[]=[]
      for(const i of items){
        if(!Number.isFinite(i.qty)||i.qty<=0)throw new Error(`Invalid quantity for ${i.name}.`)
        if(i.kind==='standard'){
          if(!i.productVariantId)throw new Error(`Missing live product variant for ${i.name}.`)
          lines.push({variant_id:i.productVariantId,quantity:i.qty})
        }else{
          if(!i.templateId)throw new Error('Custom configuration is incomplete.')
          let result
          if(i.visualSelections?.length)result=await supabase.rpc('save_visual_configuration',{p_template_id:i.templateId,p_config_name:i.name,p_selections:i.visualSelections.map(x=>({value_id:x.value_id,quantity:x.quantity})),p_preview_snapshot:i.visualPreview||{}})
          else{
            if(!i.selectedValueIds?.length)throw new Error('Custom configuration is incomplete.')
            result=await supabase.rpc('save_custom_configuration',{p_template_id:i.templateId,p_config_name:i.name,p_selected_value_ids:i.selectedValueIds})
          }
          if(result.error)throw new Error(result.error.message)
          const config=Array.isArray(result.data)?result.data[0]:result.data
          if(!config?.id||Number(config.final_price)<=0)throw new Error('This custom build is not priced yet.')
          lines.push({custom_configuration_id:config.id,quantity:i.qty})
        }
      }
      const prepared=await supabase.rpc('prepare_checkout_cart',{p_cart_id:cartId,p_items:lines})
      if(prepared.error)throw new Error(prepared.error.message)
      let order=prepared.data?.order
      if(!order){
        const result=await supabase.rpc('place_order_from_cart',{p_cart_id:cartId,p_customer_snapshot:customer,p_shipping_address:shipping,p_billing_address:shipping,p_business_purchase:business,p_company_name:business?String(f.get('company')||''):null,p_gstin:business?String(f.get('gstin')||'').trim().toUpperCase():null,p_po_number:business?String(f.get('po')||''):null,p_payment_method:paymentMethod,p_notes:'Website order'})
        if(result.error)throw new Error(result.error.message)
        order=Array.isArray(result.data)?result.data[0]:result.data
      }
      const orderNumber=String(order?.order_number||'')
      if(!orderNumber)throw new Error('Order confirmation was interrupted. Retry to recover the same order.')
      clear()
      // Keep the receipt key until the next cart changes the fingerprint: a
      // stale tab or delayed retry must recover this order, not create another.
      if(paymentMethod==='online'){
        try{const result=await payOnline(orderNumber);router.push(`/checkout/success?order=${encodeURIComponent(orderNumber)}&payment=${result?.payment_status==='paid'?'paid':'pending'}`)}
        catch{router.push(`/checkout/success?order=${encodeURIComponent(orderNumber)}&payment=pending`)}
      }else router.push(`/checkout/success?order=${encodeURIComponent(orderNumber)}`)
    }catch(error){setMessage(error instanceof Error?error.message:'Checkout could not complete. Please retry; your cart is retained.')}
    finally{submitting.current=false;setBusy(false)}
  }
  return <><StoreHeader/><main className="container checkoutPage"><div className="checkoutIntro"><span className="eyebrow darkEye">SECURE ORDER</span><h1>Checkout</h1><p>Business-ready checkout with GST details and server-verified pricing.</p></div><form className="checkoutForm" onSubmit={submit}><section className="checkoutMain">{!user&&<div className="checkoutAlert"><LockKeyhole size={18}/><div><b>Sign in required</b><span>Secure order creation is tied to your account.</span></div><Link href="/login?next=/checkout">Sign in / Create account</Link></div>}<div className="checkoutSection"><div className="checkoutSectionTitle"><Building2 size={20}/><div><h3>Purchase Type</h3><p>Choose personal or GST business purchase.</p></div></div><div className="toggle"><button type="button" className={!business?'active':''} onClick={()=>setBusiness(false)}>Individual</button><button type="button" className={business?'active':''} onClick={()=>setBusiness(true)}>Business / GST</button></div></div>{business&&<div className="checkoutSection"><div className="checkoutSectionTitle"><ReceiptText size={20}/><div><h3>Business Details</h3><p>Used for GST-ready order records.</p></div></div><div className="two"><label>Company Name<input {...field('company')} name="company" required={business} placeholder="Registered business name"/></label><label>GSTIN<input {...field('gstin')} name="gstin" required={business} placeholder="GST number"/></label></div><label>PO Number (optional)<input name="po" placeholder="Purchase order reference"/></label></div>}<div className="checkoutSection"><div className="checkoutSectionTitle"><MapPin size={20}/><div><h3>Contact & Shipping</h3><p>Where should this order be dispatched?</p></div></div><p className="buyerHint">This address is saved automatically when your order is placed.</p>{savedAddresses.length>0&&<label>Use a saved address<select defaultValue="" onChange={e=>{const a=savedAddresses.find(a=>a.id===e.target.value);if(a)applyAddress(a)}}><option value="">Choose saved address</option>{savedAddresses.map(a=><option key={a.id} value={a.id}>{a.label} — {a.address_line1}, {a.city}</option>)}</select></label>}<div className="two"><label>Full Name<input {...field('name')} name="name" required placeholder="Contact person"/></label><label>Mobile<input {...field('phone')} name="phone" inputMode="tel" required placeholder="Mobile number"/></label></div><label>Address<input {...field('address')} name="address" required placeholder="Address line"/></label><label>Address line 2 (optional)<input {...field('address2')} name="address2" placeholder="Landmark / building / unit"/></label><div className="three"><label>City<input {...field('city')} name="city" required/></label><label>State<input {...field('state')} name="state" required/></label><label>PIN Code<input {...field('pin')} name="pin" inputMode="numeric" required/></label></div></div><div className="checkoutSection"><div className="checkoutSectionTitle"><CreditCard size={20}/><div><h3>Payment Method</h3><p>Choose bank transfer or secure online payment when Razorpay is enabled.</p></div></div><label className="paymentChoice"><input type="radio" name="payment" value="bank_transfer" defaultChecked/><div><b>Bank Transfer / Payment Link</b><span>Order is created with payment pending.</span></div></label><label className={`paymentChoice ${gatewayAvailable?'':'disabledPayment'}`}><input type="radio" name="payment" value="online" disabled={!gatewayAvailable}/><div><b>UPI / Card / Netbanking</b><span>{gatewayAvailable?'Secure Razorpay checkout with provider-status + signature verification.':'Online gateway is currently disabled.'}</span></div></label></div>{message&&<div className="formError">{message}</div>}<button className="nisPrimaryBtn checkoutSubmit" disabled={busy||!items.length}>{busy?<><Loader2 className="spin" size={18}/> Processing secure order…</>:<><LockKeyhole size={18}/> Place Order</>}</button></section><aside className="summary checkoutSummary"><div className="checkoutSecure"><LockKeyhole size={16}/> Server-verified checkout</div><h2>Order Summary</h2>{items.map((i,index)=>{const line=quoteLines[index];return <div className="checkoutLine" key={i.id}><span>{i.name}<small>{i.variant}</small><small>Qty {i.qty}{line?` • Base ${money(line.base)} + GST ${money(line.tax)}`:' • Price and GST require confirmation'}</small></span><b>{line?money(line.total):'Awaiting price'}<small>{line?' incl. GST':''}</small></b></div>})}<div><span>Subtotal before GST</span><b>{quoteReady?money(displayBase):'Awaiting price'}</b></div><div><span>GST by product</span><b>{quoteReady?money(displayTax):'Awaiting price'}</b></div><div className="grand"><span>Estimated total incl. GST</span><b>{quoteReady?money(displayGrand):'Awaiting price'}</b></div><div className="checkoutPoints"><span><CheckCircle2 size={14}/> Final standard pricing recalculated server-side</span><span><CheckCircle2 size={14}/> Visual custom builds re-priced from component master</span><span><CheckCircle2 size={14}/> Online payment marked paid only after capture verification</span></div><p className="summaryNote">Final prices and applicable GST are verified server-side before order creation.</p></aside></form></main><StoreFooter/></>
}

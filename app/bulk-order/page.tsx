'use client'
import Link from 'next/link'
import {FormEvent,useEffect,useRef,useState} from 'react'
import {Building2,CheckCircle2,FileText,Loader2,PackageSearch} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {PUBLIC_PRODUCT_SELECT,finite} from '../../lib/buyer-commerce'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
const choices=['ACDB','DCDB','MCB / MCCB','SPD','Solar Cable','Earthing Kit','MC4','Complete BOS Requirement']
export default function Bulk(){
  const [done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[context,setContext]=useState('')
  const [interest,setInterest]=useState('ACDB'),[quantity,setQuantity]=useState(''),[note,setNote]=useState('')
  const dirty=useRef(false),submitting=useRef(false),builderLoaded=useRef(false)
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search),slug=params.get('product'),draft=params.get('draft')
    const controller=new AbortController();let alive=true
    if(params.get('source')==='builder'){
      try{const raw=sessionStorage.getItem('nis-builder-rfq'),value=raw?JSON.parse(raw):null,age=Date.now()-Number(value?.createdAt)
        if(value?.version===1&&['ACDB','DCDB'].includes(value.product)&&typeof value.summary==='string'&&Number.isFinite(age)&&age>=0&&age<86400000){setInterest(value.product);setQuantity('1');setNote(value.summary.slice(0,12000));setContext('Your selected components are included below. Add your contact details to request the quotation.');builderLoaded.current=true}
        else setContext('This builder draft is unavailable or expired. Please return to the builder to send it again.')
      }catch{setContext('The builder selection could not be read. Paste your requirement below.')}
    }else if(draft&&/^[a-zA-Z0-9-]{1,80}$/.test(draft)){
      try{const raw=sessionStorage.getItem(`nis-rfq-${draft}`),value=raw?JSON.parse(raw):null
        if(value?.version===1&&typeof value.details==='string'&&typeof value.name==='string'&&Number(value.expires)>Date.now()){
          setNote(value.details.slice(0,20000));setInterest(value.type==='dcdb'?'DCDB':value.type==='acdb'?'ACDB':'Complete BOS Requirement');setQuantity('1');setContext(`Attached requirement: ${value.name.slice(0,160)}. Review it before submitting.`)
        }else setContext('This configuration draft is unavailable or expired. Please return to the builder to send it again.')
      }catch{setContext('The configuration draft could not be read. Paste your requirement below.')}
    }else if(slug){
      setContext('Loading your selected product…')
      supabase.from('products').select(PUBLIC_PRODUCT_SELECT).eq('slug',slug.slice(0,200)).eq('status','active').eq('product_variants.is_active',true).abortSignal(AbortSignal.timeout(10000)).maybeSingle().then(({data,error})=>{
        if(!alive||controller.signal.aborted)return
        if(error||!data){setContext('The selected product could not be loaded. Describe your requirement below.');return}
        const p:any=data,requested=params.get('variant'),v=(p.product_variants||[]).find((v:any)=>v.id===requested&&v.is_active)
        const q=finite(params.get('quantity'))
        if(!dirty.current){
          const category=String(p.categories?.name||'').toLowerCase();setInterest(choices.find(x=>category.includes(x.toLowerCase()))||'Complete BOS Requirement')
          if(q!==null&&q>0&&q<=1e9)setQuantity(String(q))
          setNote([`Product: ${p.name}`,v?`Variant: ${v.title||v.sku}\nSKU: ${v.sku}`:requested?'Requested variant is no longer available; please confirm an alternative.':'Please confirm the required variant.',q&&q>0?`Required quantity: ${q} ${v?.unit||'units'}`:'',`Product reference: /product/${p.slug}`, 'Please confirm pricing, availability and delivery.'].filter(Boolean).join('\n'))
        }
        setContext(`Requirement started from ${p.name}. Please review the product, quantity and notes.`)
      })
    }
    return()=>{alive=false;controller.abort()}
  },[])
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError('')
    try{const f=new FormData(e.currentTarget),row={name:f.get('name'),company_name:f.get('company'),mobile:f.get('mobile'),gst_number:f.get('gst'),city:f.get('city'),state:f.get('state'),product_interest:interest,quantity:quantity?Number(quantity):null,expected_purchase:f.get('when'),additional_requirement:note}
      const {error}=await supabase.from('bulk_rfqs').insert(row);if(error)throw error;setDone(true);if(builderLoaded.current)try{sessionStorage.removeItem('nis-builder-rfq')}catch{}
    }catch{setError('Your requirement could not be submitted. Your details have been kept; please retry.')}
    finally{submitting.current=false;setBusy(false)}
  }
  return <><StoreHeader/><main id="main-content" className="container formPage bulkPage"><div className="bulkPageGrid"><section><div className="formIntro"><span className="eyebrow darkEye">EPC • DEALER • INSTALLER • PROJECT</span><h1>Request project or bulk pricing.</h1><p>Tell us the products, quantities and delivery requirements for your project.</p></div>{done?<div className="successBox premiumSuccess" role="status"><CheckCircle2 size={34}/><h2>Requirement received.</h2><p>Your RFQ has been saved for follow-up.</p><div className="btnRow"><Link className="btn btnPrimary" href="/">Back to Home</Link><Link className="btn" href="/shop">Browse Products</Link></div></div>:<>{context&&<p className="notice" role="status">{context}</p>}<form className="rfqForm" onSubmit={submit}><label>Name<input name="name" maxLength={160} placeholder="Your full name" required/></label><label>Company<input name="company" maxLength={200} placeholder="Company / firm name"/></label><label>Mobile<input name="mobile" type="tel" maxLength={20} placeholder="Contact mobile number" required/></label><label>GST Number<input name="gst" maxLength={20} placeholder="Optional GSTIN"/></label><label>City<input name="city" maxLength={100} placeholder="Dispatch / project city"/></label><label>State<input name="state" defaultValue="Gujarat" maxLength={100}/></label><label>Product / Requirement<select value={interest} onChange={e=>{dirty.current=true;setInterest(e.target.value)}}>{choices.map(c=><option key={c}>{c}</option>)}</select></label><label>Quantity<input name="qty" type="number" min="0.01" max="1000000000" step="any" placeholder="Total quantity" value={quantity} onChange={e=>{dirty.current=true;setQuantity(e.target.value)}}/></label><label>Expected Purchase<select name="when"><option>Immediately</option><option>Within 7 Days</option><option>Within 30 Days</option></select></label><label className="full">Additional Requirement<textarea name="note" rows={9} maxLength={20000} value={note} onChange={e=>{dirty.current=true;setNote(e.target.value)}} placeholder="Ratings, selected SKU, preferred brands, quantities, delivery location…"/></label>{error&&<div className="formError full" role="alert">{error}</div>}<button className="btn btnPrimary fullBtn" disabled={busy}>{busy?<><Loader2 size={17}/> Submitting…</>:'Submit Bulk Requirement'}</button></form></>}</section><aside className="bulkAssist"><span>WHAT TO SHARE</span><h3>Complete details help us prepare your quotation.</h3><div><i><FileText size={19}/></i><section><b>Products and ratings</b><p>Include selected SKUs and configuration requirements.</p></section></div><div><i><PackageSearch size={19}/></i><section><b>Quantity and timing</b><p>State quantities, units and your expected purchase date.</p></section></div><div><i><Building2 size={19}/></i><section><b>Project location</b><p>Include the delivery city and state.</p></section></div><div className="bulkAssistNote">For larger BOQs, mention that you have a file ready. This form currently accepts text requirements.</div></aside></div></main><StoreFooter/></>
}

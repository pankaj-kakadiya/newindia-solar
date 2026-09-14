'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'
import {LogOut, Package, ReceiptText, UserRound} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'

export default function Account(){
  const [user,setUser]=useState<any>(null);const [orders,setOrders]=useState<any[]>([]);const [loading,setLoading]=useState(true)
  useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();setUser(user);if(user){const {data}=await supabase.from('orders').select('id,order_number,status,payment_status,grand_total,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);setOrders(data||[])}setLoading(false)})()},[])
  async function logout(){await supabase.auth.signOut();window.location.href='/'}
  return <><StoreHeader/><main className="container accountPage">{loading?<div className="accountLoading">Loading your account…</div>:!user?<div className="accountGuest"><UserRound size={38}/><h1>Sign in to your New India Solar account.</h1><p>Track orders and keep your business purchases linked to one account.</p><Link className="nisPrimaryBtn" href="/login?next=/account">Sign In / Create Account</Link></div>:<><div className="accountHead"><div><span className="eyebrow darkEye">MY ACCOUNT</span><h1>Welcome back.</h1><p>{user.email}</p></div><button onClick={logout}><LogOut size={16}/> Sign out</button></div><div className="accountGrid"><section className="accountCard"><div className="accountCardTitle"><ReceiptText size={19}/><div><h2>Orders</h2><p>Your recent New India Solar orders.</p></div></div>{!orders.length?<div className="accountEmpty"><Package size={30}/><h3>No orders yet.</h3><p>Your orders will appear here after checkout.</p><Link className="btn btnPrimary" href="/shop">Shop Products</Link></div>:<div className="orderList">{orders.map(o=><article key={o.id}><div><b>{o.order_number}</b><span>{new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span></div><div><span className={`orderStatus ${o.status}`}>{String(o.status).replaceAll('_',' ')}</span><small>Payment: {String(o.payment_status).replaceAll('_',' ')}</small></div><strong>₹{Number(o.grand_total||0).toLocaleString('en-IN')}</strong></article>)}</div>}</section><aside className="accountSide"><h3>Quick Actions</h3><Link href="/shop">Shop Solar Components →</Link><Link href="/customize/acdb">Build ACDB →</Link><Link href="/customize/dcdb">Build DCDB →</Link><Link href="/bulk-order">Submit Project RFQ →</Link></aside></div></>}</main><StoreFooter/></>
}

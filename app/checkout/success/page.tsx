import Link from 'next/link'
import RetryOnlinePayment from '../../../components/RetryOnlinePayment'

export default async function CheckoutSuccess({searchParams}:{searchParams:Promise<{order?:string;payment?:string}>}){
  const params=await searchParams
  const order=params?.order||'',payment=params?.payment||''
  const paid=payment==='paid',pending=payment==='pending'
  return <main className="container formPage"><div className="authCard center"><span className="eyebrow darkEye">{paid?'PAYMENT CONFIRMED':pending?'ORDER SAVED · PAYMENT PENDING':'ORDER RECEIVED'}</span><h1>{paid?'Payment received. Thank you.':pending?'Your order is safely created.':'Thank you for your order.'}</h1><p>{order?<>Your order number is <b>{order}</b>. {paid?'The payment has been server-verified and the order is recorded as paid.':pending?'The order remains active and payment-pending; retrying payment will reuse this order rather than create a duplicate.':'We have saved the order securely and it is now visible in the New India Solar admin system.'}</>:<>Your order has been received successfully.</>}</p>{pending&&order&&<RetryOnlinePayment orderNumber={order}/>}<div className="btnRow" style={{justifyContent:'center',marginTop:18}}><Link className="btn btnPrimary" href="/shop">Continue Shopping</Link><Link className="btn" href="/account">My Account</Link><Link className="btn" href="/">Back to Home</Link></div></div></main>
}

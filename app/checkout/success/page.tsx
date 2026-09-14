import Link from 'next/link'

export default async function CheckoutSuccess({searchParams}:{searchParams:Promise<{order?:string}>}){
  const params=await searchParams
  const order=params?.order||''
  return <main className="container formPage"><div className="authCard center"><span className="eyebrow darkEye">ORDER RECEIVED</span><h1>Thank you for your order.</h1><p>{order?<>Your order number is <b>{order}</b>. We have saved the order securely and it is now visible in the New India Solar admin system.</>:<>Your order has been received successfully.</>}</p><div className="btnRow" style={{justifyContent:'center'}}><Link className="btn btnPrimary" href="/shop">Continue Shopping</Link><Link className="btn" href="/">Back to Home</Link></div></div></main>
}

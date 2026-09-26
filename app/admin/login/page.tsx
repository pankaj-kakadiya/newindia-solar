import {Suspense} from 'react'
import AdminLogin from '../../../components/auth/AdminLogin'

export default function Login(){
 return <Suspense fallback={<main className="adminLoginV2"><p>Loading secure sign in…</p></main>}><AdminLogin/></Suspense>
}

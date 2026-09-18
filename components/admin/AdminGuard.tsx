'use client'
import {useEffect,useState} from 'react'
import {usePathname,useRouter} from 'next/navigation'
import {supabase} from '../../lib/supabase'
import {AdminAccess,canAdmin,moduleForAdminPath} from '../../lib/adminAccess'

export default function AdminGuard({children}:{children:React.ReactNode}){
  const router=useRouter()
  const path=usePathname()
  const [ok,setOk]=useState(false)
  const isLogin=path==='/admin/login'
  const isPassword=path==='/admin/change-password'
  const isSecurity=path==='/admin/account-security'

  useEffect(()=>{
    let alive=true
    ;(async()=>{
      const {data:{user}}=await supabase.auth.getUser()
      if(!user){
        if(!isLogin)router.replace('/admin/login')
        else if(alive)setOk(true)
        return
      }

      const {data:profile}=await supabase.from('profiles').select('role,staff_status,must_change_password,mfa_required').eq('id',user.id).maybeSingle()
      const internal=['admin','staff'].includes(profile?.role||'')&&profile?.staff_status!=='suspended'&&profile?.staff_status!=='inactive'
      if(!internal){
        await supabase.auth.signOut()
        router.replace('/admin/login?access=denied')
        return
      }
      if(isLogin){router.replace('/admin');return}

      if(profile?.must_change_password&&!isPassword){router.replace('/admin/change-password?required=1');return}
      if(profile?.mfa_required&&!isPassword&&!isSecurity){
        const {data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if(aal?.currentLevel!=='aal2'){router.replace('/admin/account-security?required=1');return}
      }

      const {data:accessData}=await supabase.rpc('get_my_admin_access')
      const access=(accessData||null) as AdminAccess|null
      const moduleKey=moduleForAdminPath(path)
      if(moduleKey&&!canAdmin(access,moduleKey,'view')){
        router.replace('/admin?access=denied')
        return
      }

      try{
        const key=`nis-admin-session-${user.id}`
        if(!window.sessionStorage.getItem(key)){
          await supabase.rpc('record_admin_session')
          window.sessionStorage.setItem(key,'1')
        }
      }catch{}
      if(alive)setOk(true)
    })()
    return()=>{alive=false}
  },[router,isLogin,isPassword,isSecurity,path])

  if(isLogin)return <>{children}</>
  if(!ok)return <div className="adminLoading">Checking secure access…</div>
  return <>{children}</>
}

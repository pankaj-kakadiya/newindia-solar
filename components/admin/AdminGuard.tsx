'use client'
import {useEffect,useState} from 'react'
import {usePathname,useRouter} from 'next/navigation'
import {supabase} from '../../lib/supabase'
import {AdminAccess,canAdmin,moduleForAdminPath} from '../../lib/adminAccess'
import {adminSecurityRedirect,readMfaState} from '../../lib/mfa'

export default function AdminGuard({children}:{children:React.ReactNode}){
  const router=useRouter(),path=usePathname()
  const [allowedPath,setAllowedPath]=useState(''),[revision,setRevision]=useState(0),[error,setError]=useState('')
  const isLogin=path==='/admin/login'
  useEffect(()=>{
    const {data}=supabase.auth.onAuthStateChange(event=>{
      // Do not await another Auth call inside the auth event lock.
      if(['SIGNED_OUT','TOKEN_REFRESHED','MFA_CHALLENGE_VERIFIED'].includes(event)){setAllowedPath('');setRevision(v=>v+1)}
    })
    return()=>data.subscription.unsubscribe()
  },[])
  useEffect(()=>{
    let alive=true
    setAllowedPath('');setError('')
    ;(async()=>{
      try{
        const {data:{user},error:userError}=await supabase.auth.getUser()
        if(!alive)return
        if(userError||!user){if(!isLogin)router.replace('/admin/login');return}
        const {data:profile,error:profileError}=await supabase.from('profiles').select('role,staff_status,must_change_password,mfa_required').eq('id',user.id).maybeSingle()
        if(profileError)throw profileError
        if(!['admin','staff'].includes(profile?.role||'')||profile?.staff_status!=='active'){
          await supabase.auth.signOut();if(alive)router.replace('/admin/login?access=denied');return
        }
        if(isLogin){router.replace('/admin');return}
        const mfa=await readMfaState(supabase)
        if(!alive)return
        const redirect=adminSecurityRedirect(profile,mfa,path)
        if(redirect){router.replace(redirect);return}
        // Bootstrap pages stay reachable while business permissions are locked.
        if(path==='/admin/account-security'||path==='/admin/change-password'){setAllowedPath(path);return}
        const {data:accessData,error:accessError}=await supabase.rpc('get_my_admin_access')
        if(accessError)throw accessError
        const access=(accessData||null) as AdminAccess|null
        if(access?.session_ready===false){await supabase.auth.signOut({scope:'local'});if(alive)router.replace('/admin/login');return}
        const moduleKey=moduleForAdminPath(path)
        if(!access||(moduleKey&&!canAdmin(access,moduleKey,'view'))){router.replace('/admin?access=denied');return}
        try{
          const key=`nis-admin-session-${user.id}`
          if(!window.sessionStorage.getItem(key)){await supabase.rpc('record_admin_session');window.sessionStorage.setItem(key,'1')}
        }catch{}
        if(alive)setAllowedPath(path)
      }catch(error:any){if(alive)setError(error.message||'Could not verify account security.')}
    })()
    return()=>{alive=false}
  },[router,path,isLogin,revision])
  if(isLogin)return <>{children}</>
  if(error)return <div className="adminLoading" role="alert">{error} <button onClick={()=>setRevision(v=>v+1)}>Retry</button></div>
  if(allowedPath!==path)return <div className="adminLoading">Checking secure access…</div>
  return <>{children}</>
}

export const staffRoles=['general','sales','finance','production','inventory','content'] as const
export type StaffRole=string

export type ManualTeamUserInput={full_name:string;email:string;phone?:string;admin_role:string;job_title?:string;temporary_password:string}
export type ValidatedTeamUser={full_name:string;email:string;phone:string|null;admin_role:StaffRole;job_title:string|null;temporary_password:string}

export function validateTemporaryPassword(value:unknown){
 const password=String(value||'')
 if(password.length<12||password.length>72)return 'Temporary password must be 12–72 characters.'
 if(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))return 'Temporary password needs uppercase, lowercase, number and symbol characters.'
 return null
}

export function validateManualTeamUser(value:unknown):{data?:ValidatedTeamUser;error?:string}{
 if(!value||typeof value!=='object')return {error:'Invalid team-user details.'}
 const input=value as Partial<ManualTeamUserInput>
 const full_name=String(input.full_name||'').trim().replace(/\s+/g,' ')
 const email=String(input.email||'').trim().toLowerCase()
 const phone=String(input.phone||'').trim().replace(/[\s()-]/g,'')
 const admin_role=String(input.admin_role||'')
 const job_title=String(input.job_title||'').trim().replace(/\s+/g,' ')
 const temporary_password=String(input.temporary_password||'')
 if(full_name.length<2||full_name.length>100)return {error:'Enter a valid full name (2–100 characters).'}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return {error:'Enter a valid work email address.'}
 if(phone&&!/^\+[1-9]\d{7,14}$/.test(phone))return {error:'Enter the mobile number with country code, for example +919876543210.'}
 if(admin_role==='admin'||!/^[a-z][a-z0-9_]{1,39}$/.test(admin_role))return {error:'Select a valid department role.'}
 if(job_title.length>80)return {error:'Job title must be 80 characters or fewer.'}
 const passwordError=validateTemporaryPassword(temporary_password)
 if(passwordError)return {error:passwordError}
 return {data:{full_name,email,phone:phone||null,admin_role,job_title:job_title||null,temporary_password}}
}

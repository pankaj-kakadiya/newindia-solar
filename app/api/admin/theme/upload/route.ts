import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {NextRequest,NextResponse} from 'next/server'
import DOMPurify from 'isomorphic-dompurify'
import {requireServerAdminPermission} from '../../../../../lib/serverAdminAuth'

const MAX_BYTES=5*1024*1024
const SIGNATURES:{ext:string;contentType:string;check:(b:Uint8Array)=>boolean}[]=[
 {ext:'png',contentType:'image/png',check:b=>b.length>=8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47&&b[4]===0x0D&&b[5]===0x0A&&b[6]===0x1A&&b[7]===0x0A},
 {ext:'jpg',contentType:'image/jpeg',check:b=>b.length>=3&&b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF},
 {ext:'webp',contentType:'image/webp',check:b=>b.length>=12&&b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50},
 {ext:'ico',contentType:'image/x-icon',check:b=>b.length>=4&&b[0]===0x00&&b[1]===0x00&&b[2]===0x01&&b[3]===0x00}
]

function detectImage(buf:Uint8Array){return SIGNATURES.find(s=>s.check(buf))||null}
function looksLikeSvg(buf:Uint8Array){const head=Buffer.from(buf.slice(0,512)).toString('utf8').replace(/^﻿/,'').trimStart();return /^<\?xml|^<svg/i.test(head)}
function response(body:Record<string,unknown>,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})}

function serviceAdmin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null
}

export async function POST(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'theme','edit')
 if(auth instanceof NextResponse)return auth
 let form:FormData
 try{form=await request.formData()}catch{return response({error:'Invalid upload payload.'},400)}
 const file=form.get('file')
 const target=String(form.get('target')||'logo').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40)||'logo'
 if(!(file instanceof File))return response({error:'No file was uploaded.'},400)
 if(file.size<=0)return response({error:'The uploaded file is empty.'},400)
 if(file.size>MAX_BYTES)return response({error:'Logo must be 5 MB or smaller.'},400)

 const buf=new Uint8Array(await file.arrayBuffer())
 const image=detectImage(buf)
 let ext:string,contentType:string,uploadBytes:Uint8Array|Buffer=buf
 if(image){
  ext=image.ext;contentType=image.contentType
 }else if(looksLikeSvg(buf)){
  const sanitized=DOMPurify.sanitize(Buffer.from(buf).toString('utf8'),{USE_PROFILES:{svg:true,svgFilters:true}})
  if(!sanitized.trim())return response({error:'The SVG file could not be safely processed.'},400)
  ext='svg';contentType='image/svg+xml';uploadBytes=Buffer.from(sanitized,'utf8')
 }else{
  return response({error:'Unsupported file. Use PNG, JPEG, WEBP, ICO or SVG.'},400)
 }

 const admin=serviceAdmin()
 if(!admin)return response({error:'Storage service is not configured.'},503)
 const path=`branding/${target}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
 const {error:uploadError}=await admin.storage.from('theme-assets').upload(path,uploadBytes,{contentType,cacheControl:'3600',upsert:false})
 if(uploadError)return response({error:uploadError.message||'Upload failed.'},500)
 const {data}=admin.storage.from('theme-assets').getPublicUrl(path)
 return response({url:data.publicUrl})
}

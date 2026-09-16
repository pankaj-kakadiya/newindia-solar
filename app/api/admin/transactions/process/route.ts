import {NextRequest,NextResponse} from 'next/server'
import {requireServerAdminPermission} from '../../../../../../lib/serverAdminAuth'
import {processCommunicationQueue} from '../../../../../../lib/transactionRuntime'

export async function POST(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'transactions','approve')
 if(auth instanceof NextResponse)return auth
 let body:any={};try{body=await request.json()}catch{}
 try{
  const results=await processCommunicationQueue(Number(body?.limit||20))
  return NextResponse.json({processed:results.length,results})
 }catch(error:any){return NextResponse.json({error:String(error?.message||error)},{status:503})}
}

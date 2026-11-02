import {NextResponse} from 'next/server'
import {parseSldcHome} from '../../../../lib/solar-market'

// Public relay for the three headline figures on the SLDC Gujarat home page (grid frequency,
// Gujarat demand, DAM rate). SLDC turns away servers outside India, so on Vercel this runs in Mumbai;
// the admin dashboard's server route falls back to it when its own request is refused.
export const runtime='edge'
export const dynamic='force-dynamic'
export const preferredRegion=['bom1']


let cache:{at:number;body:any}|null=null

export async function GET(){
 if(cache&&Date.now()-cache.at<60_000)return NextResponse.json(cache.body,{headers:{'Cache-Control':'public, max-age=60','Access-Control-Allow-Origin':'*'}})
 const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),10_000)
 try{
  const r=await fetch('https://www.sldcguj.com/',{signal:ctrl.signal,cache:'no-store',headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36','Accept':'text/html,application/xhtml+xml','Accept-Language':'en-IN,en;q=0.9'}})
  if(!r.ok)return NextResponse.json({error:`sldcguj.com answered HTTP ${r.status}`,region:process.env.VERCEL_REGION||null},{status:502,headers:{'Cache-Control':'no-store'}})
  const live=parseSldcHome(await r.text())
  if(live.demand_mw==null&&live.frequency_hz==null)return NextResponse.json({error:'Live figures not found on the SLDC page',region:process.env.VERCEL_REGION||null},{status:502,headers:{'Cache-Control':'no-store'}})
  const body={...live,observed_at:new Date().toISOString(),region:process.env.VERCEL_REGION||null}
  cache={at:Date.now(),body}
  return NextResponse.json(body,{headers:{'Cache-Control':'public, max-age=60','Access-Control-Allow-Origin':'*'}})
 }catch(e:any){
  return NextResponse.json({error:e?.name==='AbortError'?'sldcguj.com did not answer in 10s':String(e?.message||e),region:process.env.VERCEL_REGION||null},{status:502,headers:{'Cache-Control':'no-store'}})
 }finally{clearTimeout(t)}
}

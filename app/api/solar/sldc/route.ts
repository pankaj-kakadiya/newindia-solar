import {NextResponse} from 'next/server'

// Self-contained copy of parseSldcHome (lib/solar-market.ts on main), so this branch needs no other files.
function parseSldcHome(html:string){
 const text=String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ')
 const pick=(re:RegExp)=>{const m=text.match(re);if(!m)return null;const n=Number(m[1].replace(/,/g,''));return Number.isFinite(n)?n:null}
 const f=pick(/Grid Frequency\s*:\s*([\d.]+)\s*Hz/i),d=pick(/Gujarat Catered\s*:\s*([\d,.]+)\s*MW/i),r=pick(/DAM Rate\s*:\s*([\d.]+)\s*Rs/i)
 return{frequency_hz:f!=null&&f>45&&f<55?f:null,demand_mw:d!=null&&d>1000&&d<60000?d:null,dam_rate:r!=null&&r>=0&&r<50?r:null}
}

// Public relay (CORS open, cached 60 s) for the three headline figures on the SLDC Gujarat home page (grid frequency,
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

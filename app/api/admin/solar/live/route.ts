import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {requireServerAdminPermission} from '../../../../../lib/serverAdminAuth'
import {SOLAR_SITES,estimateDailyKwh,estimateOutputMw,parseSldcHome,type SldcLive} from '../../../../../lib/solar-market'

export const dynamic='force-dynamic'

// Live Gujarat grid (SLDC Gujarat home page) and sunlight (Open-Meteo) for the solar dashboard.
// Readings are stored in energy_readings so the dashboard can chart the day. A scheduled job may call
// this route with the x-energy-cron header (ENERGY_CRON_SECRET) to keep collecting when nobody is viewing.

type Cached<T>={at:number;value:T}
let sldcCache:Cached<SldcLive&{observed_at:string}>|null=null
let weatherCache:Cached<any[]>|null=null

// SLDC's firewall turns away unknown bots, so ask the way a browser does.
const BROWSER_HEADERS={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8','Accept-Language':'en-IN,en;q=0.9'}

async function fetchText(url:string,ms=10000){
 const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),ms)
 try{const r=await fetch(url,{signal:ctrl.signal,headers:BROWSER_HEADERS,cache:'no-store',redirect:'follow'});if(!r.ok)throw new Error(`${new URL(url).host} answered HTTP ${r.status}`);return await r.text()}
 catch(e:any){if(e?.name==='AbortError')throw new Error(`${new URL(url).host} did not answer within ${ms/1000}s`);throw new Error(e?.cause?.code?`${new URL(url).host}: ${e.cause.code}`:String(e?.message||e))}
 finally{clearTimeout(t)}
}

async function sldc(){
 if(sldcCache&&Date.now()-sldcCache.at<120_000)return sldcCache.value
 let html=''
 try{html=await fetchText('https://www.sldcguj.com/')}catch(first){try{html=await fetchText('https://sldcguj.com/')}catch{throw first}}
 const live=parseSldcHome(html)
 if(live.demand_mw==null&&live.frequency_hz==null)throw new Error('SLDC page opened but the live figures were not on it')
 // Five-minute buckets keep one stored reading per metric per interval, however many people are viewing.
 const bucket=new Date(Math.floor(Date.now()/300_000)*300_000).toISOString()
 const value={...live,observed_at:bucket}
 sldcCache={at:Date.now(),value}
 return value
}

async function weather(){
 if(weatherCache&&Date.now()-weatherCache.at<600_000)return weatherCache.value
 const lat=SOLAR_SITES.map(s=>s.lat).join(','),lon=SOLAR_SITES.map(s=>s.lon).join(',')
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,cloud_cover,shortwave_radiation,is_day&daily=shortwave_radiation_sum,sunshine_duration&timezone=Asia%2FKolkata&forecast_days=1`
 const json=JSON.parse(await fetchText(url))
 const list=Array.isArray(json)?json:[json]
 const value=SOLAR_SITES.map((s,i)=>{const w=list[i]||{};const radiation=Number(w.daily?.shortwave_radiation_sum?.[0]??0);return{...s,irradiance:Number(w.current?.shortwave_radiation??0),cloud_cover:w.current?.cloud_cover??null,temperature:w.current?.temperature_2m??null,is_day:Boolean(w.current?.is_day),radiation_mj:radiation,sunshine_hours:Math.round(Number(w.daily?.sunshine_duration?.[0]??0)/360)/10,kwh_today_2_18:Math.round(estimateDailyKwh(2.18,radiation)*10)/10,observed_at:w.current?.time?`${w.current.time}:00+05:30`:null}})
 weatherCache={at:Date.now(),value}
 return value
}

export async function GET(request:NextRequest){
 try{return await handle(request)}catch(e:any){return NextResponse.json({error:`Live data failed: ${e?.message||e}`},{status:500,headers:{'Cache-Control':'no-store'}})}
}

async function handle(request:NextRequest){
 const cronSecret=process.env.ENERGY_CRON_SECRET
 const isCron=Boolean(cronSecret)&&request.headers.get('x-energy-cron')===cronSecret
 let db:any=null
 if(isCron){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)return NextResponse.json({error:'SUPABASE_SERVICE_ROLE_KEY is needed for scheduled collection.'},{status:503})
  db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 }else{
  let auth=await requireServerAdminPermission(request,'campaigns','view')
  if(auth instanceof NextResponse){const alt=await requireServerAdminPermission(request,'reports','view');if(alt instanceof NextResponse)return auth;auth=alt}
  db=auth.client
 }

 const [grid,sun]=await Promise.allSettled([sldc(),weather()])
 const gridValue=grid.status==='fulfilled'?grid.value:null
 const sunValue=sun.status==='fulfilled'?sun.value:[]

 let stored=0
 if(gridValue){
  const rows=[['gujarat_demand_mw',gridValue.demand_mw],['grid_frequency_hz',gridValue.frequency_hz],['dam_rate_rs',gridValue.dam_rate]].filter(([,v])=>v!=null).map(([metric,value])=>({observed_at:gridValue.observed_at,source:'sldcguj.com',metric,value}))
  if(rows.length){const {error}=await db.from('energy_readings').upsert(rows,{onConflict:'source,metric,observed_at',ignoreDuplicates:true});if(!error)stored=rows.length}
 }
 if(isCron)return NextResponse.json({ok:true,stored,grid:gridValue},{headers:{'Cache-Control':'no-store'}})

 const since=new Date(Date.now()-36*3600_000).toISOString()
 const [history,gujarat]=await Promise.all([
  db.from('energy_readings').select('observed_at,metric,value').gte('observed_at',since).order('observed_at').limit(3000),
  db.from('pmsg_stats').select('snapshot_date,capacity_mw').eq('level','state').ilike('state','gujarat').order('snapshot_date',{ascending:false}).limit(1),
 ])
 const installedMw=Number(gujarat.data?.[0]?.capacity_mw||0)
 const campaignSites=sunValue.slice(0,3)
 const avgIrradiance=sunValue.length?sunValue.reduce((a:number,s:any)=>a+s.irradiance,0)/sunValue.length:0
 return NextResponse.json({
  grid:gridValue,grid_error:grid.status==='rejected'?String(grid.reason?.message||grid.reason):null,
  sun:sunValue,sun_error:sun.status==='rejected'?String(sun.reason?.message||sun.reason):null,
  rooftop:{installed_mw:installedMw,installed_as_of:gujarat.data?.[0]?.snapshot_date||null,avg_irradiance:Math.round(avgIrradiance),estimated_output_mw:Math.round(estimateOutputMw(installedMw,avgIrradiance)),campaign_kwh_today_2_18:campaignSites.length?Math.round(campaignSites.reduce((a:number,s:any)=>a+s.kwh_today_2_18,0)/campaignSites.length*10)/10:null},
  history:history.data||[],stored,
  sources:{grid:'https://www.sldcguj.com/',sun:'https://open-meteo.com/',rooftop:'https://pmsuryaghar.gov.in/#/state-ut-wise-progress'},
 },{headers:{'Cache-Control':'no-store'}})
}

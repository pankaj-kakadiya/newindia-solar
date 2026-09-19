import 'server-only'

type Bucket={count:number;resetAt:number}
const buckets=new Map<string,Bucket>()

const cleanup=setInterval(()=>{
 const now=Date.now()
 for(const [key,bucket] of buckets)if(bucket.resetAt<=now)buckets.delete(key)
},5*60*1000)
cleanup.unref?.()

/**
 * In-memory sliding-window limiter. Scoped to a single server instance, so on a
 * multi-instance deployment the effective limit is (limit * instance count) — a
 * meaningful speed bump against scripted abuse, not a hard multi-region guarantee.
 */
export function rateLimit(key:string,limit:number,windowMs:number):{allowed:boolean;retryAfterMs:number}{
 const now=Date.now()
 const bucket=buckets.get(key)
 if(!bucket||bucket.resetAt<=now){
  buckets.set(key,{count:1,resetAt:now+windowMs})
  return {allowed:true,retryAfterMs:0}
 }
 if(bucket.count>=limit)return {allowed:false,retryAfterMs:bucket.resetAt-now}
 bucket.count+=1
 return {allowed:true,retryAfterMs:0}
}

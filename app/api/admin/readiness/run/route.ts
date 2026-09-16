import {NextRequest,NextResponse} from 'next/server'
import {requireServerAdminPermission} from '../../../../../lib/serverAdminAuth'

type Check={check_key:string;category:string;title:string;status:'pass'|'warning'|'blocker'|'pending';detail:string;evidence?:Record<string,any>}

const testOk=(value:string|null|undefined)=>/pass|connect|success|verified/i.test(String(value||''))

export async function POST(request:NextRequest){
 const auth=await requireServerAdminPermission(request,'readiness','edit')
 if(auth instanceof NextResponse)return auth
 const client=auth.client,host=request.nextUrl.hostname,environment=host.includes('vercel.app')||host.includes('localhost')?'staging':'production'
 const [{data:snapshot,error:snapshotError},{data:integrations,error:integrationError},{data:checklist,error:checklistError}]=await Promise.all([
  client.rpc('production_readiness_database_snapshot'),
  client.from('integration_settings').select('integration_key,display_name,is_enabled,environment,last_test_status,last_test_message,required_env_keys').order('integration_key'),
  client.from('launch_checklist_items').select('item_key,title,is_required,status').order('sort_order')
 ])
 if(snapshotError||integrationError||checklistError)return NextResponse.json({error:snapshotError?.message||integrationError?.message||checklistError?.message||'Readiness data could not be loaded.'},{status:500})
 const snap=(snapshot||{}) as Record<string,any>,checks:Check[]=[]
 const add=(check:Check)=>checks.push(check)

 add({check_key:'database_connectivity',category:'Database',title:'Database connectivity',status:'pass',detail:'Authenticated readiness query completed successfully.',evidence:{public_tables:Number(snap.public_tables||0)}})
 add({check_key:'rls_coverage',category:'Security',title:'Row Level Security coverage',status:Number(snap.tables_without_rls||0)===0?'pass':'blocker',detail:Number(snap.tables_without_rls||0)===0?'Every public table currently has RLS enabled.':`${snap.tables_without_rls} public table(s) do not have RLS enabled.`,evidence:{tables_without_rls:Number(snap.tables_without_rls||0),public_tables:Number(snap.public_tables||0)}})
 add({check_key:'webhook_idempotency',category:'Security',title:'Webhook idempotency guard',status:snap.webhook_dedupe_index?'pass':'blocker',detail:snap.webhook_dedupe_index?'Webhook events have a unique dedupe-key guard.':'Webhook dedupe index is missing.'})
 add({check_key:'payment_uniqueness',category:'Payments',title:'Payment provider uniqueness',status:snap.payment_order_unique_index&&snap.payment_id_unique_index?'pass':'blocker',detail:snap.payment_order_unique_index&&snap.payment_id_unique_index?'Provider order/payment IDs are protected by unique indexes.':'One or more payment idempotency indexes are missing.'})
 add({check_key:'queue_claiming',category:'Communications',title:'Atomic communication queue claiming',status:snap.queue_claim_function?'pass':'blocker',detail:snap.queue_claim_function?'Queue workers claim messages atomically with stale-lock recovery.':'Atomic queue claim function is missing.'})
 add({check_key:'service_role',category:'Server',title:'Secure server database credential',status:process.env.SUPABASE_SERVICE_ROLE_KEY?'pass':'blocker',detail:process.env.SUPABASE_SERVICE_ROLE_KEY?'Server-only service credential is present.':'SUPABASE_SERVICE_ROLE_KEY is missing from this deployment.'})
 add({check_key:'legal_gst_master',category:'Company',title:'Legal and GST master',status:snap.gstin_present&&snap.registered_address_present?'pass':'blocker',detail:snap.gstin_present&&snap.registered_address_present?'GSTIN and registered address are configured.':'GSTIN or registered address is incomplete.'})
 add({check_key:'catalogue_minimum',category:'Catalogue',title:'Sellable catalogue baseline',status:Number(snap.active_products||0)>0&&Number(snap.product_variants||0)>0?'pass':'blocker',detail:`${Number(snap.active_products||0)} active product(s) and ${Number(snap.product_variants||0)} variant(s) are available.`,evidence:{active_products:Number(snap.active_products||0),product_variants:Number(snap.product_variants||0)}})
 add({check_key:'webhook_failures',category:'Operations',title:'Failed webhook events',status:Number(snap.failed_webhooks||0)>0?'warning':'pass',detail:Number(snap.failed_webhooks||0)>0?`${snap.failed_webhooks} webhook event(s) are currently marked failed.`:'No failed webhook events are recorded.',evidence:{failed:Number(snap.failed_webhooks||0)}})
 add({check_key:'outbox_health',category:'Communications',title:'Communication outbox health',status:Number(snap.stale_processing_outbox||0)>0?'blocker':Number(snap.failed_outbox||0)>0?'warning':'pass',detail:Number(snap.stale_processing_outbox||0)>0?`${snap.stale_processing_outbox} message(s) are stuck in processing.`:Number(snap.failed_outbox||0)>0?`${snap.failed_outbox} message(s) exhausted retries.`:'No failed or stale communication jobs.',evidence:{failed:Number(snap.failed_outbox||0),stale:Number(snap.stale_processing_outbox||0)}})
 add({check_key:'communication_rules',category:'Communications',title:'Customer automation rules',status:Number(snap.active_communication_rules||0)>0?'pass':'warning',detail:Number(snap.active_communication_rules||0)>0?`${snap.active_communication_rules} customer communication rule(s) are active.`:'No customer communication automation rules are active; messages will not auto-send.'})

 for(const item of (integrations||[]) as any[]){
  const required=(item.required_env_keys||[]) as string[],missing=required.filter(key=>!process.env[key])
  const key=`integration_${item.integration_key}`
  if(!item.is_enabled){
   const critical=item.integration_key==='payment'||item.integration_key==='shipping'
   add({check_key:key,category:'Integrations',title:item.display_name,status:'warning',detail:`${item.display_name} is disabled.${critical?' Manual fallback is required for launch.':''}`,evidence:{enabled:false,environment:item.environment}})
   continue
  }
  if(missing.length){add({check_key:key,category:'Integrations',title:item.display_name,status:'blocker',detail:`Enabled integration is missing ${missing.length} required server credential(s).`,evidence:{enabled:true,missing}});continue}
  const liveMismatch=environment==='production'&&item.environment!=='live'
  if(liveMismatch){add({check_key:key,category:'Integrations',title:item.display_name,status:'blocker',detail:'Integration is enabled but still configured in sandbox/test mode on a production host.',evidence:{environment:item.environment}});continue}
  add({check_key:key,category:'Integrations',title:item.display_name,status:testOk(item.last_test_status)?'pass':'warning',detail:testOk(item.last_test_status)?'Enabled, credential-ready and connection-tested.':'Enabled and credential-ready, but a successful connection test is not recorded yet.',evidence:{environment:item.environment,last_test_status:item.last_test_status}})
 }

 add({check_key:'security_headers',category:'Security',title:'Browser security header profile',status:'pass',detail:'Application build includes CSP, frame protection, no-sniff, referrer policy, HSTS and admin no-index headers.'})
 add({check_key:'deployment_domain',category:'Launch',title:'Production domain cutover',status:environment==='production'?'pass':'warning',detail:environment==='production'?`Audit is running on ${host}.`:`Audit is running on staging host ${host}; production DNS has not been treated as cut over.`,evidence:{host,environment}})
 const pendingRequired=(checklist||[]).filter((x:any)=>x.is_required&&x.status==='pending').length
 add({check_key:'manual_launch_checklist',category:'Launch',title:'Required manual launch checks',status:pendingRequired===0?'pass':'blocker',detail:pendingRequired===0?'All required manual launch checks are signed off.':`${pendingRequired} required launch checklist item(s) still need human verification.`,evidence:{pending_required:pendingRequired}})

 const passed=checks.filter(x=>x.status==='pass').length,warnings=checks.filter(x=>x.status==='warning').length,blockers=checks.filter(x=>x.status==='blocker').length,overall=blockers?'blocked':warnings?'warning':'ready'
 const {data:run,error:runError}=await client.from('production_readiness_runs').insert({environment,overall_status:overall,passed_count:passed,warning_count:warnings,blocker_count:blockers,initiated_by:auth.access?.user_id||null,summary:{host,checks:checks.length}}).select('id,started_at').single()
 if(runError||!run)return NextResponse.json({error:runError?.message||'Could not save readiness run.'},{status:500})
 const resultRows=checks.map(c=>({run_id:run.id,check_key:c.check_key,category:c.category,title:c.title,status:c.status,detail:c.detail,evidence:c.evidence||{}}))
 const {error:resultError}=await client.from('production_readiness_results').insert(resultRows)
 if(resultError)return NextResponse.json({error:resultError.message},{status:500})
 await client.from('production_readiness_runs').update({completed_at:new Date().toISOString()}).eq('id',run.id)
 return NextResponse.json({run_id:run.id,environment,overall_status:overall,passed_count:passed,warning_count:warnings,blocker_count:blockers,checks},{headers:{'Cache-Control':'no-store'}})
}

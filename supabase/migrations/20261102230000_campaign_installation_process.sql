-- 9-step installation process per household lead (see lib/installation-process.ts).
-- { stepKey: { done_at: 'YYYY-MM-DD' | null, checks: { itemKey: true }, note: text } }
alter table public.campaign_leads add column if not exists process jsonb not null default '{}'::jsonb;
alter table public.campaign_leads drop constraint if exists campaign_leads_process_object;
alter table public.campaign_leads add constraint campaign_leads_process_object check (jsonb_typeof(process)='object');

-- Step changes are logged on the lead's activity timeline.
alter table public.campaign_lead_activities drop constraint if exists campaign_lead_activities_activity_type_check;
alter table public.campaign_lead_activities add constraint campaign_lead_activities_activity_type_check check(activity_type in('note','call','whatsapp','visit','stage_change','system','process'));

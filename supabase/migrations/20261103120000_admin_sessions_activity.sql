-- Admin session security and user activity.
--  * One active admin session per person (newest sign-in wins; the older device is signed out).
--  * Automatic sign-out after inactivity, and a maximum session length, both enforced by the database
--    through nis_security.admin_session_ready(), so a closed laptop or an old tab cannot come back.
--  * Owner can sign a person out everywhere.
--  * admin_activity: who did what and when (sign-ins, sign-outs, pages opened, campaign record changes).
-- Settings live in admin_security_settings (single row) and are edited from Access → Session security.

create schema if not exists nis_security;

create table if not exists public.admin_security_settings(
  id smallint primary key default 1 check(id=1),
  idle_timeout_minutes integer not null default 30 check(idle_timeout_minutes between 5 and 480),
  max_session_hours integer not null default 12 check(max_session_hours between 1 and 168),
  single_session boolean not null default true,
  track_page_views boolean not null default true,
  -- One dedicated, low-permission account used by the daily portal snapshot task: no idle or maximum-length
  -- sign-out (it is idle between runs), but still one session and still owner sign-out.
  automation_user_id uuid,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.admin_security_settings(id) values(1) on conflict(id) do nothing;
alter table public.admin_security_settings add column if not exists automation_user_id uuid;

create table if not exists nis_security.admin_sessions(
  session_id uuid primary key,
  user_id uuid not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  user_agent text
);
create index if not exists admin_sessions_user on nis_security.admin_sessions(user_id,started_at desc);

-- "Sign out everywhere": sessions created before this moment are no longer accepted.
create table if not exists nis_security.session_cutoffs(
  user_id uuid primary key,
  revoked_before timestamptz not null,
  revoked_by uuid
);

create table if not exists public.admin_activity(
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  user_name text,
  session_id uuid,
  event text not null check(event in('login','logout','auto_logout','session_replaced','session_expired','session_revoked','page_view','create','update','delete','export','import','assign','settings_change','force_logout')),
  module_key text,
  path text check(path is null or length(path)<=300),
  entity_table text,
  entity_id text,
  description text check(description is null or length(description)<=1000),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists admin_activity_recent on public.admin_activity(created_at desc);
create index if not exists admin_activity_user on public.admin_activity(user_id,created_at desc);
create index if not exists admin_activity_module on public.admin_activity(module_key,created_at desc);

-- Why the current session is (not) usable: ok | missing | expired | replaced | idle | revoked | ended.
create or replace function nis_security.admin_session_status()
returns text language plpgsql stable security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
  v_created timestamptz; v_cfg public.admin_security_settings%rowtype; v_rec nis_security.admin_sessions%rowtype; v_cutoff timestamptz;
begin
  if v_uid is null or v_sid is null then return 'missing'; end if;
  select s.created_at into v_created from auth.sessions s where s.id=v_sid and s.user_id=v_uid;
  if not found then return 'missing'; end if;
  select * into v_cfg from public.admin_security_settings where id=1;
  select revoked_before into v_cutoff from nis_security.session_cutoffs where user_id=v_uid;
  if v_cutoff is not null and coalesce(v_created,'-infinity'::timestamptz)<v_cutoff then return 'revoked'; end if;
  select * into v_rec from nis_security.admin_sessions where session_id=v_sid;
  if found and v_rec.ended_at is not null then return 'ended'; end if;
  if v_uid is distinct from v_cfg.automation_user_id and v_created is not null and v_created<now()-make_interval(hours=>coalesce(v_cfg.max_session_hours,12)) then return 'expired'; end if;
  if coalesce(v_cfg.single_session,true) and exists(
    select 1 from auth.sessions s2 where s2.user_id=v_uid and s2.id<>v_sid and s2.created_at>v_created
      and not exists(select 1 from nis_security.admin_sessions e where e.session_id=s2.id and e.ended_at is not null))
    then return 'replaced'; end if;
  -- One minute of grace covers a heartbeat in flight.
  if v_rec.session_id is not null and v_uid is distinct from v_cfg.automation_user_id and v_rec.last_active_at<now()-make_interval(mins=>coalesce(v_cfg.idle_timeout_minutes,30)+1) then return 'idle'; end if;
  return 'ok';
end;
$$;

create or replace function nis_security.admin_session_ready()
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce((select case when p.role::text not in ('admin','staff') then true else
    p.staff_status='active' and not p.must_change_password
    and nis_security.admin_mfa_satisfied()
    and nis_security.admin_session_status()='ok'
    end from public.profiles p where p.id=auth.uid()),false);
$$;
revoke all on function nis_security.admin_session_status(),nis_security.admin_session_ready() from public,anon,authenticated;
grant execute on function nis_security.admin_session_ready() to authenticated;

create or replace function nis_security.actor()
returns table(user_id uuid,user_email text,user_name text)
language plpgsql stable security definer set search_path=''
as $$
declare v_name text;
begin
  begin execute 'select full_name from public.profiles where id=$1' into v_name using auth.uid(); exception when undefined_column then v_name:=null; end;
  return query select auth.uid(),(select u.email::text from auth.users u where u.id=auth.uid()),v_name;
end;
$$;

create or replace function nis_security.write_activity(p_event text,p_module text,p_path text,p_entity_table text,p_entity_id text,p_description text,p_metadata jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare a record;
begin
  select * into a from nis_security.actor();
  insert into public.admin_activity(user_id,user_email,user_name,session_id,event,module_key,path,entity_table,entity_id,description,metadata)
  values(a.user_id,a.user_email,a.user_name,nullif(auth.jwt()->>'session_id','')::uuid,p_event,p_module,left(p_path,300),p_entity_table,p_entity_id,left(p_description,1000),coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function nis_security.actor(),nis_security.write_activity(text,text,text,text,text,text,jsonb) from public,anon,authenticated;

-- Called by the admin every minute while a page is open, and on sign-in.
-- p_active = the person used the keyboard, mouse or screen since the last call.
create or replace function public.admin_session_heartbeat(p_active boolean default true)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
  v_status text; v_new boolean:=false; v_cfg public.admin_security_settings%rowtype; v_agent text;
begin
  if v_uid is null or not exists(select 1 from public.profiles where id=v_uid and role::text in('admin','staff')) then return jsonb_build_object('status','not_staff'); end if;
  select * into v_cfg from public.admin_security_settings where id=1;
  v_status:=nis_security.admin_session_status();
  if v_status='ok' and v_sid is not null and not exists(select 1 from nis_security.admin_sessions where session_id=v_sid) then
    begin v_agent:=left(current_setting('request.headers',true)::jsonb->>'user-agent',300); exception when others then v_agent:=null; end;
    insert into nis_security.admin_sessions(session_id,user_id,user_agent) values(v_sid,v_uid,v_agent) on conflict(session_id) do nothing;
    v_new:=true;
    perform nis_security.write_activity('login',null,null,null,null,'Signed in',jsonb_build_object('user_agent',v_agent));
    -- With one session per person, every older admin session of this person ends now.
    if coalesce(v_cfg.single_session,true) then
      update nis_security.admin_sessions set ended_at=now(),end_reason='replaced' where user_id=v_uid and session_id<>v_sid and ended_at is null;
    end if;
  end if;
  if v_status='ok' then
    update nis_security.admin_sessions set last_seen_at=now(),last_active_at=case when p_active or v_new then now() else last_active_at end where session_id=v_sid;
  elsif v_sid is not null then
    update nis_security.admin_sessions set ended_at=now(),end_reason=v_status where session_id=v_sid and ended_at is null;
    if found then
      perform nis_security.write_activity(case v_status when 'idle' then 'auto_logout' when 'replaced' then 'session_replaced' when 'expired' then 'session_expired' when 'revoked' then 'session_revoked' else 'logout' end,
        null,null,null,null,case v_status when 'idle' then 'Signed out after inactivity' when 'replaced' then 'Signed out: signed in on another device' when 'expired' then 'Signed out: maximum session length reached' when 'revoked' then 'Signed out by the owner' else 'Session ended' end,'{}'::jsonb);
    end if;
  end if;
  return jsonb_build_object('status',v_status,'idle_timeout_minutes',coalesce(v_cfg.idle_timeout_minutes,30),'max_session_hours',coalesce(v_cfg.max_session_hours,12),'single_session',coalesce(v_cfg.single_session,true),'track_page_views',coalesce(v_cfg.track_page_views,true));
end;
$$;

-- Sign-out from the admin (button or inactivity timer), recorded before the session is revoked.
create or replace function public.end_admin_session(p_reason text default 'logout')
returns void language plpgsql security definer set search_path=''
as $$
declare v_sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
  if auth.uid() is null or v_sid is null then return; end if;
  update nis_security.admin_sessions set ended_at=now(),end_reason=case when p_reason='idle' then 'idle' else 'logout' end where session_id=v_sid and ended_at is null;
  if found then perform nis_security.write_activity(case when p_reason='idle' then 'auto_logout' else 'logout' end,null,null,null,null,case when p_reason='idle' then 'Signed out after inactivity' else 'Signed out' end,'{}'::jsonb); end if;
end;
$$;

-- Page views and actions the browser reports (export, import, assign …).
create or replace function public.log_admin_activity(p_event text,p_module text default null,p_path text default null,p_description text default null,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_staff_or_admin() then return; end if;
  if p_event not in('page_view','export','import','assign') then raise exception 'Unsupported activity'; end if;
  if p_event='page_view' and not coalesce((select track_page_views from public.admin_security_settings where id=1),true) then return; end if;
  perform nis_security.write_activity(p_event,p_module,p_path,null,null,p_description,p_metadata);
end;
$$;

-- Owner: sign a person out of every device now.
create or replace function public.admin_force_logout(p_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_user_id=auth.uid() then raise exception 'Use Sign out for your own account'; end if;
  insert into nis_security.session_cutoffs(user_id,revoked_before,revoked_by) values(p_user_id,now(),auth.uid())
    on conflict(user_id) do update set revoked_before=excluded.revoked_before,revoked_by=excluded.revoked_by;
  update nis_security.admin_sessions set ended_at=now(),end_reason='revoked' where user_id=p_user_id and ended_at is null;
  perform nis_security.write_activity('force_logout','security',null,'profiles',p_user_id::text,'Signed this person out of every device','{}'::jsonb);
end;
$$;

-- Sessions for the Access page: who is online, since when, last activity.
create or replace function public.admin_list_sessions(p_days integer default 7)
returns table(session_id uuid,user_id uuid,user_email text,started_at timestamptz,last_seen_at timestamptz,last_active_at timestamptz,ended_at timestamptz,end_reason text,user_agent text)
language sql stable security definer set search_path=''
as $$
  select s.session_id,s.user_id,u.email::text,s.started_at,s.last_seen_at,s.last_active_at,s.ended_at,s.end_reason,s.user_agent
  from nis_security.admin_sessions s left join auth.users u on u.id=s.user_id
  where public.has_admin_permission('security','view') and s.started_at>now()-make_interval(days=>greatest(1,least(coalesce(p_days,7),90)))
  order by s.last_seen_at desc limit 500;
$$;

drop function if exists public.save_admin_security_settings(integer,integer,boolean,boolean);
create or replace function public.save_admin_security_settings(p_idle_minutes integer,p_max_hours integer,p_single_session boolean,p_track_pages boolean,p_automation_user uuid default null)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_automation_user is not null and not exists(select 1 from public.profiles where id=p_automation_user and role::text='staff') then
    raise exception 'The automation account must be a staff account, not the owner';
  end if;
  update public.admin_security_settings set idle_timeout_minutes=p_idle_minutes,max_session_hours=p_max_hours,single_session=p_single_session,track_page_views=p_track_pages,automation_user_id=p_automation_user,updated_by=auth.uid(),updated_at=now() where id=1;
  perform nis_security.write_activity('settings_change','security',null,'admin_security_settings','1',
    format('Session security: sign out after %s min idle, max %s h, %s, page tracking %s',p_idle_minutes,p_max_hours,case when p_single_session then 'one session per person' else 'several sessions allowed' end,case when p_track_pages then 'on' else 'off' end),'{}'::jsonb);
end;
$$;

-- Campaign record changes (households, camps, venues, vendors, targets) into the activity log.
create or replace function nis_security.log_row_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_old jsonb; v_new jsonb; v_changed text[]; v_label text; v_id text;
begin
  if auth.uid() is null then return coalesce(new,old); end if;
  v_old:=case when tg_op in('UPDATE','DELETE') then to_jsonb(old) end;
  v_new:=case when tg_op in('INSERT','UPDATE') then to_jsonb(new) end;
  v_id:=coalesce(v_new->>'id',v_old->>'id');
  v_label:=coalesce(v_new->>'full_name',v_new->>'name',v_new->>'camp_code',v_new->>'label',v_old->>'full_name',v_old->>'name',v_old->>'camp_code',v_old->>'label',v_id);
  if tg_op='UPDATE' then
    select array_agg(k order by k) into v_changed from jsonb_object_keys(v_new) k where k not in('updated_at') and v_new->k is distinct from v_old->k;
    if v_changed is null then return new; end if;
  end if;
  perform nis_security.write_activity(case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end,tg_argv[0],null,tg_table_name,v_id,
    case tg_op when 'INSERT' then 'Added ' when 'DELETE' then 'Deleted ' else 'Changed ' end||replace(tg_table_name,'campaign_','')||' '||coalesce(v_label,'')||case when v_changed is not null then ' ('||array_to_string(v_changed[1:8],', ')||')' else '' end,
    case when tg_op='UPDATE' then jsonb_build_object('changed',to_jsonb(v_changed)) else '{}'::jsonb end);
  return coalesce(new,old);
end;
$$;
revoke all on function nis_security.log_row_change() from public,anon,authenticated;

do $$
declare t text;
begin
  foreach t in array array['campaign_leads','campaign_camps','campaign_venues','campaign_vendors','campaign_targets'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists %I on public.%I',t||'_activity',t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function nis_security.log_row_change(%L)',t||'_activity',t,'campaigns');
    end if;
  end loop;
end $$;

alter table public.admin_security_settings enable row level security;
alter table public.admin_activity enable row level security;
revoke all on public.admin_security_settings,public.admin_activity from anon,public;
grant select on public.admin_security_settings to authenticated;
grant select on public.admin_activity to authenticated;
drop policy if exists admin_security_settings_read on public.admin_security_settings;
create policy admin_security_settings_read on public.admin_security_settings for select to authenticated using(public.is_staff_or_admin());
drop policy if exists admin_activity_read on public.admin_activity;
create policy admin_activity_read on public.admin_activity for select to authenticated using(public.has_admin_permission('security','view'));

revoke all on function public.admin_session_heartbeat(boolean),public.end_admin_session(text),public.log_admin_activity(text,text,text,text,jsonb),public.admin_force_logout(uuid),public.admin_list_sessions(integer),public.save_admin_security_settings(integer,integer,boolean,boolean,uuid) from public,anon;
grant execute on function public.admin_session_heartbeat(boolean),public.end_admin_session(text),public.log_admin_activity(text,text,text,text,jsonb),public.admin_force_logout(uuid),public.admin_list_sessions(integer),public.save_admin_security_settings(integer,integer,boolean,boolean,uuid) to authenticated;

-- The admin reads why a session stopped working and the timeout to apply.
create or replace function public.get_my_admin_access()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare p public.profiles%rowtype; perms jsonb; v_cfg public.admin_security_settings%rowtype;
begin
  select * into p from public.profiles where id=auth.uid();
  if not found or p.role::text not in ('admin','staff') or p.staff_status<>'active' then return null; end if;
  select * into v_cfg from public.admin_security_settings where id=1;
  select coalesce(jsonb_object_agg(m.module_key,jsonb_build_object(
    'view',public.has_admin_permission(m.module_key,'view'),'create',public.has_admin_permission(m.module_key,'create'),
    'edit',public.has_admin_permission(m.module_key,'edit'),'delete',public.has_admin_permission(m.module_key,'delete'),
    'approve',public.has_admin_permission(m.module_key,'approve'),'export',public.has_admin_permission(m.module_key,'export')
  )),'{}'::jsonb) into perms from public.admin_modules m;
  return jsonb_build_object('user_id',p.id,'role',p.role::text,
    'admin_role',coalesce(p.admin_role,case when p.role::text='admin' then 'admin' else 'general' end),
    'staff_status',p.staff_status,'job_title',p.job_title,'permissions',perms,
    'must_change_password',p.must_change_password,'mfa_required',p.mfa_required,
    'aal',coalesce(auth.jwt()->>'aal','aal1'),'session_ready',nis_security.admin_session_ready(),
    'session_status',nis_security.admin_session_status(),
    'idle_timeout_minutes',coalesce(v_cfg.idle_timeout_minutes,30),'max_session_hours',coalesce(v_cfg.max_session_hours,12),
    'single_session',coalesce(v_cfg.single_session,true),'track_page_views',coalesce(v_cfg.track_page_views,true));
end;
$$;
notify pgrst,'reload schema';

-- Account-security state used by first-login and MFA enforcement.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_changed_at timestamptz,
  add column if not exists mfa_required boolean not null default false,
  add column if not exists access_reviewed_at timestamptz,
  add column if not exists access_reviewed_by uuid references public.profiles(id) on delete set null;

-- Department roles are data, not a hard-coded list. This enables safe custom roles.
alter table public.profiles drop constraint if exists profiles_admin_role_check;
alter table public.profiles drop constraint if exists profiles_admin_role_fkey;
alter table public.profiles
  add constraint profiles_admin_role_fkey foreign key (admin_role)
  references public.admin_role_definitions(role_key) on update cascade on delete restrict;

-- Individual grants can be temporary and self-expire in the authorization function.
alter table public.admin_user_permissions
  add column if not exists expires_at timestamptz,
  add column if not exists reason text;

create index if not exists admin_user_permissions_active_idx
  on public.admin_user_permissions(user_id,module_key,action_key,expires_at);

create or replace function public.has_admin_permission(p_module text,p_action text default 'view')
returns boolean
language plpgsql stable security definer set search_path=''
as $$
declare v_role text; v_admin_role text; v_status text; v_override boolean; v_result boolean:=false;
begin
  select role::text,admin_role,staff_status into v_role,v_admin_role,v_status
  from public.profiles where id=auth.uid();
  if v_status is distinct from 'active' then return false; end if;
  if v_role='admin' then return true; end if;
  if v_role is distinct from 'staff' then return false; end if;
  select allowed into v_override from public.admin_user_permissions
  where user_id=auth.uid() and module_key=p_module and action_key=p_action
    and (expires_at is null or expires_at>now());
  if found then return v_override; end if;
  select case p_action when 'view' then can_view when 'create' then can_create
    when 'edit' then can_edit when 'delete' then can_delete when 'approve' then can_approve
    when 'export' then can_export else false end into v_result
  from public.admin_role_permissions where role_key=coalesce(v_admin_role,'general') and module_key=p_module;
  return coalesce(v_result,false);
end;
$$;

create or replace function public.get_my_admin_access()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare p public.profiles%rowtype; perms jsonb; current_aal text;
begin
  select * into p from public.profiles where id=auth.uid();
  if not found or p.role::text not in ('admin','staff') or p.staff_status<>'active' then return null; end if;
  current_aal:=coalesce(auth.jwt()->>'aal','aal1');
  select coalesce(jsonb_object_agg(m.module_key,jsonb_build_object(
    'view',public.has_admin_permission(m.module_key,'view'),'create',public.has_admin_permission(m.module_key,'create'),
    'edit',public.has_admin_permission(m.module_key,'edit'),'delete',public.has_admin_permission(m.module_key,'delete'),
    'approve',public.has_admin_permission(m.module_key,'approve'),'export',public.has_admin_permission(m.module_key,'export')
  )),'{}'::jsonb) into perms from public.admin_modules m;
  return jsonb_build_object('user_id',p.id,'role',p.role::text,
    'admin_role',coalesce(p.admin_role,case when p.role::text='admin' then 'admin' else 'general' end),
    'staff_status',p.staff_status,'job_title',p.job_title,'permissions',perms,
    'must_change_password',p.must_change_password,'mfa_required',p.mfa_required,'aal',current_aal);
end;
$$;

create or replace function public.complete_initial_password_change()
returns void language plpgsql security definer set search_path=''
as $$
begin
  update public.profiles set must_change_password=false,password_changed_at=now(),updated_at=now()
  where id=auth.uid() and role::text in ('admin','staff');
  if not found then raise exception 'Internal account not found'; end if;
end;
$$;

create or replace function public.admin_promote_by_email(p_email text,p_admin_role text,p_job_title text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_admin_role='admin' or not exists(select 1 from public.admin_role_definitions where role_key=p_admin_role)
    then raise exception 'Invalid staff role'; end if;
  select id into v_id from public.profiles where lower(email)=lower(trim(p_email)) limit 1;
  if v_id is null then raise exception 'Account not found. Ask the team member to register first.'; end if;
  if exists(select 1 from public.profiles where id=v_id and role::text='admin') then raise exception 'Administrator account cannot be changed here'; end if;
  update public.profiles set role='staff',admin_role=p_admin_role,staff_status='active',job_title=nullif(trim(p_job_title),''),must_change_password=true where id=v_id;
  return v_id;
end;
$$;

create or replace function public.admin_set_staff_access(p_user_id uuid,p_admin_role text,p_staff_status text,p_job_title text default null)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_admin_role='admin' or not exists(select 1 from public.admin_role_definitions where role_key=p_admin_role)
    then raise exception 'Invalid staff role'; end if;
  if p_staff_status not in ('active','suspended','inactive') then raise exception 'Invalid staff status'; end if;
  update public.profiles set admin_role=p_admin_role,staff_status=p_staff_status,job_title=nullif(trim(p_job_title),'')
  where id=p_user_id and role::text='staff';
  if not found then raise exception 'Staff member not found'; end if;
end;
$$;

create or replace function public.admin_user_security_summary()
returns table(user_id uuid,session_count bigint,last_session_at timestamptz,mfa_enrolled boolean)
language sql stable security definer set search_path=''
as $$
  select p.id,count(distinct s.id),max(s.updated_at),bool_or(f.status::text='verified')
  from public.profiles p left join auth.sessions s on s.user_id=p.id
  left join auth.mfa_factors f on f.user_id=p.id
  where public.is_admin()
  group by p.id;
$$;

-- Only authenticated users can call account-security RPCs; each function still
-- performs its own administrator/self authorization check.
revoke execute on function public.complete_initial_password_change() from public,anon;
grant execute on function public.complete_initial_password_change() to authenticated;
revoke execute on function public.admin_user_security_summary() from public,anon;
grant execute on function public.admin_user_security_summary() to authenticated;
revoke execute on function public.admin_promote_by_email(text,text,text) from public,anon;
revoke execute on function public.admin_set_staff_access(uuid,text,text,text) from public,anon;
revoke execute on function public.admin_list_team() from public,anon;
revoke execute on function public.admin_remove_staff_access(uuid) from public,anon;
revoke execute on function public.record_admin_session() from public,anon;
revoke execute on function public.get_my_admin_access() from public,anon;
grant execute on function public.admin_promote_by_email(text,text,text),public.admin_set_staff_access(uuid,text,text,text),
  public.admin_list_team(),public.admin_remove_staff_access(uuid),public.record_admin_session(),public.get_my_admin_access() to authenticated;

-- Trigger-only functions are not callable API endpoints.
revoke execute on function public.sync_permissions_for_new_admin_module() from public,anon,authenticated;
revoke execute on function public.sync_permissions_for_new_admin_role() from public,anon,authenticated;

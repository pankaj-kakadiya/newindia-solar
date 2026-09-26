do $test$
declare u uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); count_rows integer;
begin
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  insert into auth.users(id,email,encrypted_password,created_at,updated_at) values(u,'mfa-regression-'||u||'@example.invalid','test-initial-hash',now(),now());
  insert into public.profiles(id,role,admin_role,staff_status,mfa_required,must_change_password) values(u,'staff','finance','active',true,true)
    on conflict(id) do update set role='staff',admin_role='finance',staff_status='active',mfa_required=true,must_change_password=true;
  insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(sid,u,now(),now(),'aal1');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',sid)::text,true);
  if nis_security.admin_session_ready() then raise exception 'First-login account incorrectly unlocked'; end if;
  begin
    perform public.complete_initial_password_change();
    raise exception 'FAIL: completion allowed before password update';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Change your password%' then raise; end if;
  end;
  begin
    update public.profiles set mfa_required=false where id=u;
    raise exception 'FAIL: self downgrade allowed';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like 'Only a verified administrator%' then raise; end if;
  end;
  update auth.users set encrypted_password='test-private-hash' where id=u;
  perform public.complete_initial_password_change();
  if (select must_change_password from public.profiles where id=u) then raise exception 'First-login flag not cleared'; end if;
  if nis_security.admin_session_ready() then raise exception 'Mandatory enrollment not enforced'; end if;
  insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,created_at,updated_at,secret)
    values(f,u,'Regression test','totp','verified',now(),now(),'synthetic-test-only');
  if public.has_admin_permission('finance','view') then raise exception 'Finance accessible without 2FA'; end if;
  execute 'set local role authenticated';
  select count(*) into count_rows from public.admin_modules;
  if count_rows<>0 then raise exception 'Business tables visible through RLS before MFA'; end if;
  select count(*) into count_rows from public.profiles where id=u;
  if count_rows<>1 then raise exception 'Own profile bootstrap blocked by RLS'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',sid)::text,true);
  update auth.sessions set aal='aal2' where id=sid;
  if not nis_security.admin_session_ready() then raise exception 'Verified account not unlocked'; end if;
  if not public.has_admin_permission('finance','view') then raise exception 'Finance role lost authorized access'; end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  update public.profiles set role='admin',admin_role='admin',mfa_required=false where id=u;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',sid)::text,true);
  if public.is_admin() then raise exception 'Optional enrolled owner bypasses MFA'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',sid)::text,true);
  if not public.is_admin() then raise exception 'Verified owner denied'; end if;
  delete from auth.sessions where id=sid;
  if public.is_admin() then raise exception 'Revoked session still authorized'; end if;
end;
$test$;

-- Restrict privileged RPC execution, validate encrypted envelopes, and expose a permission-checked roster.
revoke all on function public.support_is_team_member(uuid,uuid),public.support_can_access(uuid),public.support_public_recipients(uuid),public.support_create_conversation(uuid,text,text,text,text,text,text,jsonb),public.support_assign_conversation(uuid,uuid,text,text),public.support_mark_read(uuid) from public,anon;
grant execute on function public.support_public_recipients(uuid),public.support_create_conversation(uuid,text,text,text,text,text,text,jsonb),public.support_mark_read(uuid) to authenticated;
grant execute on function public.support_assign_conversation(uuid,uuid,text,text) to authenticated;

drop policy if exists support_keys_authorized_insert on public.support_conversation_keys;
create policy support_keys_authorized_insert on public.support_conversation_keys for insert to authenticated with check(created_by=(select auth.uid()) and public.support_can_access(conversation_id) and (recipient_id=(select auth.uid()) or exists(select 1 from public.support_conversations c where c.id=conversation_id and public.support_is_team_member(c.team_id,recipient_id))));

create or replace function public.support_admin_roster() returns table(team_id uuid,user_id uuid,display_name text,email text,team_role text,is_active boolean,crypto_ready boolean) language sql stable security definer set search_path='' as $$select m.team_id,p.id,coalesce(nullif(trim(p.full_name),''),split_part(coalesce(p.email,'Team member'),'@',1)),p.email,m.team_role,m.is_active,(i.user_id is not null) from public.support_team_members m join public.profiles p on p.id=m.user_id left join public.support_crypto_identities i on i.user_id=p.id where public.has_admin_permission('support','view') order by 3$$;
revoke all on function public.support_admin_roster() from public,anon;
grant execute on function public.support_admin_roster() to authenticated;

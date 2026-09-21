-- Simple authenticated account chat. Access remains restricted by the existing
-- buyer ownership and support-team RLS policies; no PIN or device key is needed.
create or replace function public.support_create_simple_conversation(
 p_team_id uuid,
 p_category text,
 p_priority text,
 p_subject text,
 p_initial_message text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid:=gen_random_uuid();
 v_subject text:=trim(coalesce(p_subject,''));
 v_message text:=trim(coalesce(p_initial_message,''));
begin
 if auth.uid() is null then
  raise exception 'Authentication required';
 end if;
 if not exists(select 1 from public.support_teams where id=p_team_id and is_active) then
  raise exception 'Support team is unavailable';
 end if;
 if p_category not in('general','product','order','payment','delivery','technical','warranty') then
  raise exception 'Invalid support category';
 end if;
 if p_priority not in('low','normal','high','urgent') then
  raise exception 'Invalid support priority';
 end if;
 if length(v_subject)<1 or length(v_subject)>160 then
  raise exception 'Subject must be between 1 and 160 characters';
 end if;
 if length(v_message)<1 or length(v_message)>12000 then
  raise exception 'Message must be between 1 and 12000 characters';
 end if;
 insert into public.support_conversations(
  id,buyer_id,team_id,category,priority,subject_ciphertext,subject_iv,last_sender_id
 ) values(
  v_id,auth.uid(),p_team_id,p_category,p_priority,v_subject,'account-chat-v1',auth.uid()
 );
 insert into public.support_messages(conversation_id,sender_id,ciphertext,iv)
 values(v_id,auth.uid(),v_message,'account-chat-v1');
 insert into public.support_conversation_reads(conversation_id,user_id)
 values(v_id,auth.uid());
 return v_id;
end
$$;

revoke all on function public.support_create_simple_conversation(uuid,text,text,text,text) from public,anon;
grant execute on function public.support_create_simple_conversation(uuid,text,text,text,text) to authenticated;

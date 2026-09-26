-- Browser-encrypted buyer-to-support messaging. The database stores ciphertext and wrapped keys only.
insert into public.admin_modules(module_key,label,description,route,sort_order)
values('support','Secure Support','End-to-end encrypted buyer support conversations','/admin/support',28)
on conflict(module_key) do update set label=excluded.label,description=excluded.description,route=excluded.route,sort_order=excluded.sort_order;

insert into public.admin_role_permissions(role_key,module_key,can_view,can_create,can_edit,can_delete,can_approve,can_export)
values('admin','support',true,true,true,true,true,true),('general','support',false,false,false,false,false,false),('sales','support',true,true,true,false,false,false)
on conflict(role_key,module_key) do update set can_view=excluded.can_view,can_create=excluded.can_create,can_edit=excluded.can_edit,can_delete=excluded.can_delete,can_approve=excluded.can_approve,can_export=excluded.can_export,updated_at=now();

create table public.support_teams(
 id uuid primary key default gen_random_uuid(),name text not null,description text,is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.support_team_members(
 team_id uuid not null references public.support_teams(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,team_role text not null default 'agent' check(team_role in('agent','supervisor')),is_active boolean not null default true,created_at timestamptz not null default now(),primary key(team_id,user_id)
);
create table public.support_crypto_identities(
 user_id uuid primary key references public.profiles(id) on delete cascade,algorithm text not null default 'RSA-OAEP-256',public_key_jwk jsonb not null,encrypted_private_key text not null,private_key_iv text not null,private_key_salt text not null,key_version integer not null default 1 check(key_version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.support_conversations(
 id uuid primary key default gen_random_uuid(),buyer_id uuid not null references public.profiles(id) on delete restrict,team_id uuid not null references public.support_teams(id) on delete restrict,assigned_to uuid references public.profiles(id) on delete set null,category text not null default 'general' check(category in('general','product','order','payment','delivery','technical','warranty')),priority text not null default 'normal' check(priority in('low','normal','high','urgent')),status text not null default 'open' check(status in('open','pending_buyer','pending_team','resolved','closed')),subject_ciphertext text not null,subject_iv text not null,last_message_at timestamptz not null default now(),last_sender_id uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),closed_at timestamptz
);
create table public.support_conversation_keys(
 conversation_id uuid not null references public.support_conversations(id) on delete cascade,recipient_id uuid not null references public.profiles(id) on delete cascade,wrapped_key text not null,identity_version integer not null,created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),created_at timestamptz not null default now(),primary key(conversation_id,recipient_id)
);
create table public.support_messages(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.support_conversations(id) on delete cascade,sender_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),message_type text not null default 'text' check(message_type in('text','system')),ciphertext text not null,iv text not null,created_at timestamptz not null default now(),edited_at timestamptz,deleted_at timestamptz
);
create table public.support_conversation_reads(
 conversation_id uuid not null references public.support_conversations(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,last_read_at timestamptz not null default now(),primary key(conversation_id,user_id)
);
create index support_conversations_buyer_recent on public.support_conversations(buyer_id,last_message_at desc);
create index support_conversations_team_recent on public.support_conversations(team_id,status,last_message_at desc);
create index support_messages_conversation_time on public.support_messages(conversation_id,created_at);

insert into public.support_teams(name,description) values('Customer Support','Buyer product, order and technical support');
insert into public.support_team_members(team_id,user_id,team_role)
select t.id,p.id,'supervisor' from public.support_teams t cross join public.profiles p where t.name='Customer Support' and p.role::text='admin' on conflict do nothing;

alter table public.support_teams enable row level security;
alter table public.support_team_members enable row level security;
alter table public.support_crypto_identities enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_conversation_keys enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_conversation_reads enable row level security;

create or replace function public.support_is_team_member(p_team_id uuid,p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.support_team_members m where m.team_id=p_team_id and m.user_id=p_user_id and m.is_active)$$;
create or replace function public.support_can_access(p_conversation_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.support_conversations c where c.id=p_conversation_id and (c.buyer_id=auth.uid() or (public.has_admin_permission('support','view') and (public.is_admin() or public.support_is_team_member(c.team_id,auth.uid())))))$$;

create policy support_teams_authenticated_select on public.support_teams for select to authenticated using(is_active or public.has_admin_permission('support','view'));
create policy support_members_staff_select on public.support_team_members for select to authenticated using(public.has_admin_permission('support','view'));
create policy support_members_staff_insert on public.support_team_members for insert to authenticated with check(public.has_admin_permission('support','edit'));
create policy support_members_staff_update on public.support_team_members for update to authenticated using(public.has_admin_permission('support','edit')) with check(public.has_admin_permission('support','edit'));
create policy support_identity_self_select on public.support_crypto_identities for select to authenticated using(user_id=(select auth.uid()));
create policy support_identity_self_insert on public.support_crypto_identities for insert to authenticated with check(user_id=(select auth.uid()));
create policy support_identity_self_update on public.support_crypto_identities for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy support_conversation_select on public.support_conversations for select to authenticated using(buyer_id=(select auth.uid()) or (public.has_admin_permission('support','view') and (public.is_admin() or public.support_is_team_member(team_id,(select auth.uid())))));
create policy support_conversation_buyer_insert on public.support_conversations for insert to authenticated with check(buyer_id=(select auth.uid()) and assigned_to is null and status='open');
create policy support_conversation_staff_update on public.support_conversations for update to authenticated using(public.support_can_access(id) and public.has_admin_permission('support','edit')) with check(public.support_can_access(id) and public.has_admin_permission('support','edit'));
create policy support_keys_recipient_select on public.support_conversation_keys for select to authenticated using(recipient_id=(select auth.uid()) and public.support_can_access(conversation_id));
create policy support_keys_authorized_insert on public.support_conversation_keys for insert to authenticated with check(created_by=(select auth.uid()) and public.support_can_access(conversation_id));
create policy support_messages_select on public.support_messages for select to authenticated using(public.support_can_access(conversation_id));
create policy support_messages_insert on public.support_messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.support_can_access(conversation_id));
create policy support_reads_select on public.support_conversation_reads for select to authenticated using(user_id=(select auth.uid()) and public.support_can_access(conversation_id));
create policy support_reads_insert on public.support_conversation_reads for insert to authenticated with check(user_id=(select auth.uid()) and public.support_can_access(conversation_id));
create policy support_reads_update on public.support_conversation_reads for update to authenticated using(user_id=(select auth.uid()) and public.support_can_access(conversation_id)) with check(user_id=(select auth.uid()) and public.support_can_access(conversation_id));

create or replace function public.support_public_recipients(p_team_id uuid) returns table(user_id uuid,display_name text,public_key_jwk jsonb,key_version integer) language sql stable security definer set search_path='' as $$select i.user_id,coalesce(nullif(trim(p.full_name),''),split_part(coalesce(p.email,'Support'),'@',1)),i.public_key_jwk,i.key_version from public.support_team_members m join public.profiles p on p.id=m.user_id join public.support_crypto_identities i on i.user_id=m.user_id where auth.uid() is not null and m.team_id=p_team_id and m.is_active and p.staff_status='active' and p.role::text in('admin','staff') order by 2$$;

create or replace function public.support_create_conversation(p_team_id uuid,p_category text,p_priority text,p_subject_ciphertext text,p_subject_iv text,p_initial_ciphertext text,p_initial_iv text,p_envelopes jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare v_id uuid:=gen_random_uuid();v_item jsonb;v_recipient uuid;begin if auth.uid() is null then raise exception 'Authentication required';end if;if not exists(select 1 from public.support_teams where id=p_team_id and is_active) then raise exception 'Support team is unavailable';end if;insert into public.support_conversations(id,buyer_id,team_id,category,priority,subject_ciphertext,subject_iv,last_sender_id) values(v_id,auth.uid(),p_team_id,p_category,p_priority,p_subject_ciphertext,p_subject_iv,auth.uid());for v_item in select value from jsonb_array_elements(coalesce(p_envelopes,'[]'::jsonb)) loop v_recipient:=(v_item->>'recipient_id')::uuid;if v_recipient<>auth.uid() and not public.support_is_team_member(p_team_id,v_recipient) then raise exception 'Invalid encryption recipient';end if;insert into public.support_conversation_keys(conversation_id,recipient_id,wrapped_key,identity_version,created_by) values(v_id,v_recipient,v_item->>'wrapped_key',(v_item->>'identity_version')::int,auth.uid());end loop;if not exists(select 1 from public.support_conversation_keys where conversation_id=v_id and recipient_id=auth.uid()) then raise exception 'Buyer encryption envelope is required';end if;if not exists(select 1 from public.support_conversation_keys k join public.support_team_members m on m.user_id=k.recipient_id and m.team_id=p_team_id and m.is_active where k.conversation_id=v_id) then raise exception 'No encrypted support recipient is available';end if;insert into public.support_messages(conversation_id,sender_id,ciphertext,iv) values(v_id,auth.uid(),p_initial_ciphertext,p_initial_iv);insert into public.support_conversation_reads(conversation_id,user_id) values(v_id,auth.uid());return v_id;end$$;

create or replace function public.support_assign_conversation(p_conversation_id uuid,p_assigned_to uuid,p_status text,p_priority text) returns void language plpgsql security definer set search_path='' as $$declare v_team uuid;begin if not public.has_admin_permission('support','edit') or not public.support_can_access(p_conversation_id) then raise exception 'Support edit permission required';end if;select team_id into v_team from public.support_conversations where id=p_conversation_id;if p_assigned_to is not null and not public.support_is_team_member(v_team,p_assigned_to) then raise exception 'Assignee is not an active team member';end if;update public.support_conversations set assigned_to=p_assigned_to,status=p_status,priority=p_priority,closed_at=case when p_status='closed' then now() else null end,updated_at=now() where id=p_conversation_id;end$$;
create or replace function public.support_mark_read(p_conversation_id uuid) returns void language plpgsql security definer set search_path='' as $$begin if not public.support_can_access(p_conversation_id) then raise exception 'Conversation access denied';end if;insert into public.support_conversation_reads(conversation_id,user_id,last_read_at) values(p_conversation_id,auth.uid(),now()) on conflict(conversation_id,user_id) do update set last_read_at=excluded.last_read_at;end$$;
create or replace function public.support_touch_conversation() returns trigger language plpgsql security definer set search_path='' as $$begin update public.support_conversations set last_message_at=new.created_at,last_sender_id=new.sender_id,updated_at=now() where id=new.conversation_id;return new;end$$;
create trigger support_message_touch after insert on public.support_messages for each row execute function public.support_touch_conversation();

revoke all on public.support_teams,public.support_team_members,public.support_crypto_identities,public.support_conversations,public.support_conversation_keys,public.support_messages,public.support_conversation_reads from public,anon;
grant select on public.support_teams to authenticated;
grant select,insert,update on public.support_team_members,public.support_crypto_identities,public.support_conversations,public.support_conversation_keys,public.support_messages,public.support_conversation_reads to authenticated;
alter publication supabase_realtime add table public.support_conversations,public.support_messages;

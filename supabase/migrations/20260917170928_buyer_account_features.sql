-- Keep invoice reads/writes private: buyer downloads use ownership-checked APIs.
do $$
declare t text;
begin
 foreach t in array array['invoices','invoice_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy buyer_release_invoice_read on public.%I as restrictive for select to anon, authenticated using (public.is_staff_or_admin() and public.has_admin_permission(''finance'',''view''))',t);
  execute format('create policy buyer_release_invoice_insert on public.%I as restrictive for insert to anon, authenticated with check (public.is_staff_or_admin() and public.has_admin_permission(''finance'',''create''))',t);
  execute format('create policy buyer_release_invoice_update on public.%I as restrictive for update to anon, authenticated using (public.is_staff_or_admin() and public.has_admin_permission(''finance'',''edit'')) with check (public.is_staff_or_admin() and public.has_admin_permission(''finance'',''edit''))',t);
  execute format('create policy buyer_release_invoice_delete on public.%I as restrictive for delete to anon, authenticated using (public.is_staff_or_admin() and public.has_admin_permission(''finance'',''delete''))',t);
 end loop;
end $$;

-- Runs inside order creation, so a successful order always retains its address.
-- Serialize per buyer to avoid duplicates from simultaneous orders.
create or replace function nis_private.save_used_shipping_address()
returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=new.shipping_address; address_id uuid;
begin
 if new.user_id is null or nullif(trim(a->>'address_line1'),'') is null then return new; end if;
 perform 1 from public.profiles where id=new.user_id for update;
 select id into address_id from public.addresses
 where user_id=new.user_id
 and lower(trim(address_line1))=lower(trim(a->>'address_line1'))
 and lower(trim(coalesce(address_line2,'')))=lower(trim(coalesce(a->>'address_line2','')))
 and lower(trim(city))=lower(trim(coalesce(a->>'city','')))
 and lower(trim(state))=lower(trim(coalesce(a->>'state','')))
 and postal_code=coalesce(a->>'postal_code','')
 and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(coalesce(a->>'phone',''),'[^0-9]','','g')
 and lower(trim(contact_name))=lower(trim(coalesce(a->>'full_name',a->>'contact_name','')))
 limit 1;
 if address_id is null then
  insert into public.addresses(user_id,label,contact_name,phone,address_line1,address_line2,city,state,postal_code,country,is_default_shipping)
  values(new.user_id,'Saved from order',left(coalesce(a->>'full_name',a->>'contact_name',''),120),left(coalesce(a->>'phone',''),30),left(a->>'address_line1',300),left(coalesce(a->>'address_line2',''),300),left(coalesce(a->>'city',''),100),left(coalesce(a->>'state',''),100),left(coalesce(a->>'postal_code',''),12),'India',not exists(select 1 from public.addresses where user_id=new.user_id));
 end if;
 return new;
end $$;
revoke all on function nis_private.save_used_shipping_address() from public,anon,authenticated;
create trigger buyer_save_used_shipping_address after insert on public.orders for each row execute function nis_private.save_used_shipping_address();

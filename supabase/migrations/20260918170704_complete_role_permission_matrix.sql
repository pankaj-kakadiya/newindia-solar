-- Keep every role/module combination addressable by the permission editor.
-- Specialist roles default to no access; the protected administrator role keeps
-- full access. Existing permissions are never overwritten by this backfill.
insert into public.admin_role_permissions (
  role_key,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_delete,
  can_approve,
  can_export
)
select
  role.role_key,
  module.module_key,
  role.role_key = 'admin',
  role.role_key = 'admin',
  role.role_key = 'admin',
  role.role_key = 'admin',
  role.role_key = 'admin',
  role.role_key = 'admin'
from public.admin_role_definitions role
cross join public.admin_modules module
on conflict (role_key, module_key) do nothing;

create or replace function public.sync_permissions_for_new_admin_module()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.admin_role_permissions (
    role_key, module_key, can_view, can_create, can_edit,
    can_delete, can_approve, can_export
  )
  select
    role.role_key, new.module_key,
    role.role_key = 'admin', role.role_key = 'admin', role.role_key = 'admin',
    role.role_key = 'admin', role.role_key = 'admin', role.role_key = 'admin'
  from public.admin_role_definitions role
  on conflict (role_key, module_key) do nothing;
  return new;
end;
$$;

create or replace function public.sync_permissions_for_new_admin_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.admin_role_permissions (
    role_key, module_key, can_view, can_create, can_edit,
    can_delete, can_approve, can_export
  )
  select
    new.role_key, module.module_key,
    new.role_key = 'admin', new.role_key = 'admin', new.role_key = 'admin',
    new.role_key = 'admin', new.role_key = 'admin', new.role_key = 'admin'
  from public.admin_modules module
  on conflict (role_key, module_key) do nothing;
  return new;
end;
$$;

drop trigger if exists sync_permissions_after_admin_module_insert on public.admin_modules;
create trigger sync_permissions_after_admin_module_insert
after insert on public.admin_modules
for each row execute function public.sync_permissions_for_new_admin_module();

drop trigger if exists sync_permissions_after_admin_role_insert on public.admin_role_definitions;
create trigger sync_permissions_after_admin_role_insert
after insert on public.admin_role_definitions
for each row execute function public.sync_permissions_for_new_admin_role();

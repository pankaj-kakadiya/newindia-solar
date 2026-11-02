-- PM Surya Ghar village campaign team roles. Both start from "no access" everywhere and get only
-- what the campaign needs; the owner can refine them in Access → Role Matrix or per person.
insert into public.admin_role_definitions(role_key,name,description,sort_order,is_system) values
 ('campaign_manager','Surya Ghar Campaign Manager','Runs the PM Surya Ghar village campaign: households, camps, venues, vendors, targets, market data and exports. Can delete campaign records.',200,false),
 ('field_executive','Surya Ghar Field Executive','Works village camps: adds and updates households, camps and venues, ticks the 9 installation steps and assigns vendors. Cannot delete or export.',210,false)
on conflict(role_key) do update set name=excluded.name,description=excluded.description;

insert into public.admin_role_permissions(role_key,module_key,can_view,can_create,can_edit,can_delete,can_approve,can_export)
select r.role_key,m.module_key,false,false,false,false,false,false
from (values('campaign_manager'),('field_executive')) r(role_key) cross join public.admin_modules m
on conflict(role_key,module_key) do nothing;

update public.admin_role_permissions set can_view=true,can_create=true,can_edit=true,can_delete=true,can_approve=true,can_export=true
 where role_key='campaign_manager' and module_key='campaigns';
update public.admin_role_permissions set can_view=true,can_create=true,can_edit=true,can_delete=false,can_approve=false,can_export=false
 where role_key='field_executive' and module_key='campaigns';
update public.admin_role_permissions set can_view=true
 where role_key in('campaign_manager','field_executive') and module_key in('dashboard','search','notifications');
update public.admin_role_permissions set can_view=true,can_export=true
 where role_key='campaign_manager' and module_key='reports';

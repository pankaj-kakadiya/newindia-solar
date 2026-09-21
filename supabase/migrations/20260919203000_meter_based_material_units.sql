-- Keep recipe and production units aligned with each material's stock unit.
-- Solar cable is purchased, costed, reserved and consumed by metre.
update public.components
set unit='mtr',updated_at=now()
where lower(trim(coalesce(category,'')))='solar cable'
  and unit is distinct from 'mtr';

create or replace function public.sync_manufacturing_recipe_item_unit()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if new.component_id is not null then
    select coalesce(nullif(trim(c.unit),''),'pcs')
    into new.unit
    from public.components c
    where c.id=new.component_id;
  elsif new.variant_id is not null then
    select coalesce(nullif(trim(v.unit),''),'pcs')
    into new.unit
    from public.product_variants v
    where v.id=new.variant_id;
  else
    new.unit:='pcs';
  end if;
  new.unit:=coalesce(nullif(trim(new.unit),''),'pcs');
  return new;
end;
$$;

revoke all on function public.sync_manufacturing_recipe_item_unit() from public,anon,authenticated;

drop trigger if exists sync_manufacturing_recipe_item_unit on public.manufacturing_recipe_items;
create trigger sync_manufacturing_recipe_item_unit
before insert or update of component_id,enclosure_id,variant_id,unit
on public.manufacturing_recipe_items
for each row execute function public.sync_manufacturing_recipe_item_unit();

update public.manufacturing_recipe_items i
set unit=coalesce(nullif(trim(c.unit),''),'pcs')
from public.components c
where i.component_id=c.id
  and i.unit is distinct from coalesce(nullif(trim(c.unit),''),'pcs');

update public.manufacturing_recipe_items i
set unit=coalesce(nullif(trim(v.unit),''),'pcs')
from public.product_variants v
where i.variant_id=v.id
  and i.unit is distinct from coalesce(nullif(trim(v.unit),''),'pcs');

update public.manufacturing_recipe_items
set unit='pcs'
where enclosure_id is not null and unit is distinct from 'pcs';

update public.production_bom_items b
set unit=coalesce(nullif(trim(c.unit),''),'pcs')
from public.components c
where b.component_id=c.id
  and b.unit is distinct from coalesce(nullif(trim(c.unit),''),'pcs');

notify pgrst,'reload schema';
-- Deployment trigger after verified metre-unit migration.

-- Keep transaction and production history when admins delete unused catalogue records.
-- Foreign keys enforce this even when the caller cannot view the referencing rows.
begin;
alter table public.order_items drop constraint order_items_variant_id_fkey,
 add constraint order_items_variant_id_fkey foreign key (variant_id) references public.product_variants(id) on delete restrict;
alter table public.inventory_movements drop constraint inventory_movements_variant_id_fkey,
 add constraint inventory_movements_variant_id_fkey foreign key (variant_id) references public.product_variants(id) on delete restrict;
alter table public.inventory_reservations drop constraint inventory_reservations_variant_id_fkey,
 add constraint inventory_reservations_variant_id_fkey foreign key (variant_id) references public.product_variants(id) on delete restrict;
alter table public.production_jobs drop constraint production_jobs_manufacturing_recipe_id_fkey,
 add constraint production_jobs_manufacturing_recipe_id_fkey foreign key (manufacturing_recipe_id) references public.manufacturing_recipes(id) on delete restrict;

create or replace function public.prevent_stocked_variant_deletion()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(old.stock_qty,0) <> 0 then
  raise exception 'Cannot delete a product with stock. Set it to Inactive instead.' using errcode='23514';
 end if;
 return old;
end;
$$;
revoke all on function public.prevent_stocked_variant_deletion() from public,anon,authenticated;
create trigger protect_stocked_variant_deletion before delete on public.product_variants
 for each row execute function public.prevent_stocked_variant_deletion();
commit;

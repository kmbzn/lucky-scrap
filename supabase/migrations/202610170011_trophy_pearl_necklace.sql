-- Replace the trophy emerald necklace with a more accessible pearl necklace.
begin;
delete from public.recipe_inputs where result_id = 63 and item_id = 60;
insert into public.recipe_inputs(result_id,item_id,quantity) values (63,56,1)
on conflict (result_id,item_id) do update set quantity = excluded.quantity;
commit;

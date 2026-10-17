-- Paper box costs four paper; cap coal requirements at one per craft.
begin;
insert into public.recipe_inputs(result_id,item_id,quantity)
values (28,27,4)
on conflict (result_id,item_id) do update set quantity=excluded.quantity;
update public.recipe_inputs set quantity=1 where item_id=13 and quantity>=2;
commit;

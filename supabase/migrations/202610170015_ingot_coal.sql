-- One coal per iron, copper, silver or gold ingot.
insert into public.recipe_inputs(result_id,item_id,quantity)
values (34,13,1),(35,13,1),(37,13,1),(38,13,1)
on conflict (result_id,item_id) do update set quantity=excluded.quantity;

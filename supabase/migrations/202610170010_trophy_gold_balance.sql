-- Set trophy gold ingots to 3: recursive natural gold cost is 30.
update public.recipe_inputs set quantity = 3 where result_id = 63 and item_id = 38;

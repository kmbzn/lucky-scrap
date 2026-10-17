-- Raise only the trophy gold ingot cost from 2 to 5.
update public.recipe_inputs set quantity = 5 where result_id = 63 and item_id = 38;

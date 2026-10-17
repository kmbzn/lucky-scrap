-- Lower crafting costs and replace removed ingredients atomically.
begin;
delete from public.recipe_inputs where result_id in (27,37,38,56,59,60,62,63);
insert into public.recipe_inputs(result_id,item_id,quantity) values (27,3,2),(27,2,2),(37,16,2),(38,17,2),(56,18,1),(56,38,2),(59,21,2),(59,38,1),(60,22,1),(60,38,2),(62,38,12),(62,57,1),(62,58,1),(62,59,1),(62,25,15),(62,37,4),(62,34,4),(63,62,1),(63,38,4),(63,61,1),(63,60,1),(63,30,10),(63,32,6);
commit;

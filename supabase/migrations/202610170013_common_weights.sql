-- Keep total draw weight at 1000.
update public.items as item set weight = configured.weight
from (values (1,80),(2,90),(3,90),(4,104)) as configured(id,weight)
where item.id = configured.id;

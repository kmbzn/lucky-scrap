-- Rankings are disabled. Inventory, trophies and discoveries are preserved.
drop trigger if exists trophy_inventory_changed on public.inventories;
drop function if exists public.notify_trophy_update();
drop view if exists public.rankings;
drop table if exists public.trophy_updates;

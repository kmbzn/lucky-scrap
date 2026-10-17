-- Fresh Supabase project only. Run once in SQL Editor.
create extension if not exists pgcrypto with schema extensions;
create table public.profiles(id uuid primary key references auth.users on delete cascade,nickname text unique check(nickname ~ '^[가-힣a-zA-Z0-9_]{2,12}$'),created_at timestamptz not null default now(),last_seen_at timestamptz not null default now());
create table public.items(id smallint primary key check(id between 0 and 63),name text not null,kind text not null check(kind in ('natural','crafted','secret')),weight int not null default 0);
create table public.inventories(user_id uuid references public.profiles on delete cascade,item_id smallint references public.items,quantity bigint not null check(quantity>=0),primary key(user_id,item_id));
create table public.item_discoveries(user_id uuid references public.profiles on delete cascade,item_id smallint references public.items,discovered_at timestamptz not null default now(),primary key(user_id,item_id));
create table public.recipes(result_id smallint primary key references public.items);
create table public.recipe_inputs(result_id smallint references public.recipes,item_id smallint references public.items,quantity bigint not null check(quantity>0),primary key(result_id,item_id));
create table public.draw_challenges(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,letter text not null,expires_at timestamptz not null default now()+interval '5 minutes',status text not null default 'pending' check(status in ('pending','verifying','failed','used')),image_hash text,verifying_at timestamptz,created_at timestamptz not null default now(),unique(image_hash));
create table public.draw_events(id uuid primary key default gen_random_uuid(),challenge_id uuid not null unique references public.draw_challenges,user_id uuid not null references public.profiles,item_id smallint not null references public.items check(item_id between 1 and 23),created_at timestamptz not null default now());
create table public.trade_offers(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles,acceptor_id uuid references public.profiles,status text not null default 'open' check(status in ('open','completed','cancelled')),created_at timestamptz not null default now(),closed_at timestamptz);
create table public.trade_offer_lines(offer_id uuid references public.trade_offers,item_id smallint references public.items,side text check(side in ('give','want')),quantity bigint not null check(quantity>0),primary key(offer_id,side,item_id));
create table public.inventory_ledger(id bigint generated always as identity primary key,user_id uuid not null references public.profiles,item_id smallint not null references public.items,delta bigint not null,reason text not null,event_id uuid not null,created_at timestamptz not null default now());
create table public.game_requests(user_id uuid references public.profiles,request_id uuid,action text not null,payload jsonb not null,result jsonb not null,primary key(user_id,request_id));
create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
-- All inventory deltas are audited. Only private functions can call this helper.
create function public.inventory_delta(u uuid,i smallint,d bigint,r text,e uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into inventories(user_id,item_id,quantity) values(u,i,0) on conflict do nothing;
 update inventories set quantity=quantity+d where user_id=u and item_id=i and quantity+d>=0;
 if not found then raise exception '재료가 부족합니다'; end if;
 insert into inventory_ledger(user_id,item_id,delta,reason,event_id) values(u,i,d,r,e);
 if d>0 then insert into item_discoveries(user_id,item_id) values(u,i) on conflict do nothing; end if;
end $$;
-- Trusted server only. One transaction serializes mutations to make escrow races and multi-item changes atomic.
create function public.game_mutate(actor uuid,action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare prev game_requests; output jsonb; c draw_challenges; offer trade_offers; row record; e uuid:=gen_random_uuid(); n bigint; result_item smallint; roll int; cumulative int:=0; line jsonb; letter text; entropy bytea;
begin
 perform pg_advisory_xact_lock(76391602);
 if not exists(select 1 from profiles where id=actor) then raise exception '로그인이 필요합니다'; end if;
 select * into prev from game_requests where user_id=actor and game_requests.request_id=game_mutate.request_id;
 if found then if prev.action<>action or prev.payload<>payload then raise exception '중복 요청 내용이 다릅니다'; end if; return prev.result; end if;
 if action='nickname' then
  update profiles set nickname=payload->>'nickname',last_seen_at=now() where id=actor; output='{}';
 else
 if (select nickname is null from profiles where id=actor) then raise exception '닉네임을 먼저 설정하세요'; end if;
 if action='challenge' then
  if exists(select 1 from draw_challenges where user_id=actor and status='verifying' and verifying_at>now()-interval '30 seconds' and expires_at>now()) then raise exception '인증을 확인 중입니다. 잠시 기다려 주세요'; end if;
  update draw_challenges set status='failed' where user_id=actor and status='verifying';
  update draw_challenges set status='failed' where user_id=actor and status='pending';
  letter:=substr('가나다라마바사아자차카타파하구누두루무부수우주추쿠투푸후',1+get_byte(gen_random_bytes(1),0)%28,1);
  insert into draw_challenges(user_id,letter) values(actor,letter) returning * into c; output=to_jsonb(c);
 elsif action='claim' then
  select * into c from draw_challenges where id=(payload->>'id')::uuid and user_id=actor for update;
  if c.id is null or c.status<>'pending' or c.expires_at<now() then raise exception '만료되거나 사용한 인증입니다'; end if;
  update draw_challenges set status='verifying',verifying_at=clock_timestamp(),image_hash=payload->>'hash' where id=c.id; output=to_jsonb(c);
 elsif action='draw' then
  select * into c from draw_challenges where id=(payload->>'id')::uuid and user_id=actor for update;
  if c.id is null or c.status<>'verifying' or c.expires_at<now() then raise exception '만료되거나 사용한 인증입니다'; end if;
  if not (payload->>'verified')::boolean then update draw_challenges set status='failed' where id=c.id; output=jsonb_build_object('verified',false);
  else
   loop entropy:=gen_random_bytes(2); roll:=get_byte(entropy,0)*256+get_byte(entropy,1); exit when roll<65000; end loop; roll:=roll%1000;
   for row in select id,weight from items where kind='natural' order by id loop cumulative:=cumulative+row.weight; if roll<cumulative then result_item:=row.id; exit; end if; end loop;
   update draw_challenges set status='used' where id=c.id;
   insert into draw_events(challenge_id,user_id,item_id) values(c.id,actor,result_item);
   perform inventory_delta(actor,result_item,1,'draw',c.id); output=jsonb_build_object('verified',true,'itemId',result_item);
  end if;
 elsif action='craft' then
  result_item:=(payload->>'itemId')::smallint; n:=(payload->>'quantity')::bigint;
  if n is null or n<1 or n>1000000 or not exists(select 1 from recipes where result_id=result_item) then raise exception '잘못된 제작 요청입니다'; end if;
  for row in select * from recipe_inputs where result_id=result_item order by item_id loop perform inventory_delta(actor,row.item_id,-row.quantity*n,'craft_input',e); end loop;
  perform inventory_delta(actor,result_item,n,'craft_output',e); output=jsonb_build_object('itemId',result_item,'quantity',n);
 elsif action='offer' then
  if jsonb_array_length(payload->'give') not between 1 and 64 or jsonb_array_length(payload->'want') not between 1 and 64 then raise exception '교환 항목을 선택하세요'; end if;
  insert into trade_offers(id,owner_id) values(e,actor);
  for line in select value from jsonb_array_elements(payload->'give') loop
   insert into trade_offer_lines values(e,(line->>'itemId')::smallint,'give',(line->>'quantity')::bigint);
   perform inventory_delta(actor,(line->>'itemId')::smallint,-(line->>'quantity')::bigint,'escrow',e);
  end loop;
  for line in select value from jsonb_array_elements(payload->'want') loop insert into trade_offer_lines values(e,(line->>'itemId')::smallint,'want',(line->>'quantity')::bigint); end loop;
  output=jsonb_build_object('id',e);
 elsif action in ('accept','cancel') then
  select * into offer from trade_offers where id=(payload->>'id')::uuid for update;
  if offer.id is null or offer.status<>'open' then raise exception '이미 종료된 거래입니다'; end if;
  if action='cancel' then
   if offer.owner_id<>actor then raise exception '본인 거래만 취소할 수 있습니다'; end if;
   for row in select * from trade_offer_lines where offer_id=offer.id and side='give' loop perform inventory_delta(actor,row.item_id,row.quantity,'escrow_refund',offer.id); end loop;
   update trade_offers set status='cancelled',closed_at=now() where id=offer.id;
  else
   if offer.owner_id=actor then raise exception '본인 거래는 수락할 수 없습니다'; end if;
   for row in select * from trade_offer_lines where offer_id=offer.id order by item_id loop
    if row.side='want' then perform inventory_delta(actor,row.item_id,-row.quantity,'trade_send',offer.id); perform inventory_delta(offer.owner_id,row.item_id,row.quantity,'trade_receive',offer.id);
    else perform inventory_delta(actor,row.item_id,row.quantity,'escrow_receive',offer.id); end if;
   end loop;
   update trade_offers set status='completed',acceptor_id=actor,closed_at=now() where id=offer.id;
  end if; output=jsonb_build_object('id',offer.id);
 else raise exception '지원하지 않는 요청입니다'; end if;
 end if;
 insert into game_requests values(actor,request_id,action,payload,output); return output;
end $$;
create view public.rankings with (security_invoker=true) as select p.id,p.nickname,coalesce(i.quantity,0)::text as trophies,rank() over(order by coalesce(i.quantity,0) desc) as rank from profiles p left join inventories i on i.user_id=p.id and i.item_id=63 where p.nickname is not null;
-- Expose current trophy counts only, never other users' complete inventories.
alter view public.rankings set (security_invoker=false);
revoke all on public.rankings from anon;
grant select on public.rankings to authenticated;
DO $$ declare t text; begin foreach t in array array['profiles','items','inventories','item_discoveries','recipes','recipe_inputs','draw_challenges','draw_events','trade_offers','trade_offer_lines','inventory_ledger','game_requests'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon,authenticated',t); execute format('grant select on public.%I to authenticated',t); end loop; end $$;
create policy read_profiles on profiles for select to authenticated using(true);
create policy read_items on items for select to authenticated using(true);
create policy read_recipes on recipes for select to authenticated using(true);
create policy read_inputs on recipe_inputs for select to authenticated using(true);
create policy read_inventory on inventories for select to authenticated using(user_id=auth.uid());
create policy read_discoveries on item_discoveries for select to authenticated using(user_id=auth.uid());
create policy read_challenges on draw_challenges for select to authenticated using(user_id=auth.uid());
create policy read_draws on draw_events for select to authenticated using(user_id=auth.uid());
create policy read_offers on trade_offers for select to authenticated using(true);
create policy read_lines on trade_offer_lines for select to authenticated using(true);
create policy read_ledger on inventory_ledger for select to authenticated using(user_id=auth.uid());
revoke execute on function public.game_mutate(uuid,text,jsonb,uuid) from public,anon,authenticated;
revoke execute on function public.inventory_delta(uuid,smallint,bigint,text,uuid) from public,anon,authenticated;
revoke execute on function public.new_profile() from public,anon,authenticated;
grant execute on function public.game_mutate(uuid,text,jsonb,uuid) to service_role;
alter publication supabase_realtime add table public.trade_offers,public.inventories,public.item_discoveries;
-- Public invalidation feed keeps rankings fresh without exposing private inventory rows.
create table public.trophy_updates(user_id uuid primary key references public.profiles on delete cascade,changed_at timestamptz not null default clock_timestamp());
alter table public.trophy_updates enable row level security;
revoke all on public.trophy_updates from anon,authenticated;
grant select on public.trophy_updates to authenticated;
create policy read_trophy_updates on public.trophy_updates for select to authenticated using(true);
create function public.notify_trophy_update() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.item_id=63 then insert into trophy_updates(user_id) values(new.user_id) on conflict(user_id) do update set changed_at=clock_timestamp(); end if; return new; end $$;
create trigger trophy_inventory_changed after insert or update on public.inventories for each row execute function public.notify_trophy_update();
revoke execute on function public.notify_trophy_update() from public,anon,authenticated;
alter publication supabase_realtime add table public.trophy_updates;
-- Text quantities retain PostgreSQL bigint precision across JSON and JavaScript.
create view public.inventory_balances with (security_invoker=true) as select user_id,item_id,quantity::text as quantity from public.inventories;
revoke all on public.inventory_balances from anon;
grant select on public.inventory_balances to authenticated;

-- Server may inspect idempotency receipts, never from a browser.
grant select on public.game_requests to service_role;


insert into public.items(id,name,kind,weight) values
(0,'무(無)','secret',0),
(1,'나뭇가지','natural',100),
(2,'나뭇잎','natural',90),
(3,'나무껍질','natural',80),
(4,'볏짚','natural',90),
(5,'목화','natural',80),
(6,'덩굴','natural',70),
(7,'동물 가죽','natural',50),
(8,'깃털','natural',60),
(9,'돌멩이','natural',70),
(10,'모래','natural',60),
(11,'점토','natural',50),
(12,'조개껍데기','natural',50),
(13,'석탄','natural',30),
(14,'철광석','natural',30),
(15,'구리광석','natural',25),
(16,'은','natural',18),
(17,'금','natural',12),
(18,'진주','natural',11),
(19,'토파즈','natural',9),
(20,'루비','natural',5),
(21,'사파이어','natural',4),
(22,'에메랄드','natural',4),
(23,'다이아몬드','natural',2),
(24,'실','crafted',0),
(25,'천','crafted',0),
(26,'밧줄','crafted',0),
(27,'종이','crafted',0),
(28,'종이 상자','crafted',0),
(29,'가죽끈','crafted',0),
(30,'나무판자','crafted',0),
(31,'나무 액자','crafted',0),
(32,'유리','crafted',0),
(33,'벽돌','crafted',0),
(34,'철괴','crafted',0),
(35,'구리괴','crafted',0),
(36,'나무 상자','crafted',0),
(37,'은괴','crafted',0),
(38,'금괴','crafted',0),
(39,'밀짚모자','crafted',0),
(40,'가죽 장갑','crafted',0),
(41,'조개 목걸이','crafted',0),
(42,'종이비행기','crafted',0),
(43,'깃펜','crafted',0),
(44,'편지','crafted',0),
(45,'유리병','crafted',0),
(46,'거울','crafted',0),
(47,'돋보기','crafted',0),
(48,'가위','crafted',0),
(49,'열쇠','crafted',0),
(50,'자물쇠','crafted',0),
(51,'낚싯대','crafted',0),
(52,'부채','crafted',0),
(53,'우산','crafted',0),
(54,'가죽 가방','crafted',0),
(55,'팔찌','crafted',0),
(56,'진주 목걸이','crafted',0),
(57,'토파즈 반지','crafted',0),
(58,'루비 반지','crafted',0),
(59,'사파이어 귀걸이','crafted',0),
(60,'에메랄드 목걸이','crafted',0),
(61,'다이아몬드 왕관','crafted',0),
(62,'명예의 훈장','crafted',0),
(63,'우승 트로피','crafted',0) on conflict do nothing;
insert into public.recipes(result_id) values (24),(25),(26),(27),(28),(29),(30),(31),(32),(33),(34),(35),(36),(37),(38),(39),(40),(41),(42),(43),(44),(45),(46),(47),(48),(49),(50),(51),(52),(53),(54),(55),(56),(57),(58),(59),(60),(61),(62),(63) on conflict do nothing;
insert into public.recipe_inputs(result_id,item_id,quantity) values (24,5,3),(25,24,3),(26,6,4),(27,3,3),(27,2,2),(28,27,4),(29,7,3),(30,1,4),(31,30,3),(31,29,2),(32,10,3),(32,13,2),(33,11,3),(33,9,2),(33,13,2),(34,14,3),(34,13,2),(35,15,3),(35,13,2),(36,30,4),(36,26,2),(37,16,3),(37,13,2),(38,17,3),(38,13,2),(39,4,4),(39,24,2),(40,7,3),(40,24,2),(41,12,3),(41,24,2),(42,27,2),(43,8,2),(43,1,2),(44,27,2),(44,43,2),(45,32,3),(45,13,2),(46,32,2),(46,37,2),(47,32,2),(47,35,2),(48,34,3),(48,35,2),(49,35,2),(50,34,2),(50,49,2),(51,1,2),(51,24,2),(51,34,2),(52,27,3),(52,1,2),(53,25,3),(53,1,3),(53,34,2),(54,7,3),(54,29,2),(54,24,2),(55,35,2),(55,21,2),(56,18,3),(56,24,2),(57,38,2),(57,19,2),(58,38,2),(58,20,2),(59,37,2),(59,21,3),(60,38,2),(60,22,3),(60,24,2),(61,38,3),(61,23,3),(61,37,2),(62,38,38),(62,57,2),(62,58,2),(62,59,2),(62,25,50),(62,37,10),(62,34,10),(63,62,2),(63,38,10),(63,61,2),(63,60,2),(63,30,30),(63,32,20) on conflict (result_id,item_id) do update set quantity=excluded.quantity;

-- Rankings are disabled. Inventory, trophies and discoveries are preserved.
drop trigger if exists trophy_inventory_changed on public.inventories;
drop function if exists public.notify_trophy_update();
drop view if exists public.rankings;
drop table if exists public.trophy_updates;

-- Authenticated users may set only their own nickname; no inventory authority.
create function public.set_nickname(new_nickname text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception '로그인이 필요합니다'; end if;
 if new_nickname is null or new_nickname !~ '^[가-힣a-zA-Z0-9_]{2,12}$' then raise exception '닉네임은 2~12자로 입력하세요'; end if;
 insert into profiles(id,nickname) values(actor,new_nickname)
 on conflict(id) do update set nickname=excluded.nickname,last_seen_at=now();
 return jsonb_build_object('nickname',new_nickname);
end $$;
revoke execute on function public.set_nickname(text) from public,anon;
grant execute on function public.set_nickname(text) to authenticated;

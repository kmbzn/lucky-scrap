-- Standard vehicle plate letters, including commercial, rental and delivery: 40 letters.
create or replace function public.game_mutate(actor uuid,action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
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
  -- Reject 240..255 so each of the 40 letters has equal probability.
  loop roll:=get_byte(gen_random_bytes(1),0); exit when roll<240; end loop;
  letter:=substr('가나다라마거너더러머버서어저고노도로모보소오조구누두루무부수우주아바사자하허호배',1+roll%40,1);
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

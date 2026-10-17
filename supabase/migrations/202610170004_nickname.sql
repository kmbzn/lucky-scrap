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

-- Only previously discovered items may be selected as a profile image.
alter table public.profiles add column avatar_item_id smallint references public.items(id);

create function public.set_avatar(new_item_id smallint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception '로그인이 필요합니다'; end if;
 if new_item_id is not null and not exists(
   select 1 from public.item_discoveries where user_id=actor and item_id=new_item_id
 ) then raise exception '도감에 등록한 아이템만 선택할 수 있습니다'; end if;
 update public.profiles set avatar_item_id=new_item_id where id=actor;
 if not found then raise exception '프로필이 없습니다'; end if;
 return jsonb_build_object('avatar_item_id',new_item_id);
end $$;
revoke execute on function public.set_avatar(smallint) from public,anon;
grant execute on function public.set_avatar(smallint) to authenticated;

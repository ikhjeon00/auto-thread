-- 댓글에 사진·영상 1개 첨부 (링크 미리보기 카드 없이 링크만 보이게 할 때 사용)
-- 다시 실행해도 안전하다.
alter table public.post_replies add column if not exists media_type text;
alter table public.post_replies add column if not exists media_url text;
alter table public.post_replies add column if not exists storage_path text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_replies_media_type_check') then
    alter table public.post_replies
      add constraint post_replies_media_type_check check (media_type is null or media_type in ('image', 'video'));
  end if;
end;
$$;

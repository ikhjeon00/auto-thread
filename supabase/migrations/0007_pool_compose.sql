-- 창고 글을 글 작성과 같은 형태(사진·댓글 여러 개·링크·고지 문구 등)로 저장
-- 다시 실행해도 안전하다.
alter table public.pool_items add column if not exists compose jsonb;

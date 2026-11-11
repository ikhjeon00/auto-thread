-- 상품 홍보글: 제휴 고지 문구를 첫 댓글 맨 앞에 넣는 위치(reply_top) 허용
-- 다시 실행해도 안전하다.
alter table public.posts drop constraint if exists posts_disclosure_position_check;
alter table public.posts
  add constraint posts_disclosure_position_check
  check (disclosure_position in ('body', 'link_reply', 'separate_reply', 'reply_top'));

-- M3: 글 작성·예약·발행 상태 머신
-- 0001_init.sql 다음에 실행한다. 다시 실행해도 안전하다.

-- 작성 화면 원본 상태(수정할 때 다시 불러옴), 처리 잠금, 댓글 진행 여부
alter table public.posts add column if not exists compose jsonb;
alter table public.posts add column if not exists locked_until timestamptz;
alter table public.posts add column if not exists replies_pending boolean not null default false;
alter table public.posts add column if not exists container_created_at timestamptz;

-- 댓글 종류(user: 직접 쓴 댓글, link: 링크 댓글, disclosure: 고지 문구 댓글)와 재시도 정보
alter table public.post_replies add column if not exists kind text not null default 'user';
alter table public.post_replies add column if not exists attempt_count int not null default 0;
alter table public.post_replies add column if not exists last_error text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_replies_kind_check') then
    alter table public.post_replies
      add constraint post_replies_kind_check check (kind in ('user', 'link', 'disclosure'));
  end if;
end;
$$;

-- 발행 대상 조회용 인덱스
create index if not exists posts_due_idx
  on public.posts ((coalesce(next_attempt_at, scheduled_at)))
  where status in ('scheduled', 'processing') or replies_pending;

-- ---------------------------------------------------------------
-- 발행할 글을 잠그고 가져온다 (중복 발행 방지)
--   FOR UPDATE SKIP LOCKED 로 동시에 실행된 다른 호출과 겹치지 않게 하고,
--   locked_until(리스)을 걸어 다음 실행이 처리 중인 글을 다시 가져가지 않게 한다.
-- ---------------------------------------------------------------
create or replace function public.claim_due_posts(p_limit int default 10, p_lease_seconds int default 120)
returns setof public.posts
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select p.id
    from public.posts p
    where (p.locked_until is null or p.locked_until < now())
      and (
        (p.status = 'scheduled' and p.scheduled_at <= now() and coalesce(p.next_attempt_at, p.scheduled_at) <= now())
        or (p.status = 'processing' and coalesce(p.next_attempt_at, now()) <= now())
        or (p.status = 'published' and p.replies_pending and coalesce(p.next_attempt_at, now()) <= now())
      )
    order by coalesce(p.next_attempt_at, p.scheduled_at) nulls first
    limit p_limit
    for update skip locked
  )
  update public.posts p
     set locked_until = now() + make_interval(secs => p_lease_seconds)
    from due
   where p.id = due.id
  returning p.*;
end;
$$;

revoke all on function public.claim_due_posts(int, int) from public, anon, authenticated;
grant execute on function public.claim_due_posts(int, int) to service_role;

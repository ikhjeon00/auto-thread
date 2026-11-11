-- M9: 정리 작업용 — 오래된 1회용 업로드 파일 목록(저장소 테이블은 API로 직접 못 읽어서 함수로)
-- 다시 실행해도 안전하다.
create or replace function public.list_stale_uploads(p_days int default 3, p_limit int default 500)
returns table (name text, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select o.name, o.created_at
  from storage.objects o
  where o.bucket_id = 'media'
    and o.name like 'uploads/%'
    and o.created_at < now() - make_interval(days => p_days)
  order by o.created_at
  limit p_limit;
$$;

revoke all on function public.list_stale_uploads(int, int) from public, anon, authenticated;
grant execute on function public.list_stale_uploads(int, int) to service_role;

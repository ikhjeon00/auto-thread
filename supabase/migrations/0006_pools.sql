-- M6: 글 창고 랜덤 배정, jobs 큐
-- 다시 실행해도 안전하다.

-- 배정(예약) 정보: 누가 언제 가져갔는지. 오래 묵은 배정은 매일 풀어 준다
alter table public.pool_items add column if not exists reserved_at timestamptz;
alter table public.pool_items add column if not exists reserved_account_id uuid references public.threads_accounts(id) on delete set null;
create index if not exists pool_items_pool_status_category_idx on public.pool_items (pool_id, status, category);
create index if not exists pool_items_reserved_idx on public.pool_items (reserved_at) where status = 'reserved';

-- jobs 큐: 처리 중 잠금(리스)
alter table public.jobs add column if not exists locked_until timestamptz;

create or replace function public.claim_jobs(p_limit int default 3, p_lease_seconds int default 300)
returns setof public.jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select j.id
    from public.jobs j
    where j.status in ('queued', 'running')
      and j.run_after <= now()
      and (j.locked_until is null or j.locked_until < now())
    order by j.run_after
    limit p_limit
    for update skip locked
  )
  update public.jobs j
     set status = 'running',
         locked_until = now() + make_interval(secs => p_lease_seconds)
    from due
   where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_jobs(int, int) from public, anon, authenticated;
grant execute on function public.claim_jobs(int, int) to service_role;

-- 주기 작업 호출 함수: 오래 걸리는 작업(jobs)용으로 대기 시간을 지정할 수 있게 다시 만든다
-- (cron.sql 을 실행하지 않은 환경에서도 이 파일만으로 안전하게 넘어가도록 vault 가 있을 때만)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'vault') and exists (select 1 from pg_namespace where nspname = 'net') then
    execute $fn$
      create or replace function public.call_cron(path text, timeout_ms int default 55000)
      returns bigint
      language sql
      security definer
      set search_path = ''
      as $body$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/' || path,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := timeout_ms
        );
      $body$;
    $fn$;
    execute 'drop function if exists public.call_cron(text)';
    execute 'revoke all on function public.call_cron(text, int) from public, anon, authenticated';
  end if;
end;
$$;

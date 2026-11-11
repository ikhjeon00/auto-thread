-- AUTO THREAD 주기 작업 등록 (Supabase pg_cron → pg_net → Vercel API)
-- 실행 전에 아래 두 자리 표시를 바꾼다:
--   <APP_URL>      예) https://auto-thread-seven.vercel.app   (끝에 / 없이)
--   <CRON_SECRET>  Vercel 환경변수 CRON_SECRET 과 같은 값
-- 다시 실행해도 된다(같은 이름의 작업은 덮어쓴다). pg_cron 시간은 UTC 기준이다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 비밀값은 Vault에 보관 (이미 있으면 갱신)
do $$
begin
  if exists (select 1 from vault.secrets where name = 'app_url') then
    perform vault.update_secret((select id from vault.secrets where name = 'app_url'), '<APP_URL>');
  else
    perform vault.create_secret('<APP_URL>', 'app_url');
  end if;
  if exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<CRON_SECRET>');
  else
    perform vault.create_secret('<CRON_SECRET>', 'cron_secret');
  end if;
end;
$$;

-- 공통 호출 함수: /api/cron/<path> 를 Bearer 인증으로 POST
create or replace function public.call_cron(path text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/' || path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$$;
revoke all on function public.call_cron(text) from public, anon, authenticated;

-- 매일 04:00 KST (= 19:00 UTC): 장기 토큰 갱신
select cron.schedule('refresh-tokens', '0 19 * * *', $$select public.call_cron('refresh-tokens')$$);

-- 1분마다: 발행 상태 머신 진행 (M3)
select cron.schedule('publish', '* * * * *', $$select public.call_cron('publish')$$);

-- 이후 단계에서 추가될 작업 (지금은 주석)
-- M7: select cron.schedule('jobs',             '* * * * *',     $$select public.call_cron('jobs')$$);
-- M8: select cron.schedule('sync-stats',       '10 15 * * *',   $$select public.call_cron('sync-stats')$$);   -- 00:10 KST
-- M8: select cron.schedule('sync-stats-3h',    '0 */3 * * *',   $$select public.call_cron('sync-stats')$$);
-- M6: select cron.schedule('pool-maintenance', '0 17 * * *',    $$select public.call_cron('pool-maintenance')$$); -- 02:00 KST
-- M9: select cron.schedule('cleanup',          '0 20 * * *',    $$select public.call_cron('cleanup')$$);    -- 05:00 KST

-- 확인용:
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, content from net._http_response order by created desc limit 10;

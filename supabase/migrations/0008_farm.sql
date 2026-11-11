-- M7: 계정 키우기 농장 / 수익화 농장 / 자료실
-- 다시 실행해도 안전하다.

-- 한 번에 만든 캠페인 묶음(계정마다 캠페인 1개), 추가 설정, 만드는 작업
alter table public.campaigns add column if not exists batch_id uuid;
alter table public.campaigns add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.campaigns add column if not exists job_id uuid references public.jobs(id) on delete set null;
create index if not exists campaigns_batch_idx on public.campaigns (batch_id);

-- 상품: 사진(보관 폴더 경로)과 AI가 참고할 특징
alter table public.products add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists is_active boolean not null default true;

-- 자료실 묶음 검색
create index if not exists asset_bundles_name_idx on public.asset_bundles (name);

-- 농장으로 만든 글(캠페인별 조회)
create index if not exists posts_campaign_status_idx on public.posts (campaign_id, status);

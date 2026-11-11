-- AUTO THREAD 초기 스키마
-- 규칙: enum은 text + check, 시간은 timestamptz(UTC), 모든 테이블 RLS on + anon 정책 없음(서버 service role만 접근)

-- ---------------------------------------------------------------
-- 공통: updated_at 자동 갱신
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 설정
-- ---------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null default 'null'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.account_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#E8590C',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Threads 계정
-- ---------------------------------------------------------------
create table public.threads_accounts (
  id                   uuid primary key default gen_random_uuid(),
  threads_user_id      text not null unique,
  username             text not null,
  profile_picture_url  text,
  access_token_enc     text,
  token_expires_at     timestamptz,
  token_refreshed_at   timestamptz,
  status               text not null default 'active'
                       check (status in ('active', 'needs_reconnect', 'disabled')),
  group_id             uuid references public.account_groups(id) on delete set null,
  daily_post_limit     int not null default 10 check (daily_post_limit between 0 and 250),
  follower_count       int,
  last_synced_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index threads_accounts_group_idx on public.threads_accounts (group_id);
create index threads_accounts_status_idx on public.threads_accounts (status);
create index threads_accounts_token_exp_idx on public.threads_accounts (token_expires_at);

create table public.personas (
  account_id  uuid primary key references public.threads_accounts(id) on delete cascade,
  age_group   text check (age_group in ('20s', '30s', '40s_early', '40s_late', 'any')),
  gender      text check (gender in ('male', 'female', 'any')),
  job         text check (job in ('office', 'self_employed', 'business', 'homemaker', 'any')),
  tone        text,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- AI 생성기 / 주제 / 글 형식
-- ---------------------------------------------------------------
create table public.generators (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  version               int not null default 1,
  kind                  text not null check (kind in ('daily', 'product', 'vision')),
  system_prompt         text not null,
  user_prompt_template  text not null,
  model                 text,  -- null이면 환경변수 AI_MODEL_TEXT / AI_MODEL_VISION 사용
  temperature           numeric(3, 2) not null default 0.9 check (temperature between 0 and 2),
  example_count         int not null default 3 check (example_count between 0 and 10),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (name, version)
);

create table public.topics (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  topic         text not null,
  keywords      text[] not null default '{}',
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (category, topic)
);
create index topics_last_used_idx on public.topics (last_used_at nulls first);

create table public.post_formats (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  instruction  text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 제휴 고지 / 상품 / 자료실
-- ---------------------------------------------------------------
create table public.disclosures (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  text              text not null,
  match_domains     text[] not null default '{}',
  is_default        boolean not null default false,
  default_position  text not null default 'link_reply'
                    check (default_position in ('body', 'link_reply', 'separate_reply')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- 기본값은 하나만
create unique index disclosures_single_default_idx on public.disclosures (is_default) where is_default;

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  affiliate_url  text not null,
  disclosure_id  uuid references public.disclosures(id) on delete set null,
  media_paths    text[] not null default '{}',
  memo           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.asset_bundles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text,
  memo        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index asset_bundles_category_idx on public.asset_bundles (category);

create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  bundle_id     uuid not null references public.asset_bundles(id) on delete cascade,
  storage_path  text not null,
  media_type    text not null check (media_type in ('image', 'video')),
  width         int,
  height        int,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index assets_bundle_idx on public.assets (bundle_id, sort_order);

-- ---------------------------------------------------------------
-- 글 창고
-- ---------------------------------------------------------------
create table public.content_pools (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text,
  persona_filter       jsonb not null default '{}'::jsonb,
  low_stock_days       int not null default 3 check (low_stock_days >= 0),
  auto_refill          boolean not null default false,
  refill_generator_id  uuid references public.generators(id) on delete set null,
  reuse_cooldown_days  int check (reuse_cooldown_days is null or reuse_cooldown_days >= 0), -- null = 재사용 안 함
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.pool_accounts (
  pool_id     uuid not null references public.content_pools(id) on delete cascade,
  account_id  uuid not null references public.threads_accounts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (pool_id, account_id)
);
create index pool_accounts_account_idx on public.pool_accounts (account_id);

create table public.pool_items (
  id            uuid primary key default gen_random_uuid(),
  pool_id       uuid not null references public.content_pools(id) on delete cascade,
  text          text not null,
  first_reply   text,
  topic_tag     text,
  category      text,
  media         jsonb not null default '[]'::jsonb,
  persona_tags  text[] not null default '{}',
  status        text not null default 'pending'
                check (status in ('pending', 'available', 'reserved', 'used', 'archived')),
  weight        int not null default 1 check (weight >= 1),
  source        text not null default 'manual' check (source in ('ai', 'manual', 'csv', 'bookmark')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index pool_items_pool_status_idx on public.pool_items (pool_id, status);

-- ---------------------------------------------------------------
-- 캠페인(농장)
-- ---------------------------------------------------------------
create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.threads_accounts(id) on delete cascade,
  kind             text not null check (kind in ('growth', 'monetize')),
  start_date       date not null,
  days             int not null check (days between 1 and 30),
  daily_count      int not null check (daily_count >= 1),
  active_start     time not null default '08:00',
  active_end       time not null default '23:00',
  content_source   text not null default 'ai' check (content_source in ('ai', 'pool')),
  assign_timing    text not null default 'pre' check (assign_timing in ('pre', 'at_publish')),
  pool_id          uuid references public.content_pools(id) on delete set null,
  product_ids      uuid[] not null default '{}',
  daily_mix_ratio  numeric(4, 3) check (daily_mix_ratio is null or daily_mix_ratio between 0 and 1),
  mode             text not null default 'review' check (mode in ('review', 'auto')),
  status           text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (active_start < active_end)
);
create index campaigns_account_idx on public.campaigns (account_id, status);

-- ---------------------------------------------------------------
-- 게시물
-- ---------------------------------------------------------------
create table public.posts (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references public.threads_accounts(id) on delete cascade,
  campaign_id          uuid references public.campaigns(id) on delete set null,
  pool_item_id         uuid references public.pool_items(id) on delete set null,
  generator_id         uuid references public.generators(id) on delete set null,
  kind                 text not null default 'general' check (kind in ('general', 'product')),
  status               text not null default 'draft'
                       check (status in ('draft', 'review', 'scheduled', 'processing', 'published', 'failed', 'cancelled')),
  text                 text not null default '',
  link_url             text,
  link_position        text check (link_position in ('body', 'first_reply')),
  topic_tag            text,
  disclosure_id        uuid references public.disclosures(id) on delete set null,
  disclosure_position  text check (disclosure_position in ('body', 'link_reply', 'separate_reply')),
  is_ai_label          boolean not null default false,
  scheduled_at         timestamptz,
  published_at         timestamptz,
  container_id         text,
  threads_media_id     text,
  permalink            text,
  attempt_count        int not null default 0,
  next_attempt_at      timestamptz,
  last_error           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index posts_status_scheduled_idx on public.posts (status, scheduled_at);
create index posts_status_next_attempt_idx on public.posts (status, next_attempt_at);
create index posts_account_scheduled_idx on public.posts (account_id, scheduled_at desc);
create index posts_account_published_idx on public.posts (account_id, published_at desc);
create index posts_campaign_idx on public.posts (campaign_id);
create index posts_pool_item_idx on public.posts (pool_item_id);

create table public.post_media (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  storage_path  text not null,
  public_url    text not null,
  media_type    text not null check (media_type in ('image', 'video')),
  sort_order    int not null default 0,
  container_id  text,
  delete_after  timestamptz,  -- null이면 보관(자료실·상품 사진)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index post_media_post_idx on public.post_media (post_id, sort_order);
create index post_media_delete_after_idx on public.post_media (delete_after) where delete_after is not null;

create table public.post_replies (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts(id) on delete cascade,
  text              text not null,
  sort_order        int not null default 0,
  container_id      text,
  threads_media_id  text,
  status            text not null default 'pending' check (status in ('pending', 'processing', 'published', 'failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index post_replies_post_idx on public.post_replies (post_id, sort_order);

create table public.pool_item_usage (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.pool_items(id) on delete cascade,
  account_id  uuid not null references public.threads_accounts(id) on delete cascade,
  post_id     uuid references public.posts(id) on delete set null,
  used_at     timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index pool_item_usage_item_idx on public.pool_item_usage (item_id, used_at desc);
create index pool_item_usage_account_idx on public.pool_item_usage (account_id, used_at desc);

-- ---------------------------------------------------------------
-- 보석함 / 통계
-- ---------------------------------------------------------------
create table public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('mine', 'reference')),
  account_id  uuid references public.threads_accounts(id) on delete set null,
  post_id     uuid references public.posts(id) on delete set null,
  text        text not null,
  source_url  text,
  metrics     jsonb not null default '{}'::jsonb,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index bookmarks_kind_idx on public.bookmarks (kind, created_at desc);
create unique index bookmarks_post_unique_idx on public.bookmarks (post_id) where post_id is not null;

create table public.account_daily_stats (
  account_id  uuid not null references public.threads_accounts(id) on delete cascade,
  date        date not null,  -- KST 기준 날짜
  followers   int,
  views       int not null default 0,
  likes       int not null default 0,
  replies     int not null default 0,
  reposts     int not null default 0,
  quotes      int not null default 0,
  clicks      int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (account_id, date)
);
create index account_daily_stats_date_idx on public.account_daily_stats (date);

create table public.post_insights (
  post_id     uuid primary key references public.posts(id) on delete cascade,
  views       int not null default 0,
  likes       int not null default 0,
  replies     int not null default 0,
  reposts     int not null default 0,
  quotes      int not null default 0,
  shares      int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 작업 큐 / 로그 / 알림
-- ---------------------------------------------------------------
create table public.jobs (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  progress    int not null default 0,
  total       int not null default 0,
  attempts    int not null default 0,
  run_after   timestamptz not null default now(),
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index jobs_status_run_after_idx on public.jobs (status, run_after);

create table public.generation_logs (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid references public.jobs(id) on delete set null,
  post_id        uuid references public.posts(id) on delete set null,
  pool_item_id   uuid references public.pool_items(id) on delete set null,
  model          text not null,
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  cost_usd       numeric(12, 6) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index generation_logs_created_idx on public.generation_logs (created_at);

create table public.publish_logs (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.posts(id) on delete cascade,
  step        text not null,
  attempt     int not null default 0,
  message     text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index publish_logs_post_idx on public.publish_logs (post_id, created_at);
create index publish_logs_created_idx on public.publish_logs (created_at);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  level       text not null default 'info' check (level in ('info', 'warn', 'error')),
  type        text not null,
  message     text not null,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notifications_unread_idx on public.notifications (is_read, created_at desc);

-- ---------------------------------------------------------------
-- updated_at 트리거 + RLS (모든 테이블)
-- ---------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_settings', 'account_groups', 'threads_accounts', 'personas', 'generators', 'topics',
    'post_formats', 'disclosures', 'products', 'asset_bundles', 'assets', 'content_pools',
    'pool_items', 'pool_item_usage', 'campaigns', 'posts', 'post_media', 'post_replies',
    'bookmarks', 'account_daily_stats', 'post_insights', 'jobs', 'generation_logs',
    'publish_logs', 'notifications'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;

  foreach t in array array[
    'app_settings', 'account_groups', 'threads_accounts', 'personas', 'generators', 'topics',
    'post_formats', 'disclosures', 'products', 'asset_bundles', 'assets', 'content_pools',
    'pool_accounts', 'pool_items', 'pool_item_usage', 'campaigns', 'posts', 'post_media',
    'post_replies', 'bookmarks', 'account_daily_stats', 'post_insights', 'jobs',
    'generation_logs', 'publish_logs', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- Storage 버킷: media (공개 읽기, 업로드는 서버가 발급한 signed URL로만)
-- ---------------------------------------------------------------
-- 파일 크기 상한은 프로젝트 전역 설정(Storage > Settings)을 따른다. Free 플랜은 50MB.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('media', 'media', true, array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

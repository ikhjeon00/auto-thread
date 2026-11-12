# 작업지시서: AUTO THREAD 처음부터 만들기

> **이 파일 하나로** 새 사람이 자기 계정(GitHub·Supabase·Vercel·Meta)에서 AUTO THREAD를 처음부터 만들 수 있게 쓴 작업지시서다.
> 코드는 주지 않는다. Claude Code가 이 문서대로 코드를 새로 만들고, 사용자는 단계마다 안내에 따라 서비스 설정만 한다.

## 이 파일 쓰는 법 (사용자용)

1. GitHub에서 **빈 저장소**를 하나 만든다(예: `auto-thread`, Private 권장).
2. Claude Code(웹 claude.ai/code 또는 데스크톱 앱)에서 그 저장소를 열고 이 파일을 첨부한 뒤 이렇게 말한다.

   > 이 작업지시서를 저장소 루트에 `CLAUDE.md`로 저장하고, M1부터 순서대로 진행해 줘. 단계마다 내가 할 일과 확인 방법을 알려 주고 멈춰.

3. Claude가 각 단계(M1~M9)를 마칠 때마다 알려 주는 **사용자가 할 일**을 하고, **확인 방법**대로 확인한 뒤 「다음 단계 진행」이라고 말한다.
4. 전체를 한 번에 끝내지 않아도 된다. 새 대화를 열어도 `CLAUDE.md`와 README의 진행 표를 보고 이어서 한다.

---

## 0. 무엇을 만드나

**한 사람이 쓰는 Threads 예약·자동 발행 웹앱.** 로그인은 비밀번호 하나, 사용자 계정 기능은 없다.

| 기능 | 요약 |
|---|---|
| 계정 연결 | Threads 계정 최대 50개를 공식 API(OAuth)로 연결, 토큰 암호화 저장·자동 갱신 |
| 글 작성 | 설정 → 작성 → 발행 3단계. 사진·영상(캐러셀), 댓글 여러 개(스레드), 링크, 제휴 고지 문구, 커뮤니티 주제, AI 표시. 모바일 미리보기 |
| 예약·자동 발행 | 1분마다 예약 시간이 된 글을 발행. 재시도, 실패 알림 |
| AI 글 생성 | OpenAI 또는 Gemini 중 선택. 생성기(프롬프트)·주제·글 형식·페르소나·보석함 예시로 생성 |
| 글 창고 | 미리 만든 글을 쌓아 두고 계정별로 규칙에 따라 랜덤 배정 |
| 계정 키우기 농장 | 여러 계정 × 여러 날 일상글을 자동으로 시간 배치·생성·예약 |
| 수익화 농장 | 일상글 + 제휴 상품글을 섞어 자동 배치. 상품 사진을 AI가 보고 씀 |
| 자료실 | 상품 사진·영상 묶음 보관, 글로 만들기 |
| 보석함 | 잘 된 내 글·참고 글 보관, AI 예시로 활용 |
| 대시보드 | 계정·게시물 통계(팔로워 추이, 반응 지표, 계정 표) |
| 활동 | 발행 성공·실패, 재연결 필요, 재고 부족, AI 오류 알림 |

### 하지 않는 것 (요청이 와도 구현하지 않는다)

- 프록시·IP 우회, 기기 지문 위장, 비공식(웹 스크래핑·자동 로그인) 방식의 발행
- 다른 사람 게시물 자동 수집, 자동 팔로우·좋아요·댓글
- 여러 사용자 계정·권한 관리(한 사람용 앱)

---

## 1. 작업 규칙 (Claude가 지킬 것)

1. **마일스톤(M1~M9)을 순서대로 하나씩** 진행한다. 한 마일스톤이 끝나면 커밋·push 하고, 사용자에게 **① 사용자가 할 일 ② 확인 방법**을 알려 준 뒤 멈춘다. 사용자가 확인했다고 하면 다음으로 간다.
2. 이 문서와 다르게 만들어야 하면(라이브러리가 바뀌었거나 API가 달라졌거나) **먼저 사용자에게 묻는다.** 외부 API(Threads, OpenAI, Gemini, Supabase)는 만들기 전에 **공식 문서를 확인**하고, 이 문서와 다르면 공식 문서를 따르되 무엇이 달랐는지 사용자에게 알린다.
3. **비밀값(API 키, 토큰, service role key, 비밀번호)은 절대 브라우저 코드나 Git에 넣지 않는다.** Vercel 환경변수·Supabase Vault·앱 설정 화면(암호화 저장)에만 둔다. 사용자에게 채팅에 비밀값을 붙여 넣으라고 하지 않는다.
4. 사용자는 개발자가 아니라고 가정한다. 화면 안내는 **한국어**, 메뉴 이름은 **실제 화면에 보이는 그대로** 쓴다. 터미널 명령이 필요하면 복사해서 붙여 넣을 수 있게 하나씩 준다.
5. 마일스톤마다 `README.md`의 「진행 상황」 표를 갱신하고, 설치·운영 방법을 README에 쌓아 간다(최종 README는 이 문서 「12. README에 들어갈 내용」 참고).
6. 순수 함수(시간 배치, 창고 선택, 발행 형태 변환, 글자 수 등)는 **단위 테스트**를 함께 만든다(「11. 테스트」).
7. 마일스톤을 마치기 전에 `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`가 모두 통과해야 한다.
8. DB 구조는 **부록 A의 SQL을 그대로** 쓴다. 바꿔야 하면 새 마이그레이션 파일을 추가하고(다시 실행해도 안전하게), README의 실행 순서에 넣는다.
9. 부록 E의 코드는 동작이 검증된 **참고 구현**이다. 그대로 써도 되고, 같은 동작을 하면 다르게 써도 된다.

---

## 2. 사용자 준비물

| 준비물 | 용도 | 비용 |
|---|---|---|
| GitHub 계정 + 빈 저장소 | 코드 보관, Vercel 자동 배포 | 무료 |
| [Supabase](https://supabase.com) 계정 | DB, 파일 저장소, 주기 작업(pg_cron) | Free 플랜 가능(50MB 넘는 영상은 Pro) |
| [Vercel](https://vercel.com) 계정 | 웹앱 배포 | Hobby 무료 |
| Meta 개발자 계정 + Threads 앱 | Threads API (테스터 계정 최대 50개) | 무료 |
| 연결할 Threads 계정 | 발행 대상 | – |
| (선택) OpenAI 또는 Google Gemini API 키 | AI 글 생성 | 사용량 과금 |

- Supabase Free 플랜은 오래 안 쓰면 프로젝트가 일시 중지될 수 있다(대시보드에서 다시 켜면 됨).
- Supabase 리전은 **Northeast Asia (Seoul)** 권장.

---

## 3. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | **Next.js 15 (App Router) + React 19 + TypeScript**, 서버 액션 사용 |
| 스타일 | **Tailwind CSS 4** + shadcn/ui 스타일 컴포넌트(직접 추가), 아이콘 `lucide-react`, 폰트 **Pretendard** (`pretendard` 패키지) |
| DB·저장소 | **Supabase** (Postgres, Storage, pg_cron, pg_net, Vault). 클라이언트 `@supabase/supabase-js` |
| 검증 | `zod` |
| 날짜 | `date-fns`, `date-fns-tz` (모든 화면·규칙은 **KST, Asia/Seoul**) |
| 차트 | `recharts` |
| AI | `openai`(Responses API), `@google/genai` |
| 이미지 변환 | `heic2any`(브라우저에서 HEIC → JPEG) |
| 테스트 | `vitest` |
| 배포 | Vercel (Hobby). **Vercel Cron은 쓰지 않고** Supabase pg_cron이 API를 호출한다 |

`package.json` 스크립트: `dev`(`next dev --turbopack`), `build`, `start`, `lint`(`eslint`), `test`(`vitest run`).

---

## 4. 보안 원칙

- **로그인**: 환경변수 `APP_PASSWORD`와 일정 시간 비교 → 성공하면 **HMAC-SHA256 서명 쿠키**(`at_session`, httpOnly, secure, sameSite=lax, 30일). 쿠키 값 `v1.<만료 epoch초>.<base64url 서명>`, 서명 키 `SESSION_SECRET`(32자 이상). Web Crypto로 구현해 Edge(middleware)와 Node 모두에서 동작(부록 E).
- **middleware**: `/login`과 `/api/cron/*`을 뺀 모든 경로 보호. 로그인 안 했으면 페이지는 `/login?next=…`로, `/api/*`는 401. 로그인한 상태로 `/login`에 오면 `/`로.
- **서버 액션·API 라우트**도 `requireSession()`으로 한 번 더 확인(이중 방어).
- **`/api/cron/*`**: `Authorization: Bearer ${CRON_SECRET}` 헤더가 정확히 맞아야 함(일정 시간 비교). 아니면 401.
- **DB**: 모든 테이블 RLS 켜고 정책 없음 → anon 키로는 아무것도 못 읽는다. 서버가 **service role 키로만** 접근(`lib/db/admin.ts`, `server-only`). DB 함수는 service_role만 실행 가능.
- **Threads 토큰과 앱에서 등록한 AI 키**: `TOKEN_ENCRYPTION_KEY`(base64 32바이트)로 **AES-256-GCM** 암호화 저장. 형식 `v1.<iv>.<tag>.<ciphertext>`(base64url). 화면에는 끝 4자리만.
- **업로드**: 서버가 발급한 **signed upload URL**로만 브라우저가 Storage에 직접 올린다(Vercel 요청 크기 제한 회피). `media` 버킷은 공개 읽기(Threads가 사진 URL을 가져가야 하므로), 경로는 `폴더/uuid/파일명`으로 추측 불가하게.
- **OAuth state**: 무작위 값을 httpOnly 쿠키(경로 `/api/threads/oauth`, 10분)에 저장하고 콜백에서 일정 시간 비교.
- 환경변수는 `lib/env.ts`(`server-only`, zod로 지연 검증)에서만 읽는다. `NEXT_PUBLIC_*`(Supabase URL·anon 키)만 브라우저에 노출.
- 모든 페이지 `robots: noindex, nofollow`.

### 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `APP_PASSWORD` | ✅ | 로그인 비밀번호 |
| `SESSION_SECRET` | ✅ | 세션 쿠키 서명 키(32자 이상). `openssl rand -base64 48` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 접속 정보 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 서버 전용 DB 키 |
| `STORAGE_BUCKET` | – | 기본 `media` |
| `CRON_SECRET` | ✅ | `/api/cron/*` 인증(16자 이상). `openssl rand -hex 32` |
| `THREADS_APP_ID` / `THREADS_APP_SECRET` / `THREADS_REDIRECT_URI` | ✅(M2부터) | Threads 앱 정보. 리디렉션은 `https://<배포주소>/api/threads/oauth/callback` |
| `TOKEN_ENCRYPTION_KEY` | ✅(M2부터) | 토큰·AI 키 암호화. `openssl rand -base64 32`. **잃으면 모든 계정 재연결** |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | – | 앱의 설정 > AI에서 등록하는 것을 권장(등록한 키가 우선) |
| `APP_TIMEZONE` | – | 기본 `Asia/Seoul` |

`.env.example`은 부록 D. Supabase URL은 끝의 `/`나 `/rest/v1` 같은 경로가 붙어 들어와도 동작하게 정규화한다.

---

## 5. 디자인

### 토큰 (`app/globals.css`의 `:root`)

| 토큰 | 값 | | 토큰 | 값 |
|---|---|---|---|---|
| `--background` | `#F7F5F0` (따뜻한 아이보리) | | `--primary` | `#E8590C` (주황) |
| `--foreground` | `#1F1D1A` | | `--primary-soft` | `#FFF1E8` |
| `--card` | `#FFFFFF` | | `--muted` / `--secondary` | `#F1EEE7` |
| `--muted-foreground` | `#78726A` | | `--accent` | `#F4F1EA` |
| `--border` | `#E7E3DA` | | `--input` | `#DDD8CE` |
| `--destructive` | `#DC2626` | | `--success` | `#16A34A` |
| `--warning` | `#E8590C` | | `--radius` | `12px` |

- 폰트 Pretendard Variable, 숫자는 `tabular-nums`(유틸리티 `num`).
- 카드: 흰 배경, 얇은 테두리, 아주 옅은 그림자. 여백 넉넉하게, 정보 밀도는 중간.
- 기본 컴포넌트(`components/ui`): Button, Card, Input, Textarea, Label, Select, Badge(variant: default/outline/success/warning/error), **Chip**(필터·선택용 둥근 토글).
- 라이트 모드만 만든다.

### 레이아웃

- 왼쪽 고정 **사이드바**(흰 배경, 폭 약 240px) + 오른쪽 본문(최대 폭 제한, 좌우 여백). 모바일(`lg` 미만)은 상단 바 + 햄버거로 여는 서랍.
- 사이드바 맨 위 로고 **AUTO THREAD**(THREAD만 주황), 맨 아래 「로그아웃」.
- 현재 메뉴는 `primary-soft` 배경 + 주황 굵은 글씨.
- 배지: **활동**(읽지 않은 알림 수), **예약한 글**(발행 실패 글 수). 빨간 동그라미, 99 넘으면 `99+`.
- 페이지마다 상단 **PageHeader**(제목 + 한 줄 설명 + 오른쪽 버튼 자리).

### 사이드바 메뉴 (이 순서, 이 이름)

| 묶음 | 메뉴 | 경로 | 아이콘(lucide) |
|---|---|---|---|
| 글 만들기 | 대시보드 | `/` | LayoutDashboard |
| | 글 작성 | `/compose` | PenSquare |
| | 계정 키우기 농장 | `/farm/growth` | Sprout |
| | 수익화 농장 | `/farm/monetize` | ShoppingBag |
| 글감·보관 | 글 창고 | `/pools` | Archive |
| | 보석함 | `/bookmarks` | Gem |
| | 자료실 | `/assets` | Images |
| 발행 관리 | 예약한 글 | `/scheduled` | CalendarClock |
| | 내가 올린 글 | `/published` | Send |
| | 활동 | `/activity` | Activity |
| (구분선) | 설정 | `/settings` | Settings |

### 공통 동작

- 시간은 DB에 UTC(`timestamptz`)로 저장하고 화면·입력은 모두 KST. 날짜 계산은 `"yyyy-MM-dd"` 문자열로 다룬다(부록 E `calendar.ts`).
- 서버 액션은 `{ ok: true, data } | { ok: false, error }` 형태로 돌려주고, 화면은 성공(초록)·실패(빨강) 한 줄 메시지를 보여 준다.
- 에러 문구는 한국어로. zod 검증 오류의 원본(영어·내부 경로)을 그대로 보여 주지 않는다(부록 E `errors.ts`).
- 각 페이지에 `error.tsx`(「화면을 불러오지 못했습니다」 + 다시 시도), `loading.tsx`(뼈대) 두기.
- 지우기·취소처럼 되돌릴 수 없는 동작은 `confirm`으로 한 번 묻는다.
- 휴대폰 폭(360px)에서도 가로 스크롤 없이 쓸 수 있게(표는 표 안에서만 가로 스크롤).

---

## 6. 데이터베이스

**부록 A의 SQL을 그대로 쓴다.** 저장소에 `supabase/migrations/0001_init.sql` ~ `0009_cleanup.sql`, `supabase/seed.sql`(부록 B), `supabase/cron.sql`(부록 C)로 나눠 저장한다. 실행 순서는 `0001` → `seed` → `0002` ~ `0009`.

규칙: enum은 `text + check`, 시간은 `timestamptz`, 모든 테이블 `updated_at` 자동 갱신 트리거 + RLS on(정책 없음). 테이블 26개.

| 테이블 | 내용 |
|---|---|
| `app_settings` | 키-값(jsonb) 설정. 활동 시간대, 금칙어, 하루 상한, 간격, 창고 빈 경우 동작, 팔로워 구간표, AI 기본 모델·단가·키 |
| `account_groups` | 계정 그룹(이름, 색) |
| `threads_accounts` | 연결 계정. 암호화 토큰, 만료·갱신 시각, 상태(active / needs_reconnect / disabled), 그룹, 하루 최대 게시 수, 팔로워 수 |
| `personas` | 계정별 페르소나(연령대, 성별, 직업, 말투) |
| `generators` | AI 생성기(이름·버전, 종류 daily/product/vision, 시스템 프롬프트, 사용자 프롬프트 템플릿, 회사·모델, 보석함 예시 수, 사용 여부) |
| `topics` / `post_formats` | 주제 풀(카테고리·주제·키워드·마지막 사용) / 글 형식(이름·지시문) |
| `disclosures` | 제휴 고지 문구(이름, 문구, 자동 매칭 도메인, 기본값 1개, 기본 위치) |
| `products` | 상품(이름, 제휴 링크, 고지 문구, 사진 `media` jsonb, 특징 메모, 사용 여부) |
| `asset_bundles` / `assets` | 자료실 묶음 / 묶음 안 파일 |
| `content_pools` / `pool_accounts` / `pool_items` / `pool_item_usage` | 글 창고 / 창고-계정 연결 / 창고 글(상태 pending·available·reserved·used·archived, 가중치, `compose` jsonb) / 사용 기록 |
| `campaigns` | 농장 캠페인(계정당 1행, 같은 농장은 `batch_id`로 묶음, `config` jsonb, 만들기 작업 `job_id`) |
| `posts` | 게시물. 상태 draft·review·scheduled·processing·published·failed·cancelled, 발행될 본문, 링크·고지 위치, 컨테이너·미디어 ID, 재시도 정보, 잠금, `compose`(작성 화면 원본), `ai_meta` |
| `post_media` / `post_replies` | 게시물 사진·영상(삭제 예정일) / 댓글(종류 user·link·disclosure, 사진 1개, 발행 상태) |
| `bookmarks` | 보석함(mine / reference) |
| `account_daily_stats` / `post_insights` | 계정 일별 통계(KST 날짜) / 게시물 인사이트 |
| `jobs` | 작업 큐(AI 일괄 생성, 농장 만들기) |
| `generation_logs` / `publish_logs` / `notifications` | AI 사용 기록(토큰·비용) / 발행 단계 기록 / 활동 알림 |

DB 함수:
- `claim_due_posts(limit, lease_seconds)`: 발행할 글을 `FOR UPDATE SKIP LOCKED`로 잠그고 `locked_until`(리스)을 건다. 대상: 예약 시간이 된 `scheduled`, 진행 중 `processing`, 댓글이 남은 `published`(`replies_pending`), 모두 `next_attempt_at`이 지난 것.
- `claim_jobs(limit, lease_seconds)`: 같은 방식으로 jobs를 잡는다.
- `list_stale_uploads(days, limit)`: Storage의 오래된 `uploads/` 파일 목록(정리 작업용).
- `call_cron(path, timeout_ms)`: Vault의 `app_url`, `cron_secret`으로 `/api/cron/<path>`를 POST(pg_net).

### Storage

- 버킷 `media`(public). 허용 형식 `image/jpeg`, `image/png`, `video/mp4`, `video/quicktime`.
- 폴더: `uploads/`(글 작성에서 올린 1회용 첨부 — 발행 30일 뒤 삭제), `assets/`(자료실·창고 글 사진 — 보관), `products/`(상품 사진 — 보관).

---

## 7. 외부 API 규칙

> 만들기 전에 공식 문서로 다시 확인한다. 아래는 2026-11 기준으로 확인한 내용이다.

### Threads API

- 인증 URL `https://threads.com/oauth/authorize`, Graph `https://graph.threads.com`, API `https://graph.threads.com/v1.0`.
- 권한(scope): `threads_basic`, `threads_content_publish`, `threads_manage_insights`, `threads_manage_replies`.
- 토큰: code → 단기 토큰(`POST /oauth/access_token`, 1시간) → 장기 토큰(`GET /access_token?grant_type=th_exchange_token`, 60일) → 갱신(`GET /refresh_access_token?grant_type=th_refresh_token`, 발급 24시간 뒤부터, 만료 전만). 비공개 프로필은 90일마다 재연결 필요.
- 콜백 URL 끝에 붙는 `#_`는 코드가 아니다(제거).
- 프로필: `GET /me?fields=id,username,name,threads_profile_picture_url`.
- 발행은 **컨테이너 방식**: `POST /{user-id}/threads`(media_type TEXT/IMAGE/VIDEO/CAROUSEL, text, image_url/video_url, is_carousel_item, children, reply_to_id, topic_tag, link_attachment, is_made_with_ai) → 상태 확인 `GET /{container-id}?fields=status,error_message`(IN_PROGRESS / FINISHED / ERROR / EXPIRED / PUBLISHED) → `POST /{user-id}/threads_publish?creation_id=` → `GET /{media-id}?fields=id,permalink,timestamp`.
- 캐러셀: 항목 컨테이너(`is_carousel_item=true`)를 모두 만들고 모두 FINISHED가 된 뒤 부모(`CAROUSEL`, `children=쉼표목록`)를 만든다. `is_made_with_ai`는 부모에만. 최대 20개.
- `link_attachment`(링크 미리보기 카드)는 **텍스트 글에서만** 동작한다. 글자만 있는 글·댓글은 Threads가 첫 링크를 카드로 만든다(끄는 옵션 없음) → 사진을 붙이면 카드 없이 링크만 보인다.
- 24시간 게시 한도: `GET /{user-id}/threads_publishing_limit?fields=quota_usage,config,reply_quota_usage,reply_config`.
- 글자 수: 500자. **이모지는 UTF-8 바이트 수로 센다**(부록 E `text.ts`). 본문 링크 최대 5개. 커뮤니티 주제(topic_tag)는 50자 이하, `.`과 `&` 금지.
- 영상: MP4/MOV, 5분 이하, 가로 1920px 이하 권장, 1GB 이하.
- 인사이트: 계정 `GET /{user-id}/threads_insights?metric=views,likes,replies,reposts,quotes,clicks&since=&until=`(계정 `views`는 **프로필 조회수**), `followers_count`는 기간 없이. 게시물 `GET /{media-id}/insights?metric=views,likes,replies,reposts,quotes,shares`. 응답 값은 `total_value.value` → `values` 합 → `link_total_values` 합 순서로 읽는다.
- 오류 형식 두 가지(`{error:{message,code,error_subcode,type,error_user_msg}}`, `{error_type,code,error_message}`)를 모두 처리. **code 190 또는 HTTP 401은 토큰 문제** → 계정을 `needs_reconnect`로 바꾸고 알림.
- 요청 타임아웃: GET 20초, POST 30초. 응답은 캐시하지 않는다.

### AI (OpenAI / Gemini)

- 회사별 구현을 `lib/ai/providers/{openai,gemini}.ts`에 두고, 앱 코드는 공통 인터페이스만 쓴다:
  `generateJson({ model, system, prompt, images?, schemaName, schema }) → { text, usage{input,output,cached,reasoning}, model }`, `listModels()`, `checkModel(model)`(짧은 시험 호출).
- **OpenAI**: Responses API, `instructions`=system, 사진은 `input_image`(URL), `text.format = json_schema(strict)`. 타임아웃 90초, 재시도 1회.
- **Gemini**: `models.generateContent`, `systemInstruction`, `responseMimeType: application/json`, `responseJsonSchema`(OpenAI용 `additionalProperties`는 빼고 보냄). 사진은 서버에서 내려받아 inline base64로. 모델 목록은 **Gemini 3 버전 이상만**, 최신 순. 사용량의 생각(thinking) 토큰은 출력으로 계산.
- 오류는 한국어로 바꾼다: 키 오류(401/403) → 「키가 올바르지 않습니다」, 429 → 「사용 한도 초과 또는 잔액 부족」, 404 → 「모델을 찾을 수 없습니다」.
- 키 우선순위: 설정 > AI에서 등록한 키(암호화, `app_settings.ai_keys`) → 환경변수.
- 단가는 사용자가 **1M 토큰당 USD를 직접 입력**(입력·캐시 입력·출력). 비어 있으면 비용 계산 안 함.

---

## 8. 마일스톤

각 마일스톤 끝의 **완료 기준**을 모두 통과해야 다음으로 간다.

### M1. 프로젝트 기반, 디자인, 로그인, DB

**만들 것**
- Next.js 15 프로젝트, Tailwind 4, Pretendard, 디자인 토큰, `components/ui`, 사이드바·앱 셸·PageHeader(5장).
- 모든 메뉴의 빈 페이지(제목·설명만).
- `/login`: 비밀번호 한 칸 + 「로그인」. 틀리면 「비밀번호가 맞지 않습니다」. 성공하면 `next` 또는 `/`로. 로그아웃은 쿠키 삭제.
- `middleware.ts`, `lib/auth/session.ts`, `lib/auth/require.ts`, `lib/env.ts`, `lib/db/admin.ts`(service role, `server-only`).
- `supabase/migrations/0001_init.sql`~`0009_cleanup.sql`, `seed.sql`, `cron.sql`을 부록 그대로 저장(이번 단계에서 사용자는 `0001` + `seed`만 실행해도 되고, 전부 실행해도 된다).
- `.env.example`(부록 D), README 초안.

**사용자가 할 일**
1. Supabase 새 프로젝트(Seoul) → SQL Editor에서 `0001_init.sql` → `seed.sql` → `0002`~`0009` 순서로 Run.
2. Project Settings → API에서 URL, anon 키, service_role 키 복사.
3. (로컬에서 확인할 수 있으면) `.env.local`을 만들어 값 입력 후 `npm install` → `npm run dev`. 로컬이 어려우면 M2의 Vercel 배포 뒤 확인해도 된다.

**완료 기준**: 로그인 화면 → 비밀번호로 로그인 → 사이드바와 빈 페이지들이 보인다. Supabase Table Editor에 테이블 26개, Storage에 `media` 버킷.

### M2. Threads 계정 연결, 토큰 관리, 테스트 발행

**만들 것**
- `lib/threads/client.ts`(7장의 모든 호출), `lib/crypto/token.ts`, `lib/threads/accounts.ts`, `lib/notify`.
- `/api/threads/oauth/start`(state 쿠키 → 인증 창), `/api/threads/oauth/callback`(state 확인 → code 교환 → 장기 토큰 → `/me` → 저장 → `/settings?connected=이름`). 실패하면 어느 단계에서 실패했는지(「연결 실패(장기 토큰 교환): …」)를 `/settings?error=`로.
- 같은 `threads_user_id`면 갱신(재연결), 새 계정이면 추가(최대 50개, 기본 하루 최대 게시 수는 설정값).
- `/api/cron/refresh-tokens`: 만료 7일 이내이고 마지막 갱신 24시간 지난 토큰 갱신. 이미 만료·갱신 실패면 `needs_reconnect` + 알림.
- **설정 > 계정** 탭:
  - 「Threads 계정」 표: 프로필 사진, @이름, 상태 배지(정상 / 재연결 필요 / 해제됨 / 토큰 없음), 토큰 만료일(「N일 남음」), 그룹 선택, 하루 최대 게시 수, 「재연결」(해제된 계정은 「다시 연결」), 「해제」(「@이름 계정 연결을 해제할까요? 예약된 글은 모두 취소됩니다.」), 「지금 발행」(테스트 글, 기본 문구 「AUTO THREAD 연결 테스트 글입니다.」, 최대 30초 대기). 위에 「계정 연결」 버튼.
  - 「페르소나」: 계정마다 연령대(20대/30대/40대 초반/40대 후반/무관), 성별(남자/여자/무관), 직업(직장인/자영업/사업/주부/무관), 말투(자유 입력, 예 「다정한 반말, 이모지 가끔, 짧은 문장」) → 「이 계정에 저장」.
  - 「계정 그룹」: 이름·색 추가/수정/삭제(대시보드 필터용).
  - 「테스터 초대 안내」: Meta 앱에서 테스터 초대 → 각 계정에서 수락하는 방법.
- 테스트 발행: 텍스트 컨테이너 → 최대 20초 FINISHED 대기 → 발행 → permalink → `posts`에 기록 + 활동 알림. 24시간 한도를 먼저 확인.

**사용자가 할 일**
1. GitHub에 push된 코드를 **Vercel → Add New → Project**로 Import → 환경변수(4장 표에서 Threads 값 제외) 입력 → Deploy → 배포 주소 기록.
2. Meta 개발자 앱 만들기(「12. README에 들어갈 내용 → Threads 앱 설정」의 순서): 사용 사례 「Threads API 액세스」, 권한 4개, 리디렉션 콜백 URL `https://<배포주소>/api/threads/oauth/callback`, 연결할 계정을 Threads 테스터로 초대 후 각 계정에서 수락.
3. Vercel 환경변수에 `THREADS_APP_ID`, `THREADS_APP_SECRET`(이름에 **Threads**가 붙은 쪽), `THREADS_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` 추가 → Redeploy.
4. `TOKEN_ENCRYPTION_KEY`를 비밀번호 관리자 등에 **따로 백업**.

**완료 기준**: 설정 → 계정 → 계정 연결 → 계정이 표에 나온다 → 「지금 발행」 → Threads에 글이 올라가고 활동에 알림이 남는다.

### M3. 글 작성, 미디어, 예약, 자동 발행

**글 작성 `/compose`** — 3단계 + 오른쪽 미리보기(모바일은 하단 「편집 / 미리보기」 탭).

1. **설정**: 계정 선택(재연결 필요 계정은 고를 수 없음 표시, 선택한 계정의 페르소나 요약 표시) → 글 종류(일반 / 상품 홍보) → 작성 방법(직접 작성 / AI로 만들기(M5) / 글 창고에서 가져오기(M6)).
2. **작성**:
   - 본문(placeholder 「무슨 이야기를 나누고 싶으세요?」), 글자 수(`N/500`, 「이모지는 Threads 규칙대로 UTF-8 바이트 수(보통 4자)로 셉니다.」).
   - 사진·영상 붙이기(최대 20개, 끌어서 순서 변경, 2개 이상이면 캐러셀, 「자료실에서 고르기」(M7)).
   - 댓글 여러 개(최대 10개, 「댓글은 본문 아래에 순서대로 이어서(스레드 형태로) 달립니다.」, 댓글마다 사진·영상 1개), 「첫 댓글에 본문 첫 사진 붙이기」(상품 홍보글은 기본 켜짐).
   - 링크 URL + 위치(본문 / 첫 댓글). 사진·영상이 있으면 링크는 자동으로 첫 댓글(「사진·영상이 있으면 링크 미리보기가 동작하지 않아 첫 댓글에 넣습니다.」).
   - 제휴 고지 문구 선택 + 위치(본문 끝 / 링크 댓글 / 별도 댓글). 링크 도메인이 고지 문구의 매칭 도메인과 맞으면 자동 선택. 상품 홍보글은 기본 고지 문구 자동 선택, 위치는 항상 **첫 댓글 맨 앞**.
   - 커뮤니티 주제(예 「살림템」, # 없이 50자 이하), AI 표시 체크(「Threads에 'AI 정보' 라벨이 붙습니다」).
   - 검사 결과 목록(오류는 빨강, 경고는 주황). 최근 이 계정 글과 50% 이상 비슷하면 경고.
3. **발행**: 「지금 발행」 또는 「예약하기」(발행 일시 KST). 예약 시간을 고르면 바로 **겹침 검사**: 같은 계정 최소 간격(기본 60분)·계정 간 최소 간격(기본 3분) 안의 다른 예약, 계정 하루 상한·전역 하루 상한, 활동 시간대 밖 여부. 겹치면 「가까운 빈 시간으로」 / 「그대로」. 「임시 저장」. 완료 화면 「○월 ○일 HH:mm(KST)에 @이름 계정으로 발행됩니다.」 + 「예약한 글 보기」 / 「새 글 쓰기」.
   - 지난 시간으로는 예약할 수 없다. 「지금 발행」은 1분 안에 발행된다(지금 시각으로 예약).
- 이미 예약된 글을 `/compose?id=`로 열면 「예약된 글 수정 중」 표시, 저장하면 같은 글을 고친다. 발행 중·발행된 글은 수정 불가.

**발행 형태 변환** — `lib/compose/plan.ts`(부록 E, 화면과 서버가 같은 함수 사용):
- 링크 위치 `body`면 본문 끝에 링크, 텍스트 글이면 `link_attachment`도 설정. `first_reply`면 첫 댓글 끝에 붙이거나(댓글이 없으면 링크만 있는 댓글을 만든다).
- 고지 문구: 상품 홍보글은 `고지 문구 + 첫 댓글 내용(+ 링크)`. 일반 글은 고른 위치에(링크 댓글이 없으면 본문 또는 별도 댓글로 대체).
- 검사: 본문 비었음, 500자 초과(링크·고지 포함), 댓글 500자 초과, 링크 5개 초과, 주제 형식 → **오류**. 글자만 있는 링크 댓글(카드가 붙음), 상품글인데 고지 없음, 링크가 있는데 고지 없음, 금칙어 → **경고**.
- 저장(`lib/compose/save.ts`): 작성 원본은 `posts.compose`에, 발행될 본문·댓글은 `posts.text`·`post_replies`에 저장. 예약은 오류가 있으면 거부. 미디어·댓글은 통째로 교체.

**미디어 업로드**
- 브라우저에서 정리 후 업로드(`lib/media/prepare.ts`): HEIC·WebP 등은 JPEG로, 가로 1440px 이하, 8MB 이하(품질 0.9 → 0.45 단계적으로). 투명 PNG는 흰 배경. 이미 JPEG/PNG이고 규격 안이면 원본 그대로. 영상은 MP4/MOV만, 1GB 이하, 5분·1920px 초과·50MB 초과(Supabase Free)는 경고.
- `POST /api/upload`: `{ folder: uploads|assets|products, files[{name, contentType, size}] }` → 파일마다 `폴더/uuid/안전한이름.확장자`의 signed upload URL + public URL. 이미지 8MB, 영상 1GB 제한.
- 브라우저는 anon 키 Supabase 클라이언트의 `uploadToSignedUrl`로 직접 올린다.

**발행 상태 머신** — `/api/cron/publish`(1분마다, 48초 안에 끝냄) → `lib/publisher` (부록 E에 핵심 규칙):
1. `claim_due_posts(10, 120)`으로 잠근 글을 하나씩 처리. 끝나면 잠금 해제.
2. 계정이 active가 아니면 바로 실패.
3. `scheduled` → `processing`. 컨테이너가 없으면 만든다(텍스트/사진/영상/캐러셀).
4. 컨테이너 상태: IN_PROGRESS면 30초 뒤 다시(20분 넘으면 컨테이너 초기화 후 재시도), ERROR/EXPIRED면 초기화 후 재시도, PUBLISHED면 중복 발행 방지를 위해 중단(실패).
5. **같은 실행에서 본문 발행은 1개만**. 나머지는 30~120초씩 누적해서 뒤로 미룬다.
6. 24시간 한도에 닿았으면 30분 뒤 다시.
7. 발행 → permalink 저장 → `published`. `uploads/` 첨부는 `delete_after = 30일 뒤`. 창고 글이면 사용 기록. 활동 알림.
8. 댓글: 바로 앞 댓글(첫 댓글은 본문)에 `reply_to_id`로 달아 스레드 형태. 사진 댓글은 처리 대기. 시간이 모자라면 다음 실행에서 이어서(`replies_pending`).
9. 실패: 1분 → 5분 뒤 재시도, **3번째 실패면 `failed`** + 활동 알림(링크 `/scheduled?post=`). 토큰 오류·Fatal은 바로 실패 + 재연결 필요. 댓글 단계 실패는 본문은 둔 채 댓글만 실패 처리.
10. 모든 단계는 `publish_logs`에 기록.

**완료 기준**: 사진 2장 + 링크 + 고지 문구 + 댓글 1개인 글을 5분 뒤로 예약 → 시간에 맞춰 캐러셀로 올라가고, 첫 댓글에 링크·고지 문구가 달린다. (이때 `cron.sql`을 실행해야 한다 — 「사용자가 할 일」로 안내.)

**사용자가 할 일**: Supabase → Database → Extensions에서 `pg_cron`, `pg_net` 켜기 → `cron.sql`의 `<APP_URL>`, `<CRON_SECRET>`을 바꿔 Run → `select jobname, schedule, active from cron.job;`으로 확인.

### M4. 예약한 글, 내가 올린 글, 활동

- **예약한 글 `/scheduled`**: 보기 전환 목록 / 월 / 주(일요일 시작, 이전·다음), 계정 필터(「모든 계정」), 상태 필터(Chip). 글을 누르면 오른쪽(모바일은 아래) 상세 패널: 본문·댓글·사진 미리보기, 상태, 실패 이유, 발행 기록, 버튼 「시간 변경」, 「수정」(→ `/compose?id=`), 「예약 취소」, 「재시도」, 「삭제」.
  - 최소 간격 안에 겹친 예약은 주황색 표시(「다른 예약과 너무 가깝습니다.」).
  - 시간 변경이 겹치면 「가까운 빈 시간으로」 / 「그대로 변경」.
  - 재시도: 본문 실패면 처음부터(원래 시간이 지났으면 바로), 댓글만 실패면 남은 댓글만(「댓글 다시 올리기」).
  - 예약 취소하면 창고 글은 창고로 되돌린다. 발행 중인 글은 수정·취소 불가.
  - `?post=<id>`로 들어오면 그 글을 바로 연다. `?status=failed` 등 필터도 주소로.
- **내가 올린 글 `/published`**: 발행된 글 목록(최신순), 계정 필터, 조회수·좋아요·댓글·리포스트(M8에서 채워짐, 「조회수·좋아요·댓글 수는 통계 수집(3시간마다)이 돌면 채워집니다.」), 「Threads에서 보기」, ★「보석함에 저장」/「보석함에서 빼기」(저장 당시 성과도 함께 저장).
- **활동 `/activity`**: 알림 목록, 필터(읽지 않음, 종류, 수준 정보/경고/오류), 누르면 읽음 처리 후 `link`로 이동, 「모두 읽음」.
- 사이드바 배지(5장).

**완료 기준**: 예약 글을 달력에서 보고 시간 변경·취소·삭제가 된다. 일부러 실패시킨 글(예: 재연결 필요 계정)이 실패로 보이고 활동에 알림이 뜨며 재시도할 수 있다.

### M5. AI 글 생성

- **설정 > AI** 탭:
  - 「API 키」: OpenAI / Gemini 각각 붙여넣기 → 저장하면 모델 목록을 불러와 키를 확인한 뒤 암호화 저장. 화면에는 끝 4자리와 출처(설정 / 환경변수). 삭제.
  - 「기본 모델」: 글쓰기용, 사진 이해용(수익화 농장). 회사 선택 → 그 회사 모델 목록에서 선택(없으면 「직접 입력」). **저장 전에 `checkModel`로 시험 호출**하고 안 되면 저장하지 않고 이유 표시.
  - 「모델 단가」: 쓰는 모델마다 1M 토큰당 USD(입력 / 출력 / 캐시 입력 — 비우면 입력 단가) 직접 입력. 비용 = (입력−캐시)×입력단가 + 캐시×캐시단가 + 출력×출력단가.
  - 「이번 달 AI 비용」(KST 이번 달, 모델별 합계·호출 수, 단가 기준 추정치).
  - 「AI 생성기」: 추가·수정·복제(새 버전)·삭제·사용 여부. 항목: 이름, 종류(일상글 daily / 상품글 product / 사진 보고 쓰기 vision), 시스템 프롬프트, 사용자 프롬프트 템플릿, 회사·모델(비우면 기본 모델), 보석함 예시 수(0~10). 모델 저장 때도 시험 호출.
- **설정 > 주제·형식** 탭: 주제 풀(카테고리·주제·키워드, 여러 줄 붙여넣기로 일괄 추가 `카테고리 | 주제 | 키워드1, 키워드2`, 검색, 삭제), 글 형식(이름·지시문·사용 여부).
- **프롬프트 조립**(부록 E `prompt.ts`): system = 생성기 시스템 프롬프트 + 공통 규칙. user = 템플릿에 `{{count}} {{persona}} {{topic}} {{format}} {{length}} {{examples}} {{recent_posts}}` 채움.
  - 주제: 사용자가 주면 그것, 없으면 최근에 안 쓴 주제 중 랜덤(5개 이상 만들 때는 여러 주제를 주고 글마다 다르게). 쓴 주제는 `last_used_at` 갱신.
  - 형식: 사용 중인 글 형식에서 랜덤. 길이: 짧게(1~3문장, 120자 안팎) / 보통(150~250자) / 길게(300~450자) 랜덤.
  - 예시: 보석함에서 생성기의 예시 수만큼 랜덤. 최근 글: 이 계정의 최근 15개(겹치지 말라고).
  - 사진이 있으면 「첨부한 사진 속 상품의 생김새·색·크기감·쓰임새를 보고 구체적으로 반영해 주세요. 사진에 없는 기능은 지어내지 마세요.」 추가.
- 출력은 **JSON 스키마 강제**: `{ posts: [{ text, first_reply, topic_tag, category }] }`.
- **검사**(부록 E `validate`): 빈 본문, 500자 초과, 첫 댓글 500자 초과, 해시태그, 금칙어, 최근 글과 유사(2-gram 자카드 0.5 이상), 같이 만든 글끼리 유사. **검사에 떨어진 글만 이유를 알려 주고 한 번 더** 만든다. 그래도 남은 문제는 후보에 경고로 표시.
- 호출마다 `generation_logs`(회사·모델·용도 compose/pool/farm·토큰·비용). 실패하면 활동에 「AI 글 생성 실패(회사:모델): 이유」.
- **글 작성 연결**: 1단계 「AI로 만들기」 → 생성기 선택(기본: 첫 번째 사용 중인 생성기), 주제(「비우면 주제 풀에서 랜덤」; 상품 홍보면 「상품명·특징」). 2단계 「AI 후보」 패널: 「한 번에 만들 개수」 1~5 → 「글 만들기」(최대 1분) → 후보 카드(본문, 첫 댓글, 글자 수, 형식, 모델·주제, 비용 또는 「단가 미입력」, 경고) → 「적용」(본문·첫 댓글·주제가 채워짐) / 「다른 글 만들기」 / 「후보 지우기」. 사진이 붙어 있으면 「첨부한 사진을 AI에게 보여 주고 쓰기」 옵션(사진 이해 모델).
- 기본 생성기 2개(「일상 주제글 메이커」, 「상품 홍보글 메이커」), 글 형식 5개, 주제 50개가 seed에 들어 있다(부록 A·B).
- AI 키가 없거나 기본 모델을 안 골랐으면 글 작성 화면에 안내(「AI 키가 없습니다. 설정 > AI에서 OpenAI 또는 Gemini 키를 등록하세요.」).

**사용자가 할 일**: OpenAI(https://platform.openai.com/api-keys) 또는 Gemini(https://aistudio.google.com/apikey) 키 발급 → 앱의 설정 → AI에 등록 → 기본 모델 선택·저장 → 단가 입력.

**완료 기준**: 글 작성에서 AI 후보 3개가 만들어지고 적용·예약된다. 설정 → AI에 이번 달 비용이 보인다.

### M6. 글 창고

- **`/pools`**: 창고 카드 목록(이름, 설명, 연결 계정 수, 「남은 글 N개 · 약 N일 분량」 — 기준 일수보다 적으면 주황색, 검수 대기 수). 카드 ⋯ 메뉴 「삭제」. 「창고 만들기」.
  - 하루 소비량 = 이 창고를 쓰는 진행 중 캠페인의 하루 게시 수 합 → 없으면 최근 7일 평균 사용량 → 없으면 연결 계정 수(하루 1개).
- **창고 설정**(만들기·수정 공통): 이름(예 「30대 직장인 일상글」), 설명, 연결 계정(「이 계정들이 이 창고의 글을 씁니다」), 페르소나 필터(연령·성별·직업, 「안 함」 가능), 재고 부족 기준(일, 기본 3), 재사용 금지 기간(일, 「비우면 재사용 안 함」), 자동 보충 + 생성기.
- **`/pools/[id]`**: 재고 요약, 창고 설정, **글 채우기 4가지**, 글 목록.
  - **AI 일괄 생성**: 생성기, 주제(「비우면 주제 풀에서 여러 개를 랜덤으로」), 개수(최대 20), 「바로 사용 가능으로」 옵션 → jobs 큐(`pool_fill`)에 넣고 진행률 표시(화면을 떠나도 계속). 창고 페르소나 필터를 페르소나로, 창고의 최근 글 40개를 겹치지 말 글로. **검사 통과 글만** 넣는다(모자라면 활동에 「N개 중 M개만 통과」).
  - **직접 작성**: `/pools/[id]/items/new`(수정 `/pools/[id]/items/[itemId]`) — 글 작성 2단계와 **같은 편집 화면**(사진·영상, 댓글 여러 개·댓글 사진, 링크, 고지 문구, 커뮤니티 주제, AI 표시, 모바일 미리보기). 사진은 `assets/`에 올려 자동 삭제되지 않게. 내용은 `pool_items.compose`에 저장(부록 E `poolContentSchema`).
  - **CSV 가져오기**: 첫 줄 열 이름 `text`(필수), `first_reply`, `topic_tag`, `category`, `images`(본문 사진 파일 이름, 최대 5장, `|` 구분), `reply_image`(첫 댓글 사진 1장). CSV와 함께 사진 파일들을 고르면 **파일 이름으로 짝지어**(대소문자·경로 무시) 브라우저에서 변환·업로드(`assets/`). 없는 파일·5장 초과 줄은 미리보기에서 알려 주고 빼고 가져온다. 「예시 CSV 내려받기」. 엑셀은 「CSV UTF-8」로 저장하라고 안내. 따옴표·줄바꿈이 들어간 칸을 제대로 읽는 CSV 파서.
  - **보석함에서 옮기기**.
  - 글 목록: 상태 필터(전체 / 검수 대기 / 사용 가능 / 예약됨 / 사용 완료 / 보관), 본문 검색, 페이지 나눔, **「이 페이지 전체 선택」** + 개별 선택 → 「승인」(사용 가능으로) / 「보관」 / 「검수 대기로」 / 「삭제」(배정·사용된 글은 건드리지 않음). 글을 펼쳐 수정. 출처 배지(AI / 직접 / CSV / 보석함).
- **랜덤 선택 규칙**(부록 E `select.ts`, 단위 테스트 필수):
  - 후보: 계정에 연결된 창고의 `available` 글 중 창고 페르소나 필터가 계정 페르소나와 맞고(계정이 「무관」이면 통과), 글의 `persona_tags`도 맞는 것.
  - 제외: 다른 계정이 이미 쓴 글(글 하나는 계정 하나에만), 재사용 금지 기간 안의 글(기간이 비어 있으면 한 번 쓴 글은 다시 안 씀), **이 계정 직전 창고 글과 같은 category**.
  - weight 가중 랜덤. 배정은 **「지금도 available일 때만 reserved로」 조건부 업데이트**(동시에 같은 글을 두 곳에 주지 않음, 실패하면 다음 후보, 최대 5번).
  - 발행되면 사용 기록, 재사용 금지 기간이 없으면 `used`, 있으면 다시 `available`. 예약을 취소하면 창고로 돌아간다.
  - 맞는 글이 없으면 설정 「글 창고에 맞는 글이 없을 때」에 따라 **건너뛰기**(알림만) 또는 **AI 즉석 생성**(그 계정용 1개를 만들어 창고에 넣고 바로 배정, 알림). 
- **글 작성 연결**: 1단계 「글 창고에서 가져오기」(창고 선택 또는 「연결된 창고 전체에서」) → 2단계 「랜덤으로 뽑기」 / 「다른 글 뽑기」(앞 글은 배정 해제). 창고 글의 전체 내용(사진·댓글·링크·고지 등)이 들어간다.
- 창고 삭제: 이 창고 글로 예약된 게시물이 있으면 막는다(「이 창고와 안의 글을 모두 삭제할까요? 되돌릴 수 없습니다.」).
- **jobs 큐**(`lib/jobs`): `enqueueJob(type, payload, total)`, `/api/cron/jobs`(1분마다, 최대 280초)가 `claim_jobs(2, 300)`으로 처리. 처리기가 `JobContinue`를 돌려주면 실패로 세지 않고 다음 실행에서 이어서. 실패는 2분×횟수 뒤 재시도, 3번 실패하면 `failed` + 알림. 작업을 만든 직후에도 `after()`로 한 번 바로 돌린다.
- **`/api/cron/pool-maintenance`**(매일 02:00): 48시간 넘게 배정만 되고 쓰이지 않은 글 되돌리기(진행 중인 글이 없을 때만), 재고 부족 알림, 자동 보충(생성기로 20개, 바로 사용 가능, 이미 진행 중인 보충 작업이 있으면 건너뜀).

**완료 기준**: 창고를 만들어 AI로 5개 채우기 → 진행률이 끝까지 가고 글이 검수 대기로 들어온다 → 전체 선택 → 승인 → 글 작성에서 「글 창고에서 가져오기」로 뽑아 예약 → 발행 후 창고 글이 사용 완료가 된다. CSV(사진 포함) 가져오기가 된다.

### M7. 자료실, 계정 키우기 농장, 수익화 농장

**자료실 `/assets`**
- 묶음(이름 예 「무선 청소기 상세컷」, 카테고리 예 「가전, 뷰티」, 메모 「상품 특징 — 글로 만들 때 AI가 참고」) 카드 목록, 이름 검색, 카테고리 필터. 묶음 안 사진·영상 추가(`assets/`, 자동 삭제 없음)·삭제·순서. 「묶음 삭제」.
- 묶음의 「글로 만들기」 → 글 작성이 **사진이 붙은 상태·AI 모드·상품 홍보**로 열리고 주제 칸에 `묶음 이름 + 특징: 메모`.
- 「자료실에서 고르기」 창: 글 작성·창고 글 편집·상품 등록에서 묶음을 골라 사진을 붙인다.

**상품**(수익화 농장 화면의 「상품」 영역): 사진(`products/`), 상품명, 제휴 링크(URL 검사), 고지 문구(비우면 기본), 특징 메모, 사용 여부. 추가·수정·삭제.

**농장 만들기 폼**(`/farm/growth`, `/farm/monetize` 공통, 위쪽에 폼 · 아래쪽에 지난 농장 목록)
- 계정 표: 선택 체크(머리글에 **전체 선택**), @이름, 팔로워 수, **하루 일상글 수**(팔로워 구간표로 추천값 미리 채움; 수익화 농장은 추천−1), 수익화 농장은 **하루 상품글 수**(기본 1). 하루 최대 게시 수를 넘거나 같은 계정 간격을 지킬 수 없는 수면 경고. 「추천 값은 설정 > 글 설정의 팔로워 구간표를 따릅니다(팔로워 수는 통계 수집 후 채워짐).」
- **시작일**: 기본 **오늘**, **오늘부터** 고를 수 있다. 오늘을 고르면 「오늘은 지금부터 10분 뒤 ~ 활동 시간 끝 사이에 나눠 올립니다.」 안내. 서버도 오늘 이전 날짜를 거부.
- 기간(1~30일), 활동 시간대(설정의 기본값, 시작 < 끝).
- 글 출처(키우기·수익화의 일상글): **AI 새로 생성**(생성기 선택) / **글 창고 랜덤**(창고 선택 — 선택한 계정에 연결된 창고만; 배정 시점 **미리 배정**(「지금 창고에서 글을 뽑아 각 시간에 넣습니다(검토 모드면 미리 확인 가능).」) / **발행 직전 뽑기**(「시간만 잡아 두고, 발행할 때 그때그때 창고에서 뽑습니다(창고를 계속 채우는 경우에 좋음).」)).
- 수익화 농장: 쓸 상품 선택(Chip, 여러 개), 상품글 생성기, 「상품 사진을 AI에게 보여 주고 쓰기」.
- AI 표시, 진행 방식 **검토 모드**(「만든 글을 목록에서 확인·수정한 뒤 「예약 확정」을 눌러야 발행됩니다.」) / **자동 모드**(「만든 글을 바로 예약합니다. 검사에 걸린 글만 검토 대기로 남습니다.」).
- 요약 「계정 N개 · N일 · 총 약 N개 글」 → 「N개 글 만들기 시작」 → 농장 상세로 이동.
- 저장: 계정마다 `campaigns` 1행(같은 `batch_id`, `config`에 부록 E `FarmConfig`, `phase: "slots"`) + jobs `farm_build`.

**농장 만들기 작업**(`farm_build`, 시간이 모자라면 다음 실행에서 이어서)
1. **시간 배치**(부록 E `slots.ts`, 단위 테스트 필수): 날짜마다 활동 시간대를 하루 게시 수로 균등 분할, 각 칸에 ±(간격의 30%, 최대 20분) 랜덤, 1분 단위. **시작일이 오늘이면 지금+10분 이후의 남은 시간대만 나눠 쓴다**(남은 시간이 없으면 그날 몫은 「이미 지난 시간」으로 건너뜀). 같은 계정 최소 간격, 계정 간 최소 간격, 계정 하루 상한, 전역 하루 상한, 이미 잡힌 예약(scheduled·processing·review·published)을 모두 지킨다. 지킬 수 없는 자리는 건너뛰고 개수를 기록 → 「간격 규칙·하루 상한 때문에 N개 자리는 만들지 못했습니다.」 각 자리는 `posts`에 `draft` + 빈 본문 + `ai_meta.farm`(종류, 상품)으로 먼저 만든다. 수익화는 계정·날짜마다 상품글/일상글을 섞고 상품은 시간순으로 돌아가며 배정.
2. **내용 채우기**: (계정, 종류, 상품)별로 묶어서
   - AI: 20개씩 생성, 검사에 큰 문제(초과·금칙어·해시태그·빈 본문)가 있는 글은 버리고 모자라면 다음 실행에서 다시. 상품글은 `kind: product`, 본문 사진 = 상품 사진, 첫 댓글 = AI 첫 댓글, **링크 = 제휴 링크(첫 댓글), 고지 문구 = 상품 고지 또는 기본** — 링크와 고지 문구는 AI가 아니라 서버가 붙인다. 첫 댓글에 본문 첫 사진(카드 없이 링크만). 비슷함 경고만 있는 글은 쓰고 경고를 남긴다.
   - 창고 미리 배정: 규칙대로 뽑아 내용 채움(없으면 그 자리 `cancelled` + 이유).
   - 창고 발행 직전 뽑기: 내용 없이 상태만 정하고 `pickAtPublish: true`. 발행 작업이 발행할 때 뽑아 채운다(부록 E `at-publish`, 없으면 그 글 취소).
   - 상태: 검토 모드 → `review`, 자동 모드 → `scheduled`(저장 검사에 걸리면 `review` + 이유).
3. 끝나면 `phase: "done"`, 결과(글 수, 건너뛴 자리).

**농장 상세 `/farm/batch/[id]`**
- 만드는 중이면 진행률 카드(「글을 만드는 중입니다 (N/M)」, 「이 화면을 떠나도 계속됩니다(1분마다 이어서 처리).」), 3초마다 새로고침. 실패면 이유.
- 상태별 Chip 필터(전체 / 검토 대기 / 예약 / 발행됨 / 실패 / 취소 + 개수).
- 글 목록: 날짜·시간, @계정, 상태 배지, 「상품」 배지, 사진·댓글 수, 본문 3줄(발행 직전 뽑기는 「발행할 때 창고에서 뽑습니다」), 검사 경고, 오류, ✎ 수정(→ 글 작성), Threads 링크.
- **선택**: 목록 맨 위 **「전체 선택」 체크박스**(선택 가능한 글 = 검토 대기·예약·실패·만드는 중을 한 번에 선택/해제, 일부만 선택되면 「–」 표시, 「N개 선택」과 「(선택 가능한 글 N개)」 표시) + 글마다 체크박스.
- 버튼: **「선택한 N개 예약 확정」 / 선택이 없으면 「검토 대기 전체 예약 확정」**(검토 대기 중 시간이 아직 안 지난 글만 `scheduled`로, 지난 글 수는 「이미 시간이 지난 N개는 남겨 둠」), **「선택한 N개 취소」 / 「농장 취소」**(발행 전 글 모두 취소 + 창고 글 되돌림 + 만들기 작업 중단, 농장은 「취소됨」으로 남음).
- 「농장 삭제」(목록의 🗑 또는 상세): 만들기 작업 중단 → 발행 안 된 글 삭제(창고 글 되돌림) → 발행된 글은 남기고 농장 연결만 끊음 → 캠페인·작업 삭제. 발행 중인 글이 있으면 막는다(「1~2분 뒤 다시 시도하세요」).
- 검토 모드 안내: 「검토 대기 글은 발행되지 않습니다. 확인하고 고칠 글은 ✎로 글 작성 화면에서 수정한 뒤, 위의 「예약 확정」을 누르세요. 글 작성에서 「예약하기」로 저장해도 그 글은 예약됩니다.」

**지난 농장 목록**: 농장마다 시작일·기간, 계정들, 검토/자동 모드 배지, 상태별 개수, 🗑.

**설정 > 글 설정 > 팔로워 구간표**: 팔로워 구간(최소~최대, 최대 비우면 상한 없음)별 권장 하루 게시 수 편집.

**완료 기준**: 계정 2개로 **오늘 시작** 3일 키우기 농장(AI, 검토 모드) → 진행률 완료 → 오늘 남은 시간과 이후 날짜에 글이 고르게 배치 → 한두 개 확인 후 **전체 선택 → 예약 확정** → 시간에 맞춰 발행. 상품 1개로 수익화 농장(사진 보고 쓰기) → 상품글 첫 댓글이 「고지 문구 + 댓글 + 링크」, 사진이 붙어 카드 없이 링크만.

### M8. 통계와 대시보드

- **`/api/cron/sync-stats`**(매일 00:10 + 3시간마다 :40, 50초 안에): 통계를 **DB에만** 저장. 대시보드는 DB만 읽는다(화면에서 실시간 API 호출 없음).
  - 계정(active만, 동시에 4개씩, 25초까지): 어제(KST 00:00~00:00)·오늘(00:00~지금) 조회·좋아요·댓글·리포스트·인용·클릭, 팔로워 수(오늘 행에, 어제 행은 비어 있을 때만 채움), 프로필 사진·이름 갱신. 토큰 오류면 재연결 필요.
  - 게시물(동시에 5개씩, 48초까지): 최근 30일 발행 글 중 **오래 갱신 안 된 순서로 최대 150개** 인사이트 upsert.
- **대시보드 `/`**(「계정 현황과 발행 성과를 한눈에 봅니다. 통계는 3시간마다 모아 둔 값입니다.」)
  - 요약 카드 4개: 연결된 계정 / 오늘 발행된 글 / 예약된 글 / 총 작성된 글(누르면 해당 목록).
  - 운영 카드(0이 아닐 때 강조): 발행 실패 / 재연결 필요 / 창고 재고 부족 → 해당 화면.
  - 「계정별 팔로워 추이」: 선 그래프, 7/14/30일, 처음엔 팔로워 많은 순 8개, 계정을 눌러 최대 8개 선택, **색은 계정을 따라감**(선택이 바뀌어도 남은 계정 색 유지).
  - 「계정별 반응 지표」: 조회수/댓글수/좋아요수 전환, 7/14/30일 합계 막대.
  - 계정 표: 모든 열 정렬, 「계정 검색」, 그룹·상태 필터, 기간 오늘/어제/7일/14일/30일, 50개씩. 열: 계정, 그룹, 상태, 팔로워(증감), 조회수, 좋아요수, 댓글수, 마지막 갱신. 행을 누르면 오른쪽 패널: 팔로워 추이(30일), 최근 게시물 성과, 예약된 글(검토 대기·발행 직전 뽑기 표시).
  - 「조회수는 Threads 기준 프로필 조회수입니다.」 안내.
  - 차트 색: 색약 구분이 검증된 범주형 팔레트를 고정 순서로`#2A78D6, #EB6834, #1BAF7A, #EDA100, #E87BA4, #008300, #6250D6, #E34948`. 글자 `#1F1D1A`/`#78726A`, 격자 `#ECE8E0`.
- 내가 올린 글의 성과 칸이 채워진다.

**완료 기준**: SQL Editor에서 `select public.call_cron('sync-stats');` 실행 → 1분 뒤 대시보드에 팔로워·반응 값이 나온다.

### M9. 보석함, 정리 작업, 에러 처리, 마무리

- **보석함 `/bookmarks`**: 탭 「나의 보석함」(내가 올린 글에서 ★, 저장 당시 성과·계정 함께) / 「참고 글」(「참고하고 싶은 문장을 직접 붙여 넣어 모아 두세요(자동 수집은 하지 않습니다).」 — 문장, 출처 주소(선택), 태그). 검색, 태그 필터, 수정, 삭제, 선택한 글을 **창고로 옮기기**(창고 선택). AI 생성기가 보석함 글을 스타일 예시로 쓴다(M5).
- **`/api/cron/cleanup`**(매일 05:00): ① `delete_after`가 지난 `uploads/` 첨부 삭제(아직 발행 전인 글이 같은 파일을 쓰면 남김) ② 어디에도 붙지 않은 채 3일 넘은 `uploads/` 파일 삭제(`list_stale_uploads`) ③ 발행 로그 90일, 읽은 알림 60일, 끝난 작업 30일, AI 사용 기록 400일 지나면 삭제. `assets/`·`products/`는 건드리지 않는다.
- 에러 처리 점검: 모든 페이지의 `error.tsx`·`loading.tsx`, 서버 액션 실패 메시지, 네트워크 오류(「서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.」), 로그인 만료(「로그인이 만료되었습니다. 새로고침 후 다시 로그인하세요.」).
- 반응형 점검(360px / 768px / 1280px), 접근성(버튼 aria-label, 차트 `role="img"` + 설명).
- README 최종 정리(12장).

**완료 기준**: 내가 올린 글 ★ → 보석함에 보이고 창고로 옮겨진다. `select public.call_cron('cleanup');` 응답 200. 휴대폰에서 모든 메뉴가 가로 스크롤 없이 보인다.

---

## 9. 설정 화면 정리

`/settings?tab=` 탭 4개: **계정**(M2) / **글 설정** / **AI**(M5) / **주제·형식**(M5). OAuth 결과는 상단 배너(초록 「@이름 계정을 연결했습니다.」 / 빨강 오류).

**글 설정** 탭
- 「제휴 고지 문구」: 이름, 문구, 자동 매칭 도메인(쉼표), 기본값(하나만), 기본 위치. 추가·수정·삭제. seed에 「쿠팡 파트너스」(`link.coupang.com`, `coupa.ng`, 기본값).
- 「일반 설정」(「예약 간격, 하루 상한, 금칙어, 창고가 비었을 때 동작을 정합니다.」): 활동 시간대(기본 08:00~23:00), 계정 간 최소 간격(분, 기본 3, 0이면 제한 없음), 같은 계정 최소 간격(분, 기본 60), 전역 하루 상한(모든 계정 합계, 기본 100), 새 계정 기본 하루 최대 게시 수(기본 10), 금칙어(쉼표·줄바꿈), 「글 창고에 맞는 글이 없을 때」 건너뛰기 (알림만 남김) / AI로 즉석 생성해서 쓰기 (알림 남김).
- 「팔로워 구간표」(M7).

---

## 10. 주기 작업 (Supabase pg_cron → Vercel API)

| 이름 | 주기(KST) | cron(UTC) | API | 하는 일 |
|---|---|---|---|---|
| `publish` | 1분마다 | `* * * * *` | `/api/cron/publish` | 발행 상태 머신 |
| `jobs` | 1분마다 | `* * * * *` (응답 5분 대기) | `/api/cron/jobs` | AI 일괄 생성, 농장 만들기 |
| `refresh-tokens` | 매일 04:00 | `0 19 * * *` | `/api/cron/refresh-tokens` | 토큰 갱신 |
| `pool-maintenance` | 매일 02:00 | `0 17 * * *` | `/api/cron/pool-maintenance` | 재고 알림·자동 보충·배정 풀기 |
| `sync-stats` | 매일 00:10 | `10 15 * * *` | `/api/cron/sync-stats` | 통계 |
| `sync-stats-3h` | 3시간마다 :40 | `40 */3 * * *` | `/api/cron/sync-stats` | 통계 |
| `cleanup` | 매일 05:00 | `0 20 * * *` | `/api/cron/cleanup` | 정리 |

- 각 라우트는 `GET`·`POST` 모두 받고, `dynamic = "force-dynamic"`, `maxDuration`은 jobs 300초 / 나머지 60초. 결과를 JSON(`ok`, 걸린 시간, 처리 수)으로 돌려준다.
- 비밀값은 Vault(`app_url`, `cron_secret`). `cron.sql`은 다시 실행해도 된다(같은 이름은 덮어씀).

---

## 11. 테스트

메모리 DB(가짜 Supabase 클라이언트: `from().select/insert/update/delete/upsert/eq/in/…`, `rpc`)와 가짜 Threads API·가짜 AI로 **외부에 접속하지 않고** 실제 코드를 시나리오 테스트한다(vitest, `@/` 경로 별칭, `server-only`는 빈 모듈로 대체).

| 파일 | 내용 |
|---|---|
| `plan.test.ts` | 링크·고지 문구 위치, 상품 홍보글(고지 맨 앞), 500자·링크 5개·주제 검사, 글자 링크 댓글 경고 |
| `text.test.ts` | 한글·영문 1자, 이모지 바이트 수 |
| `publisher.test.ts` | 캐러셀 + 링크·고지 댓글 발행, 사진 댓글, 한 회차 1개 발행·분산, 재시도 1→5분, 3회 실패, 토큰 오류 → 재연결 필요, 창고 글 사용 기록 |
| `slots.test.ts` | 활동 시간대·간격·상한 지키기, 지킬 수 없으면 건너뛰기, 지난 시간 안 쓰기, **오늘 시작이면 남은 시간대에 고르게**, 활동 시간이 끝난 날 건너뛰기 |
| `conflicts.test.ts` | 예약 충돌, 가까운 빈 시간 |
| `pool-select.test.ts` · `pool-pick.test.ts` | 페르소나·다른 계정 사용·재사용 금지·같은 분류 제외, 가중치, 동시 배정 방지, 빈 경우 건너뛰기/AI 생성, jobs 큐 |
| `farm.test.ts` | 키우기·수익화(사진 보고 쓰기, 링크·고지 서버 부착)·발행 직전 뽑기·확정·취소·삭제 |
| `ai.test.ts` | 프롬프트 조립, 검사 실패분만 재생성, 비용 계산, 키 암호화 저장, 모델 목록 거르기 |
| `stats.test.ts` · `cleanup.test.ts` | 통계 수집, 정리 작업 |
| 그 밖 | 세션 서명·만료, 토큰 암호화, CSV 파서·사진 짝짓기, 달력, 에러 문구, 유사도 |

---

## 12. README에 들어갈 내용

최종 README는 사용자가 혼자 운영할 수 있게 다음을 담는다.

1. 진행 상황 표(M1~M9).
2. 준비물(2장).
3. **Supabase 설정**: 새 프로젝트 → SQL 실행 순서(`0001` → `seed` → `0002`~`0009`) → 테이블 26개·`media` 버킷 확인 → API 값 복사. Free 플랜 업로드 50MB 제한 안내.
4. **주기 작업 등록**: Extensions에서 `pg_cron`·`pg_net` → `cron.sql`의 `<APP_URL>`(끝에 `/` 없이)·`<CRON_SECRET>` 바꿔 Run → 확인 SQL(`select jobname, schedule, active from cron.job;`, `select * from cron.job_run_details order by start_time desc limit 10;`, `select status_code, content from net._http_response order by created desc limit 10;`).
5. **Threads 앱 설정(Meta)**:
   1. https://developers.facebook.com/apps → 앱 만들기 → 사용 사례 「Threads API 액세스」.
   2. 사용 사례 → Threads API → 맞춤 설정: 권한 4개 추가, 설정에서 리디렉션 콜백 URL `https://<배포주소>/api/threads/oauth/callback`(입력 후 Enter로 칩이 생겨야 함; 제거·삭제 콜백이 필수면 같은 주소).
   3. 앱 설정 → 기본 설정에서 **Threads 앱 ID·시크릿**(두 쌍이 보이면 「Threads」가 붙은 쪽).
   4. 앱 역할 → 역할 → 사람 추가 → **Threads 테스터**로 계정 초대 → 각 계정의 Threads 앱 **설정 → 계정 → 웹사이트 권한 → 초대**에서 수락.
   5. Vercel 환경변수 입력 → Redeploy → 앱의 설정 → 계정 → 계정 연결.
   6. 토큰 정책(장기 60일, 24시간 뒤부터 갱신, 비공개 프로필 90일마다 재연결).
6. 환경변수 표와 무작위 값 생성 명령(`openssl rand -base64 48` / `-hex 32` / `-base64 32`, 각각 따로 코드 블록).
7. 로컬 실행(`npm install`, `npm run dev`), Vercel 배포(Import → 환경변수 → Deploy, push하면 자동 재배포, 새 마이그레이션은 SQL Editor에서 그 파일만 실행).
8. 기능별 동작 설명(M3~M9).
9. **운영 안내**: 꼭 백업할 값(`TOKEN_ENCRYPTION_KEY` — 잃으면 모든 계정·AI 키 재등록, `APP_PASSWORD`), 문제 해결 표:

| 증상 | 확인할 것 |
|---|---|
| 「화면을 불러오지 못했습니다」 | Supabase 일시 중지 여부, Vercel 환경변수 |
| 예약 시간이 지났는데 안 올라감 | `cron.job`에 `publish`가 있는지, `net._http_response`가 200인지(401이면 `CRON_SECRET` 불일치) |
| 발행 실패 | 예약한 글 → 실패 글을 누르면 이유. 토큰 오류면 재연결 후 「재시도」 |
| 「재연결 필요」 | 설정 → 계정 → 재연결 |
| AI 오류 | 설정 → AI의 키·기본 모델, 활동의 AI 오류 알림 |
| 농장·창고 AI 생성이 멈춤 | `cron.job`에 `jobs`, 농장 화면 진행률·오류 |
| 대시보드가 비어 있음 | `sync-stats` 등록 여부, `select public.call_cron('sync-stats');` |
| 계정 연결 시 리디렉션 오류 | Meta 앱 콜백 주소와 `THREADS_REDIRECT_URI`가 정확히 같은지 |
| 모든 계정이 「재연결 필요」 | `TOKEN_ENCRYPTION_KEY`가 바뀜 → 원래 값으로 되돌리거나 다시 연결 |

10. 테스트(`npm test`), 보안 구조(4장 요약), 폴더 구조.

### 폴더 구조 (권장)

```
app/(auth)/login          로그인
app/(main)/...            로그인 후 화면들 (사이드바 레이아웃)
app/api/cron/*            주기 작업
app/api/threads/oauth/*   계정 연결
app/api/upload            업로드 URL 발급
components/ui             기본 컴포넌트 (+ Chip)
components/layout         사이드바, 앱 셸, 페이지 헤더
components/<기능>         compose, preview, scheduled, published, activity, settings, persona,
                          pools, farm, assets, bookmarks, dashboard
lib/auth                  세션 쿠키 서명/검증, requireSession
lib/crypto                토큰 암호화(AES-256-GCM)
lib/db                    Supabase service role 클라이언트, URL 정규화
lib/threads               Threads API 클라이언트, 계정·토큰 관리, 글자 수
lib/notify                활동 알림
lib/compose               작성 내용 검증(zod)·발행 형태 변환·저장
lib/publisher             발행 상태 머신
lib/scheduler             예약 충돌 검사, 빈 시간 찾기, 농장 시간 배치
lib/ai                    공통 형태, providers/openai·gemini, 프롬프트, 검사, 생성, 단가
lib/pool                  창고 선택 규칙, 배정·사용 기록·재고, 매일 정리
lib/jobs                  jobs 큐와 처리기
lib/farm                  농장 만들기, 발행 직전 뽑기, 화면 데이터
lib/stats                 통계 수집
lib/media                 브라우저 이미지 변환·업로드
lib/text                  유사도
lib/csv.ts, csv-images.ts CSV 파서, 사진 짝짓기
lib/calendar.ts, time.ts  KST 날짜 계산, 표시
lib/settings.ts           app_settings 읽기·쓰기
lib/errors.ts             화면용 에러 문구
lib/cleanup.ts            정리 작업
lib/env.ts                서버 환경변수 검증
supabase/migrations       스키마 SQL (부록 A)
supabase/seed.sql         기본 데이터 (부록 B)
supabase/cron.sql         주기 작업 등록 (부록 C)
tests                     vitest
```

---

## 13. 최종 확인 (사용자)

| 확인 | 방법 |
|---|---|
| 로그인 | 배포 주소 → 비밀번호 로그인 |
| 계정 연결 | 설정 → 계정 → 계정 연결 → 지금 발행 |
| 예약 발행 | 5분 뒤로 예약한 글이 시간에 맞춰 올라감 |
| AI | 글 작성 → AI로 만들기 → 후보 적용 → 예약 |
| 창고 | AI 5개 채우기 → 진행률 완료 → 전체 선택 → 승인 → 글 작성에서 뽑기 |
| 농장 | 오늘 시작 키우기 농장(검토 모드) → 전체 선택 → 예약 확정 → 발행 |
| 통계 | 다음 날 대시보드 그래프, 또는 `select public.call_cron('sync-stats');` |
| 백업 | `APP_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`, **`TOKEN_ENCRYPTION_KEY`**, Supabase 값, Threads 앱 ID·시크릿, 배포 주소를 비밀번호 관리자에 저장 |

---

## 부록 A. DB 스키마 SQL

아래 9개를 `supabase/migrations/`에 같은 이름으로 저장한다. Supabase SQL Editor에서 **`0001` → 부록 B `seed.sql` → `0002` ~ `0009`** 순서로 실행한다. `0002`부터는 다시 실행해도 안전하다.

### `supabase/migrations/0001_init.sql`

```sql
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
```

### `supabase/migrations/0002_publish.sql`

```sql
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
```

### `supabase/migrations/0003_product_disclosure.sql`

```sql
-- 상품 홍보글: 제휴 고지 문구를 첫 댓글 맨 앞에 넣는 위치(reply_top) 허용
-- 다시 실행해도 안전하다.
alter table public.posts drop constraint if exists posts_disclosure_position_check;
alter table public.posts
  add constraint posts_disclosure_position_check
  check (disclosure_position in ('body', 'link_reply', 'separate_reply', 'reply_top'));
```

### `supabase/migrations/0004_reply_media.sql`

```sql
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
```

### `supabase/migrations/0005_ai.sql`

```sql
-- M5: AI 생성 (OpenAI / Gemini 선택)
-- 다시 실행해도 안전하다.

-- 생성기별 AI 회사·모델 (비우면 설정의 기본 모델 사용)
alter table public.generators add column if not exists provider text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'generators_provider_check') then
    alter table public.generators
      add constraint generators_provider_check check (provider is null or provider in ('openai', 'gemini'));
  end if;
end;
$$;

alter table public.generation_logs add column if not exists provider text;
alter table public.generation_logs add column if not exists purpose text; -- compose / pool / farm ...
alter table public.posts add column if not exists ai_meta jsonb;           -- 생성에 쓴 주제·형식 등(참고)

-- 기본 모델(텍스트용 / 사진 이해용)과 단가(1M 토큰당 USD, 직접 입력)
insert into public.app_settings (key, value) values
  ('ai_defaults', '{"text": {"provider": "gemini", "model": ""}, "vision": {"provider": "gemini", "model": ""}}'),
  ('ai_pricing', '{}')
on conflict (key) do nothing;

-- 상품 홍보글 생성기
insert into public.generators (name, version, kind, system_prompt, user_prompt_template, model, temperature, example_count, is_active)
values (
  '상품 홍보글 메이커', 1, 'product',
  $prompt$당신은 Threads에 글을 쓰는 한국인 개인 계정 운영자입니다.
직접 써 본 사람처럼 상품을 자연스럽게 소개하는 짧은 글을 씁니다. 광고 티가 나지 않게, 생활 속 경험과 구체적인 장점 위주로 씁니다.

규칙:
- 한국어로 쓴다. 본문은 500자를 넘지 않는다(이모지 포함).
- 해시태그(#)를 쓰지 않는다.
- 링크, 가격, "구매하세요" 같은 직접적인 판매 문구를 쓰지 않는다(링크와 고지 문구는 따로 붙는다).
- 과장, 의학적 효능 주장, 확인되지 않은 수치를 쓰지 않는다.
- 줄바꿈을 적절히 써서 모바일에서 읽기 쉽게 한다.
- first_reply는 링크 앞에 붙을 짧은 한 줄(예: "제가 쓰는 건 이거예요"). 필요 없으면 빈 문자열.
- topic_tag는 Threads 커뮤니티 주제로 쓸 짧은 한국어 단어 1개(# 없이).
- category는 상품 분류(예: 살림, 뷰티, 디지털)를 짧게 쓴다.$prompt$,
  $prompt$다음 상품을 소개하는 Threads 글 {{count}}개를 만들어 주세요. 글마다 다른 관점(사용 장면, 고민 해결, 비교 등)으로 써 주세요.

[상품]
{{topic}}

[페르소나]
{{persona}}

[글 형식]
{{format}}

[길이]
{{length}}

[참고할 스타일 예시]
{{examples}}

[이 계정의 최근 글 — 소재와 표현이 겹치지 않게]
{{recent_posts}}$prompt$,
  null, 0.9, 3, true
)
on conflict (name, version) do nothing;
```

### `supabase/migrations/0006_pools.sql`

```sql
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
```

### `supabase/migrations/0007_pool_compose.sql`

```sql
-- 창고 글을 글 작성과 같은 형태(사진·댓글 여러 개·링크·고지 문구 등)로 저장
-- 다시 실행해도 안전하다.
alter table public.pool_items add column if not exists compose jsonb;
```

### `supabase/migrations/0008_farm.sql`

```sql
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
```

### `supabase/migrations/0009_cleanup.sql`

```sql
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
```

## 부록 B. 기본 데이터

여러 번 실행해도 중복되지 않는다. 기본 설정, 쿠팡 파트너스 고지 문구, 「일상 주제글 메이커」 생성기, 글 형식 5개, 주제 50개.

### `supabase/seed.sql`

```sql
-- AUTO THREAD 기본 데이터. 여러 번 실행해도 중복되지 않는다.

-- ---------------------------------------------------------------
-- 일반 설정
-- ---------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('active_hours',           '{"start": "08:00", "end": "23:00"}'),
  ('banned_words',           '[]'),
  ('global_daily_limit',     '100'),
  ('default_daily_post_limit', '10'),
  ('min_gap_minutes',        '3'),   -- 계정 간 최소 간격(분), 0이면 제한 없음
  ('same_account_gap_minutes', '60'),
  ('pool_empty_behavior',    '"skip"'), -- skip | ai_generate
  ('ai_pricing',             '{}'),  -- 모델별 100만 토큰당 USD 단가. M5에서 채운다.
  -- 팔로워 구간별 권장 하루 게시 수 (max가 null이면 상한 없음)
  ('follower_tiers', '[
    {"min": 0,    "max": 99,   "daily_posts": 3},
    {"min": 100,  "max": 499,  "daily_posts": 4},
    {"min": 500,  "max": 999,  "daily_posts": 5},
    {"min": 1000, "max": 4999, "daily_posts": 6},
    {"min": 5000, "max": null, "daily_posts": 8}
  ]')
on conflict (key) do nothing;

-- ---------------------------------------------------------------
-- 제휴 고지 문구
-- ---------------------------------------------------------------
insert into public.disclosures (name, text, match_domains, is_default, default_position) values (
  '쿠팡 파트너스',
  '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
  array['link.coupang.com', 'coupa.ng'],
  true,
  'link_reply'
)
on conflict (name) do nothing;

-- ---------------------------------------------------------------
-- 기본 생성기: 일상 주제글 메이커
-- 템플릿 변수: {{count}} {{persona}} {{topic}} {{format}} {{length}} {{examples}} {{recent_posts}}
-- ---------------------------------------------------------------
insert into public.generators (name, version, kind, system_prompt, user_prompt_template, model, temperature, example_count, is_active)
values (
  '일상 주제글 메이커', 1, 'daily',
  $prompt$당신은 Threads에 글을 쓰는 한국인 개인 계정 운영자입니다.
주어진 페르소나의 말투와 생활감을 살려, 실제 사람이 쓴 것처럼 자연스러운 짧은 글을 씁니다.

규칙:
- 한국어로 쓴다. 본문은 500자를 넘지 않는다(이모지 포함).
- 해시태그(#)를 쓰지 않는다.
- 광고·홍보 문구, 링크, 과장된 표현을 쓰지 않는다.
- 첫 문장에서 관심을 끌고, 읽는 사람이 댓글을 달고 싶게 만든다.
- 줄바꿈을 적절히 써서 모바일에서 읽기 쉽게 한다.
- 최근 글과 같은 소재, 같은 첫 문장을 반복하지 않는다.
- first_reply는 본문에 이어지는 짧은 덧붙임 또는 질문이다. 필요 없으면 빈 문자열.
- topic_tag는 Threads 커뮤니티 주제로 쓸 짧은 한국어 단어 1개(# 없이).
- category는 주어진 주제의 카테고리를 그대로 쓴다.$prompt$,
  $prompt$다음 조건으로 Threads 글 {{count}}개를 만들어 주세요.

[페르소나]
{{persona}}

[주제]
{{topic}}

[글 형식]
{{format}}

[길이]
{{length}}

[참고할 스타일 예시]
{{examples}}

[이 계정의 최근 글 — 소재와 표현이 겹치지 않게]
{{recent_posts}}$prompt$,
  null, 0.9, 3, true
)
on conflict (name, version) do nothing;

-- ---------------------------------------------------------------
-- 글 형식 5개
-- ---------------------------------------------------------------
insert into public.post_formats (name, instruction) values
  ('질문형', '독자에게 의견이나 경험을 묻는 질문으로 끝낸다. 질문은 답하기 쉽고 구체적으로.'),
  ('공감형', '누구나 겪어 봤을 상황을 묘사하고 "나만 그런가?" 같은 공감을 이끌어 낸다.'),
  ('리스트형', '3~5개 항목을 짧은 줄로 나열한다. 각 줄은 한 문장 이내.'),
  ('경험담형', '최근 겪은 일을 짧은 이야기로 풀고, 마지막에 느낀 점을 한 줄로 정리한다.'),
  ('꿀팁형', '바로 써먹을 수 있는 실용적인 팁 하나를 구체적인 예와 함께 전한다.')
on conflict (name) do nothing;

-- ---------------------------------------------------------------
-- 예시 주제 50개 (10개 카테고리 × 5)
-- ---------------------------------------------------------------
insert into public.topics (category, topic, keywords) values
  ('일상', '월요일 아침 출근길 풍경', array['출근', '월요일', '지하철']),
  ('일상', '주말에 아무것도 안 하고 쉬기', array['주말', '휴식', '집콕']),
  ('일상', '요즘 자꾸 늦게 자는 이유', array['수면', '밤', '습관']),
  ('일상', '동네 산책하다 발견한 것', array['산책', '동네', '발견']),
  ('일상', '날씨가 갑자기 바뀌었을 때', array['날씨', '계절', '옷차림']),

  ('직장', '회의가 너무 많은 날', array['회의', '업무', '시간']),
  ('직장', '점심 메뉴 고르기의 어려움', array['점심', '메뉴', '동료']),
  ('직장', '퇴근 후 저녁 시간 활용법', array['퇴근', '저녁', '루틴']),
  ('직장', '일 잘하는 동료의 특징', array['동료', '업무', '태도']),
  ('직장', '연차 쓰기 전날의 설렘', array['연차', '휴가', '설렘']),

  ('연애·관계', '오래 만난 친구와의 대화', array['친구', '우정', '대화']),
  ('연애·관계', '연락 텀에 대한 생각', array['연락', '연애', '카톡']),
  ('연애·관계', '혼자가 편해지는 순간', array['혼자', '관계', '거리']),
  ('연애·관계', '부모님께 고마웠던 순간', array['부모님', '가족', '감사']),
  ('연애·관계', '사람 관계에서 지키는 선', array['관계', '거리두기', '배려']),

  ('돈·재테크', '이번 달 가계부 돌아보기', array['가계부', '지출', '절약']),
  ('돈·재테크', '충동구매 줄이는 방법', array['충동구매', '소비', '절약']),
  ('돈·재테크', '처음 적금 들었을 때', array['적금', '저축', '목표']),
  ('돈·재테크', '구독 서비스 정리하기', array['구독', '고정비', '정리']),
  ('돈·재테크', '돈 모으는 작은 습관', array['저축', '습관', '재테크']),

  ('건강·운동', '운동 작심삼일 극복기', array['운동', '작심삼일', '루틴']),
  ('건강·운동', '물 많이 마시기 도전', array['물', '건강', '습관']),
  ('건강·운동', '스트레칭으로 하루 시작', array['스트레칭', '아침', '건강']),
  ('건강·운동', '걷기 운동의 좋은 점', array['걷기', '만보', '운동']),
  ('건강·운동', '잠 잘 자는 방법', array['수면', '숙면', '건강']),

  ('음식', '혼밥 메뉴 추천', array['혼밥', '메뉴', '간단']),
  ('음식', '야식의 유혹', array['야식', '밤', '배달']),
  ('음식', '집에서 해 먹는 간단 요리', array['요리', '집밥', '레시피']),
  ('음식', '최근 맛있게 먹은 음식', array['맛집', '음식', '추천']),
  ('음식', '커피 없이 못 사는 사람', array['커피', '카페', '아침']),

  ('육아·가족', '아이가 한 엉뚱한 말', array['육아', '아이', '대화']),
  ('육아·가족', '가족과 보내는 주말', array['가족', '주말', '나들이']),
  ('육아·가족', '명절 풍경', array['명절', '가족', '고향']),
  ('육아·가족', '부모가 되고 달라진 점', array['부모', '육아', '변화']),
  ('육아·가족', '형제자매 이야기', array['형제', '자매', '추억']),

  ('자기계발', '아침 루틴 만들기', array['루틴', '아침', '습관']),
  ('자기계발', '요즘 읽고 있는 책', array['독서', '책', '추천']),
  ('자기계발', '새로운 걸 배우기 시작한 이유', array['배움', '공부', '도전']),
  ('자기계발', '할 일 목록 관리법', array['할일', '생산성', '정리']),
  ('자기계발', '실패에서 배운 것', array['실패', '교훈', '성장']),

  ('취미', '요즘 빠진 취미', array['취미', '여가', '재미']),
  ('취미', '주말에 본 영화나 드라마', array['영화', '드라마', '추천']),
  ('취미', '플레이리스트 공유', array['음악', '플레이리스트', '노래']),
  ('취미', '사진 찍는 즐거움', array['사진', '카메라', '기록']),
  ('취미', '여행 가고 싶은 곳', array['여행', '버킷리스트', '휴가']),

  ('쇼핑·살림', '잘 샀다 싶은 살림템', array['살림', '추천템', '만족']),
  ('쇼핑·살림', '집 정리 정돈 팁', array['정리', '수납', '집']),
  ('쇼핑·살림', '계절 바뀔 때 옷장 정리', array['옷장', '정리', '계절']),
  ('쇼핑·살림', '후회한 쇼핑', array['쇼핑', '후회', '소비']),
  ('쇼핑·살림', '자취 필수템', array['자취', '필수템', '살림'])
on conflict (category, topic) do nothing;
```

## 부록 C. 주기 작업 등록

`<APP_URL>`(배포 주소, 끝에 `/` 없이)과 `<CRON_SECRET>`(Vercel 환경변수와 같은 값)을 바꿔 실행한다. Extensions에서 `pg_cron`, `pg_net`을 먼저 켠다.

### `supabase/cron.sql`

```sql
-- AUTO THREAD 주기 작업 등록 (Supabase pg_cron → pg_net → Vercel API)
-- 실행 전에 아래 두 자리 표시를 바꾼다:
--   <APP_URL>      예) https://my-auto-thread.vercel.app   (끝에 / 없이)
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

-- 공통 호출 함수: /api/cron/<path> 를 Bearer 인증으로 POST (timeout_ms: 응답 대기 시간)
drop function if exists public.call_cron(text);
create or replace function public.call_cron(path text, timeout_ms int default 55000)
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
    timeout_milliseconds := timeout_ms
  );
$$;
revoke all on function public.call_cron(text, int) from public, anon, authenticated;

-- 매일 04:00 KST (= 19:00 UTC): 장기 토큰 갱신
select cron.schedule('refresh-tokens', '0 19 * * *', $$select public.call_cron('refresh-tokens')$$);

-- 1분마다: 발행 상태 머신 진행 (M3)
select cron.schedule('publish', '* * * * *', $$select public.call_cron('publish')$$);

-- 1분마다: jobs 큐(AI 일괄 생성, 농장 배치). 오래 걸릴 수 있어 응답을 5분까지 기다린다 (M6)
select cron.schedule('jobs', '* * * * *', $$select public.call_cron('jobs', 300000)$$);

-- 매일 02:00 KST (= 17:00 UTC): 창고 재고 부족 알림, 자동 보충, 오래된 배정 풀기 (M6)
select cron.schedule('pool-maintenance', '0 17 * * *', $$select public.call_cron('pool-maintenance')$$);

-- 통계 수집: 매일 00:10 KST(= 15:10 UTC) + 3시간마다 (M8)
select cron.schedule('sync-stats', '10 15 * * *', $$select public.call_cron('sync-stats')$$);
select cron.schedule('sync-stats-3h', '40 */3 * * *', $$select public.call_cron('sync-stats')$$);

-- 매일 05:00 KST (= 20:00 UTC): 기한 지난 첨부·버려진 업로드·오래된 기록 정리 (M9)
select cron.schedule('cleanup', '0 20 * * *', $$select public.call_cron('cleanup')$$);

-- 확인용:
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, content from net._http_response order by created desc limit 10;
```

## 부록 D. 환경변수 예시

### `.env.example`

```bash
# ── 접속 ─────────────────────────────────────────────
# 로그인 비밀번호 (길고 복잡하게)
APP_PASSWORD=
# 세션 쿠키 서명 키 (32자 이상 무작위). 생성: openssl rand -base64 48
SESSION_SECRET=

# ── Supabase (Project Settings > API) ────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# 절대 브라우저/깃에 노출 금지. 서버에서만 사용
SUPABASE_SERVICE_ROLE_KEY=
STORAGE_BUCKET=media

# ── Threads API (M2에서 사용) ────────────────────────
THREADS_APP_ID=
THREADS_APP_SECRET=
THREADS_REDIRECT_URI=https://your-app.vercel.app/api/threads/oauth/callback
# 토큰 암호화 키 (32바이트 base64). 생성: openssl rand -base64 32
TOKEN_ENCRYPTION_KEY=

# ── 주기 작업 ────────────────────────────────────────
# pg_cron이 /api/cron/* 호출 시 Bearer 로 보냄. 생성: openssl rand -hex 32
CRON_SECRET=

# ── AI (M5) — 쓰는 회사의 키만 넣으면 된다. 모델은 앱의 설정 > AI 에서 고른다
# OpenAI: https://platform.openai.com/api-keys
OPENAI_API_KEY=
# Google Gemini: https://aistudio.google.com/apikey
GEMINI_API_KEY=

APP_TIMEZONE=Asia/Seoul
```

## 부록 E. 핵심 규칙 참고 구현

동작이 검증된 코드다(단위 테스트 통과). 규칙을 정확히 맞추기 위해 그대로 써도 되고, 같은 동작이면 다르게 써도 된다. 파일 위치는 권장 폴더 구조 기준이다.

### `lib/threads/text.ts` — Threads 글자 수(이모지는 UTF-8 바이트)

```ts
/**
 * Threads 글자 수 규칙: 일반 문자는 1자, 이모지는 UTF-8 바이트 수로 센다.
 * (https://developers.facebook.com/docs/threads/posts — "Emojis are counted as the number of UTF-8 bytes")
 */
export const THREADS_TEXT_LIMIT = 500;

const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
const encoder = new TextEncoder();

export function countThreadsChars(text: string): number {
  let n = 0;
  for (const { segment } of segmenter.segment(text)) {
    n += EMOJI.test(segment) ? encoder.encode(segment).length : 1;
  }
  return n;
}
```

### `lib/text/similarity.ts` — 글자 2-gram 유사도

```ts
/** 글자 2-gram 자카드 유사도 (0~1). 공백·문장부호는 무시한다. */
function bigrams(s: string): Set<string> {
  const t = s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const out = new Set<string>();
  const chars = Array.from(t);
  for (let i = 0; i < chars.length - 1; i++) out.add(chars[i] + chars[i + 1]);
  return out;
}

export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

export const SIMILARITY_WARN = 0.5;

export function mostSimilar(text: string, others: string[]): { score: number; text: string } | null {
  let best: { score: number; text: string } | null = null;
  for (const o of others) {
    const score = similarity(text, o);
    if (!best || score > best.score) best = { score, text: o };
  }
  return best;
}
```

### `lib/compose/schema.ts` — 작성 내용 형태(zod), 창고 글 내용 형태

```ts
import { z } from "zod";

export const MAX_MEDIA = 20;
export const MAX_REPLIES = 10;

export const mediaItemSchema = z.object({
  storagePath: z.string().min(1),
  publicUrl: z.string().url(),
  mediaType: z.enum(["image", "video"]),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});
export type MediaItem = z.infer<typeof mediaItemSchema>;

/** 댓글: 글 + (선택) 사진·영상 1개. 예전 형식(문자열)도 받아들인다. */
export const replySchema = z.preprocess(
  (v) => (typeof v === "string" ? { text: v, media: null } : v),
  z.object({
    text: z.string().max(5000).default(""),
    media: mediaItemSchema.nullable().optional().transform((m) => m ?? null),
  }),
);
export type ReplyItem = z.output<typeof replySchema>;

export const LINK_POSITIONS = ["body", "first_reply"] as const;
export const DISCLOSURE_POSITIONS = ["body", "link_reply", "separate_reply"] as const;
export type LinkPosition = (typeof LINK_POSITIONS)[number];
export type DisclosurePosition = (typeof DISCLOSURE_POSITIONS)[number];

/** 작성 화면 상태. posts.compose 에 그대로 저장해 수정할 때 다시 불러온다. */
export const composeSchema = z.object({
  accountId: z.string().uuid(),
  kind: z.enum(["general", "product"]).default("general"),
  text: z.string().max(5000).default(""),
  media: z.array(mediaItemSchema).max(MAX_MEDIA).default([]),
  replies: z.array(replySchema).max(MAX_REPLIES).default([]),
  /** 첫 댓글에 본문 첫 사진을 붙인다(링크 미리보기 카드 없이 깔끔하게) */
  firstReplyMainMedia: z.boolean().default(false),
  linkUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "링크는 http(s):// 로 시작해야 합니다."),
  linkPosition: z.enum(LINK_POSITIONS).default("body"),
  topicTag: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/^#/, "") : null)),
  disclosureId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  disclosurePosition: z.enum(DISCLOSURE_POSITIONS).default("link_reply"),
  isAiLabel: z.boolean().default(false),
  /** 작성 방법: 직접 작성 / AI */
  mode: z.enum(["manual", "ai", "pool"]).default("manual"),
  generatorId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  /** AI 주제(상품이면 상품명·특징). 비우면 랜덤 */
  aiTopic: z.string().max(1000).nullable().optional().transform((v) => v ?? null),
  /** 글 창고에서 가져온 글 */
  poolItemId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  /** 적용한 AI 후보의 생성 정보(참고용) */
  aiMeta: z.record(z.string(), z.unknown()).nullable().optional().transform((v) => v ?? null),
});
export type ComposeInput = z.input<typeof composeSchema>;
export type Compose = z.output<typeof composeSchema>;

export const emptyCompose = (accountId = ""): Compose => ({
  accountId,
  kind: "general",
  text: "",
  media: [],
  replies: [],
  firstReplyMainMedia: false,
  linkUrl: null,
  linkPosition: "body",
  topicTag: null,
  disclosureId: null,
  disclosurePosition: "link_reply",
  isAiLabel: false,
  mode: "manual",
  generatorId: null,
  aiTopic: null,
  aiMeta: null,
  poolItemId: null,
});

/** 창고 글 내용: 글 작성에서 계정·작성 방법 등을 뺀 부분 */
export const poolContentSchema = composeSchema.pick({
  kind: true,
  text: true,
  media: true,
  replies: true,
  firstReplyMainMedia: true,
  linkUrl: true,
  linkPosition: true,
  topicTag: true,
  disclosureId: true,
  disclosurePosition: true,
  isAiLabel: true,
});
export type PoolContent = z.output<typeof poolContentSchema>;

/** 예전(간단한) 창고 글 → 글 작성 형태 */
export function poolItemToContent(item: { text: string; first_reply: string | null; topic_tag: string | null; compose?: unknown }): PoolContent {
  const parsed = item.compose ? poolContentSchema.safeParse(item.compose) : null;
  if (parsed?.success) return parsed.data;
  const base = emptyCompose();
  return {
    kind: base.kind,
    text: item.text,
    media: [],
    replies: item.first_reply ? [{ text: item.first_reply, media: null }] : [],
    firstReplyMainMedia: false,
    linkUrl: null,
    linkPosition: "body",
    topicTag: item.topic_tag,
    disclosureId: null,
    disclosurePosition: "link_reply",
    isAiLabel: false,
  };
}
```

### `lib/compose/plan.ts` — 작성 내용 → 발행 형태 변환·검사

```ts
/**
 * 작성 내용 → 실제로 발행할 형태(본문 + 댓글 목록)로 바꾸는 순수 함수.
 * 작성 화면(미리보기·검사)과 서버(저장·발행)가 같은 함수를 쓴다.
 */
import { THREADS_TEXT_LIMIT, countThreadsChars } from "@/lib/threads/text";
import type { Compose, DisclosurePosition, LinkPosition, MediaItem } from "./schema";

export type DisclosureLite = { id: string; name: string; text: string; match_domains: string[]; default_position: DisclosurePosition };

export type PlannedReply = { text: string; kind: "user" | "link" | "disclosure"; media: MediaItem | null };

export type Issue = { level: "error" | "warn"; field: string; message: string };

/** reply_top: 첫 댓글 맨 앞 (상품 홍보글 전용) */
export type PlanDisclosurePosition = DisclosurePosition | "reply_top";

export type PublishPlan = {
  mainText: string;
  linkAttachment: string | null;
  linkPosition: LinkPosition | null;
  disclosurePosition: PlanDisclosurePosition | null;
  mediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
  replies: PlannedReply[];
  issues: Issue[];
};

export const MAX_LINKS = 5;
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;

export function extractUrls(text: string): string[] {
  return (text.match(URL_RE) ?? []).map((u) => u.replace(/[.,!?)]+$/, ""));
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** 링크 도메인이 고지 문구의 match_domains 와 맞으면 그 문구를 돌려준다 */
export function matchDisclosure(linkUrl: string | null, disclosures: DisclosureLite[]): DisclosureLite | null {
  const host = hostOf(linkUrl);
  if (!host) return null;
  return (
    disclosures.find((d) =>
      d.match_domains.some((m) => {
        const dm = m.toLowerCase().replace(/^www\./, "");
        return host === dm || host.endsWith(`.${dm}`);
      }),
    ) ?? null
  );
}

const join = (a: string, b: string) => (a ? `${a}\n\n${b}` : b);

export function validateTopicTag(tag: string | null): string | null {
  if (!tag) return null;
  if (tag.length > 50) return "커뮤니티 주제는 50자 이하여야 합니다.";
  if (/[.&]/.test(tag)) return "커뮤니티 주제에는 마침표(.)와 &를 쓸 수 없습니다.";
  return null;
}

export function buildPlan(
  c: Compose,
  opts: { disclosure?: DisclosureLite | null; bannedWords?: string[] } = {},
): PublishPlan {
  const issues: Issue[] = [];
  const hasMedia = c.media.length > 0;
  const link = c.linkUrl;
  const disclosure = c.disclosureId ? (opts.disclosure ?? null) : null;

  // 미디어가 있으면 link_attachment 가 동작하지 않으므로 링크는 첫 댓글로
  const linkPosition: LinkPosition | null = link ? (hasMedia ? "first_reply" : c.linkPosition) : null;

  let mainText = c.text.trim();
  const replies: PlannedReply[] = c.replies
    .map((r) => ({ text: r.text.trim(), kind: "user" as const, media: r.media ?? null }))
    .filter((r) => r.text || r.media);
  let linkReplyIdx = -1;

  if (link) {
    if (linkPosition === "body") {
      mainText = join(mainText, link);
    } else if (replies.length > 0) {
      replies[0] = { ...replies[0], text: join(replies[0].text, link), kind: "link" };
      linkReplyIdx = 0;
    } else {
      replies.unshift({ text: link, kind: "link", media: null });
      linkReplyIdx = 0;
    }
  }

  let disclosurePosition: PlanDisclosurePosition | null = null;
  if (disclosure && c.kind === "product") {
    // 상품 홍보글: 고지 문구를 첫 댓글 맨 앞에 → "고지 문구 + 댓글 내용(+ 링크)"
    disclosurePosition = "reply_top";
    if (replies.length > 0) {
      replies[0] = { ...replies[0], text: join(disclosure.text, replies[0].text) };
    } else {
      replies.unshift({ text: disclosure.text, kind: "disclosure", media: null });
    }
  } else if (disclosure) {
    disclosurePosition = c.disclosurePosition;
    // 링크 댓글이 없으면 '링크 댓글' 위치는 링크가 있는 곳(본문) 또는 별도 댓글로 바꾼다
    if (disclosurePosition === "link_reply" && linkReplyIdx < 0) {
      disclosurePosition = linkPosition === "body" ? "body" : "separate_reply";
    }
    if (disclosurePosition === "body") {
      mainText = join(mainText, disclosure.text);
    } else if (disclosurePosition === "link_reply") {
      replies[linkReplyIdx] = { ...replies[linkReplyIdx], text: join(replies[linkReplyIdx].text, disclosure.text) };
    } else {
      replies.splice(linkReplyIdx >= 0 ? linkReplyIdx + 1 : 0, 0, { text: disclosure.text, kind: "disclosure", media: null });
    }
  }

  // 첫 댓글에 본문 첫 사진 붙이기 (댓글에 직접 넣은 사진이 있으면 그것을 우선)
  if (c.firstReplyMainMedia && hasMedia && replies.length > 0 && !replies[0].media) {
    replies[0] = { ...replies[0], media: c.media[0] };
  }

  const mediaType: PublishPlan["mediaType"] = !hasMedia
    ? "TEXT"
    : c.media.length === 1
      ? c.media[0].mediaType === "video"
        ? "VIDEO"
        : "IMAGE"
      : "CAROUSEL";

  // ---- 검사
  const mainCount = countThreadsChars(mainText);
  if (!mainText && !hasMedia) issues.push({ level: "error", field: "text", message: "본문을 입력하세요." });
  if (mainCount > THREADS_TEXT_LIMIT) {
    issues.push({
      level: "error",
      field: "text",
      message: `본문이 ${THREADS_TEXT_LIMIT}자를 넘었습니다(${mainCount}자${disclosurePosition === "body" || linkPosition === "body" ? ", 링크·고지 문구 포함" : ""}).`,
    });
  }
  replies.forEach((r, i) => {
    const n = countThreadsChars(r.text);
    if (n > THREADS_TEXT_LIMIT) issues.push({ level: "error", field: `reply.${i}`, message: `${i + 1}번째 댓글이 ${THREADS_TEXT_LIMIT}자를 넘었습니다(${n}자).` });
  });
  const linkAttachment = link && linkPosition === "body" && !hasMedia ? link : null;
  const textOnlyLinkReply = replies.findIndex((r) => !r.media && extractUrls(r.text).length > 0);
  if (textOnlyLinkReply >= 0) {
    issues.push({
      level: "warn",
      field: `reply.${textOnlyLinkReply}`,
      message: `${textOnlyLinkReply + 1}번째 댓글은 글자만 있어서 링크 미리보기 카드가 붙습니다. 사진을 붙이면 링크만 표시됩니다.`,
    });
  }
  const uniqueLinks = new Set([...extractUrls(mainText), ...(linkAttachment ? [linkAttachment] : [])]);
  if (uniqueLinks.size > MAX_LINKS) {
    issues.push({ level: "error", field: "text", message: `본문의 링크는 ${MAX_LINKS}개 이하여야 합니다(현재 ${uniqueLinks.size}개).` });
  }
  const tagErr = validateTopicTag(c.topicTag);
  if (tagErr) issues.push({ level: "error", field: "topicTag", message: tagErr });
  if (c.media.length > 20) issues.push({ level: "error", field: "media", message: "사진·영상은 최대 20개입니다." });

  if (c.kind === "product" && !disclosure) {
    issues.push({ level: "warn", field: "disclosure", message: "상품 홍보글입니다. 제휴 고지 문구를 선택하세요." });
  } else if (link && !disclosure) {
    issues.push({ level: "warn", field: "disclosure", message: "링크가 있는데 제휴 고지 문구가 없습니다. 제휴 링크라면 고지 문구를 넣으세요." });
  }
  const banned = (opts.bannedWords ?? []).map((w) => w.trim()).filter(Boolean);
  if (banned.length) {
    const all = [mainText, ...replies.map((r) => r.text)].join("\n").toLowerCase();
    const hits = banned.filter((w) => all.includes(w.toLowerCase()));
    if (hits.length) issues.push({ level: "warn", field: "text", message: `금칙어가 들어 있습니다: ${hits.join(", ")}` });
  }

  return { mainText, linkAttachment, linkPosition, disclosurePosition, mediaType, replies, issues };
}

export const hasErrors = (p: PublishPlan) => p.issues.some((i) => i.level === "error");
```

### `lib/scheduler/conflicts.ts` — 예약 충돌·가까운 빈 시간

```ts
/** 예약 시간 충돌 검사(순수 함수). 시간은 epoch ms. */

export type Slot = { id: string; accountId: string; at: number; username?: string };

export type Conflict = { id: string; accountId: string; username?: string; at: number; reason: "other_account_gap" | "same_account_gap" };

const MIN = 60_000;

export function findConflicts(
  target: { accountId: string; at: number; excludeId?: string },
  slots: Slot[],
  gaps: { minGapMinutes: number; sameAccountGapMinutes: number },
): Conflict[] {
  const out: Conflict[] = [];
  for (const s of slots) {
    if (s.id === target.excludeId) continue;
    const diff = Math.abs(s.at - target.at);
    if (s.accountId === target.accountId) {
      if (gaps.sameAccountGapMinutes > 0 && diff < gaps.sameAccountGapMinutes * MIN) {
        out.push({ ...s, reason: "same_account_gap" });
      }
    } else if (gaps.minGapMinutes > 0 && diff < gaps.minGapMinutes * MIN) {
      out.push({ ...s, reason: "other_account_gap" });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * 가장 가까운 빈 시간(분 단위)을 찾는다. 원래 시간에서 +1, -1, +2, -2 … 분 순서로 최대 maxMinutes 까지.
 * notBefore 보다 이른 시간은 고르지 않는다.
 */
export function suggestNearestFree(
  target: { accountId: string; at: number; excludeId?: string },
  slots: Slot[],
  gaps: { minGapMinutes: number; sameAccountGapMinutes: number },
  opts: { notBefore: number; maxMinutes?: number },
): number | null {
  const base = Math.floor(target.at / MIN) * MIN;
  const max = opts.maxMinutes ?? 240;
  for (let d = 0; d <= max; d++) {
    for (const sign of d === 0 ? [1] : [1, -1]) {
      const at = base + sign * d * MIN;
      if (at < opts.notBefore) continue;
      if (findConflicts({ ...target, at }, slots, gaps).length === 0) return at;
    }
  }
  return null;
}
```

### `lib/scheduler/slots.ts` — 농장 시간 배치(오늘 시작 포함)

```ts
/**
 * 농장 시간 배치(작업지시서 8장, 순수 함수)
 *  - 활동 시간대(오늘이면 지금 이후 남은 부분)를 하루 게시 수로 균등 분할, 각 슬롯에 ±(간격의 30%, 최대 20분) 랜덤 오차
 *  - 같은 계정 글은 최소 sameAccountGapMinutes(기본 60분) 간격
 *  - 전체 계정 기준 minGapMinutes(설정, 0이면 제한 없음) 이상
 *  - 계정별 하루 상한, 전역 하루 상한을 넘지 않음
 * 시간은 epoch ms, 날짜는 KST "yyyy-MM-dd".
 */
import { findConflicts, type Slot } from "./conflicts";

const MIN = 60_000;

export type PlanAccount = { id: string; dailyCount: number; dailyLimit: number };
export type PlanInput = {
  days: string[];
  accounts: PlanAccount[];
  /** "HH:mm" */
  activeStart: string;
  activeEnd: string;
  /** KST 날짜·시각 → epoch ms */
  toEpoch: (day: string, hm: string) => number;
  existing: Slot[];
  /** 이미 잡힌 하루 글 수: key `${accountId}|${day}` 와 `*|${day}` */
  existingCounts: Map<string, number>;
  minGapMinutes: number;
  sameAccountGapMinutes: number;
  globalDailyLimit: number;
  notBefore: number;
  rnd?: () => number;
};
export type PlannedSlot = { accountId: string; day: string; at: number };
export type PlanResult = { slots: PlannedSlot[]; skipped: { accountId: string; day: string; reason: string }[] };

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function planSlots(input: PlanInput): PlanResult {
  const rnd = input.rnd ?? Math.random;
  const gaps = { minGapMinutes: input.minGapMinutes, sameAccountGapMinutes: input.sameAccountGapMinutes };
  const taken: Slot[] = [...input.existing];
  const counts = new Map(input.existingCounts);
  const out: PlanResult = { slots: [], skipped: [] };
  let seq = 0;

  for (const day of input.days) {
    // 오늘처럼 이미 시작된 날은 지금 이후(notBefore)의 남은 시간대에 고르게 나눈다
    const winStart = Math.max(input.toEpoch(day, input.activeStart), Math.ceil(input.notBefore / MIN) * MIN);
    const winEnd = input.toEpoch(day, input.activeEnd);
    if (winEnd <= winStart) {
      if (input.toEpoch(day, input.activeStart) < winEnd)
        for (const acc of input.accounts) for (let k = 0; k < acc.dailyCount; k++) out.skipped.push({ accountId: acc.id, day, reason: "이미 지난 시간" });
      continue;
    }
    for (const acc of shuffle(input.accounts, rnd)) {
      const room = Math.max(0, acc.dailyLimit - (counts.get(`${acc.id}|${day}`) ?? 0));
      const n = Math.min(acc.dailyCount, room);
      for (let k = n; k < acc.dailyCount; k++) out.skipped.push({ accountId: acc.id, day, reason: "계정 하루 상한" });
      if (n <= 0) continue;
      const interval = (winEnd - winStart) / n;
      const jitter = Math.min(0.3 * interval, 20 * MIN);
      for (let i = 0; i < n; i++) {
        if ((counts.get(`*|${day}`) ?? 0) >= input.globalDailyLimit) {
          out.skipped.push({ accountId: acc.id, day, reason: "전역 하루 상한" });
          continue;
        }
        const base = winStart + interval * (i + 0.5) + (rnd() * 2 - 1) * jitter;
        // 가장 가까운 빈 분(minute)을 슬롯 범위(간격의 절반) 안에서 찾는다
        const lo = Math.max(winStart, winStart + interval * i);
        const hi = Math.min(winEnd, winStart + interval * (i + 1));
        const at = nearestFree(Math.min(Math.max(base, lo), hi), lo, hi, acc.id, taken, gaps);
        if (at === null) {
          out.skipped.push({ accountId: acc.id, day, reason: lo >= hi ? "이미 지난 시간" : "간격 규칙을 지킬 빈 시간이 없음" });
          continue;
        }
        taken.push({ id: `new-${seq++}`, accountId: acc.id, at });
        counts.set(`${acc.id}|${day}`, (counts.get(`${acc.id}|${day}`) ?? 0) + 1);
        counts.set(`*|${day}`, (counts.get(`*|${day}`) ?? 0) + 1);
        out.slots.push({ accountId: acc.id, day, at });
      }
    }
  }
  out.slots.sort((a, b) => a.at - b.at);
  return out;
}

function nearestFree(target: number, lo: number, hi: number, accountId: string, taken: Slot[], gaps: { minGapMinutes: number; sameAccountGapMinutes: number }): number | null {
  if (lo >= hi) return null;
  const base = Math.round(target / MIN) * MIN;
  const span = Math.ceil((hi - lo) / MIN);
  for (let d = 0; d <= span; d++) {
    for (const sign of d === 0 ? [1] : [1, -1]) {
      const at = base + sign * d * MIN;
      if (at < lo || at >= hi) continue;
      if (findConflicts({ accountId, at }, taken, gaps).length === 0) return at;
    }
  }
  return null;
}

/** 팔로워 구간표로 하루 게시 수 추천 */
export type FollowerTier = { min: number; max: number | null; daily_posts: number };
export function recommendDaily(followers: number | null, tiers: FollowerTier[]): number {
  const f = followers ?? 0;
  const t = tiers.find((x) => f >= x.min && (x.max === null || f <= x.max));
  return t?.daily_posts ?? tiers[0]?.daily_posts ?? 3;
}
```

### `lib/pool/select.ts` — 글 창고 랜덤 선택 규칙

```ts
/**
 * 글 창고 랜덤 선택 규칙 (작업지시서 8장, 순수 함수)
 *  - 후보: 계정에 연결된 창고의 available 글 중 페르소나 필터가 맞는 것
 *  - 제외: 다른 계정이 이미 쓴 글(글 하나는 계정 하나에만), 재사용 금지 기간 안의 글,
 *          이 계정의 직전 글과 같은 category
 *  - weight 가중 랜덤
 */

export type Persona = { age_group: string | null; gender: string | null; job: string | null };
export type PersonaFilter = Partial<Record<keyof Persona, string | null>>;

export type PoolRule = { id: string; personaFilter: PersonaFilter; reuseCooldownDays: number | null };

export type CandidateItem = {
  id: string;
  poolId: string;
  category: string | null;
  weight: number;
  personaTags: string[];
  usages: { accountId: string; usedAt: string }[];
};

export type ExcludeReason = "persona" | "used_by_other" | "already_used" | "cooldown" | "same_category";

const DAY = 86_400_000;

/** 창고 페르소나 필터: 지정한 항목은 계정 페르소나와 같아야 한다('무관'은 통과) */
export function poolMatchesPersona(filter: PersonaFilter, persona: Persona | null): boolean {
  for (const key of ["age_group", "gender", "job"] as const) {
    const want = filter[key];
    if (!want || want === "any") continue;
    const have = persona?.[key];
    if (!have || have === "any") continue; // 계정이 '무관'이면 막지 않는다
    if (have !== want) return false;
  }
  return true;
}

/** 글 단위 페르소나 태그: 태그가 있으면 모두 계정 페르소나 값 중에 있어야 한다 */
export function itemMatchesPersona(tags: string[], persona: Persona | null): boolean {
  if (!tags.length) return true;
  const values = new Set([persona?.age_group, persona?.gender, persona?.job].filter(Boolean) as string[]);
  return tags.every((t) => t === "any" || values.has(t));
}

export function excludeReason(
  item: CandidateItem,
  ctx: { accountId: string; persona: Persona | null; lastCategory: string | null; pool: PoolRule; now: number },
): ExcludeReason | null {
  if (!itemMatchesPersona(item.personaTags, ctx.persona)) return "persona";
  if (item.usages.some((u) => u.accountId !== ctx.accountId)) return "used_by_other";
  const mine = item.usages.filter((u) => u.accountId === ctx.accountId);
  if (mine.length) {
    if (ctx.pool.reuseCooldownDays === null) return "already_used";
    const last = Math.max(...mine.map((u) => Date.parse(u.usedAt)));
    if (ctx.now - last < ctx.pool.reuseCooldownDays * DAY) return "cooldown";
  }
  if (ctx.lastCategory && item.category && item.category === ctx.lastCategory) return "same_category";
  return null;
}

export function eligibleItems(
  items: CandidateItem[],
  ctx: { accountId: string; persona: Persona | null; lastCategory: string | null; pools: Map<string, PoolRule>; now: number },
): CandidateItem[] {
  return items.filter((i) => {
    const pool = ctx.pools.get(i.poolId);
    if (!pool || !poolMatchesPersona(pool.personaFilter, ctx.persona)) return false;
    return excludeReason(i, { ...ctx, pool }) === null;
  });
}

/** weight 가중 랜덤 (weight 1 이하는 1로 본다) */
export function weightedPick<T extends { weight: number }>(items: T[], rnd = Math.random): T | null {
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + Math.max(1, i.weight), 0);
  let r = rnd() * total;
  for (const i of items) {
    r -= Math.max(1, i.weight);
    if (r < 0) return i;
  }
  return items[items.length - 1];
}

/** 재고 일수: 남은 글 ÷ 하루 소비량 */
export function stockDays(available: number, dailyNeed: number): number | null {
  if (dailyNeed <= 0) return null;
  return Math.floor(available / dailyNeed);
}
```

### `lib/farm/types.ts` — 농장 설정 형태

```ts
export type FarmKind = "growth" | "monetize";

/** campaigns.config */
export type FarmConfig = {
  kind: FarmKind;
  /** 하루 일상글 수(키우기 농장은 이것만) */
  dailyGeneralCount: number;
  /** 하루 상품글 수(수익화 농장) */
  dailyProductCount: number;
  generalSource: "ai" | "pool";
  poolId: string | null;
  assignTiming: "pre" | "at_publish";
  generatorId: string | null;
  productGeneratorId: string | null;
  productIds: string[];
  /** 상품 사진을 AI에게 보여 주고 쓰게 하기 */
  useVision: boolean;
  isAiLabel: boolean;
  mode: "review" | "auto";
  phase: "slots" | "fill" | "done";
  skipped?: number;
};

/** posts.ai_meta.farm (자리만 잡아 둔 글의 정보) */
export type FarmPostMeta = {
  type: "general" | "product";
  productId?: string | null;
  pickAtPublish?: boolean;
  issues?: string[];
};
```

### `lib/ai/prompt.ts` — 프롬프트 조립, 공통 규칙, JSON 스키마

```ts
/** 프롬프트 조립(순수 함수). 작업지시서 8장 "AI 생성" */
import type { JsonSchema } from "./types";

export type PersonaLite = { age_group: string | null; gender: string | null; job: string | null; tone: string | null };

export const AGE_LABEL: Record<string, string> = { "20s": "20대", "30s": "30대", "40s_early": "40대 초반", "40s_late": "40대 후반", any: "무관" };
export const GENDER_LABEL: Record<string, string> = { male: "남자", female: "여자", any: "무관" };
export const JOB_LABEL: Record<string, string> = { office: "직장인", self_employed: "자영업", business: "사업", homemaker: "주부", any: "무관" };

export const LENGTHS = [
  { key: "short", label: "짧게", instruction: "짧게: 1~3문장, 120자 안팎" },
  { key: "medium", label: "보통", instruction: "보통: 150~250자" },
  { key: "long", label: "길게", instruction: "길게: 300~450자, 줄바꿈으로 단락을 나눔" },
] as const;

export function describePersona(p: PersonaLite | null): string {
  if (!p) return "특별한 설정 없음. 평범한 한국인 개인 계정.";
  const parts = [
    p.age_group && p.age_group !== "any" ? AGE_LABEL[p.age_group] : null,
    p.gender && p.gender !== "any" ? GENDER_LABEL[p.gender] : null,
    p.job && p.job !== "any" ? JOB_LABEL[p.job] : null,
  ].filter(Boolean);
  const who = parts.length ? parts.join(" ") : "연령·성별·직업 무관";
  return `${who}${p.tone?.trim() ? `\n말투: ${p.tone.trim()}` : ""}`;
}

const list = (items: string[], empty: string) =>
  items.length ? items.map((t, i) => `${i + 1}. ${t.replace(/\s+/g, " ").slice(0, 300)}`).join("\n") : empty;

export type PromptVars = {
  count: number;
  persona: PersonaLite | null;
  topic: string;
  format: string;
  length: string;
  examples: string[];
  recentPosts: string[];
  extra?: string;
};

export function fillTemplate(template: string, v: PromptVars): string {
  const map: Record<string, string> = {
    count: String(v.count),
    persona: describePersona(v.persona),
    topic: v.topic,
    format: v.format,
    length: v.length,
    examples: list(v.examples, "(예시 없음)"),
    recent_posts: list(v.recentPosts, "(최근 글 없음)"),
  };
  let out = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in map ? map[k] : m));
  if (v.extra) out += `\n\n[추가 요청]\n${v.extra}`;
  return out;
}

/** 모든 생성기에 공통으로 붙는 규칙(시스템 프롬프트 뒤). 고정 문구라 앞부분 캐시에 유리 */
export const COMMON_RULES = `
[공통 규칙]
- 결과는 지정된 JSON 형식으로만 답한다.
- text 는 500자 이하(이모지는 4자로 계산). 해시태그 금지.
- 서로 다른 글끼리 첫 문장과 소재가 겹치지 않게 한다.
- 실제 사람이 쓴 것처럼 자연스럽게. AI·챗봇이라는 언급 금지.`;

export const POSTS_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "Threads 본문" },
          first_reply: { type: "string", description: "첫 댓글. 없으면 빈 문자열" },
          topic_tag: { type: "string", description: "커뮤니티 주제 한 단어(# 없이)" },
          category: { type: "string", description: "분류" },
        },
        required: ["text", "first_reply", "topic_tag", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["posts"],
  additionalProperties: false,
};

export function pickRandom<T>(arr: T[], rnd = Math.random): T | undefined {
  return arr.length ? arr[Math.floor(rnd() * arr.length)] : undefined;
}

export function sample<T>(arr: T[], n: number, rnd = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
```

### `lib/ai/validate.ts` — 생성 글 검사

```ts
/** 생성된 글 검사(순수 함수): 길이, 금칙어, 최근 글·서로 간 유사도 */
import { z } from "zod";
import { THREADS_TEXT_LIMIT, countThreadsChars } from "@/lib/threads/text";
import { SIMILARITY_WARN, similarity } from "@/lib/text/similarity";

export const generatedPostSchema = z.object({
  text: z.string(),
  first_reply: z.string().default(""),
  topic_tag: z.string().default(""),
  category: z.string().default(""),
});
export const generatedSchema = z.object({ posts: z.array(generatedPostSchema) });
export type GeneratedRaw = z.infer<typeof generatedPostSchema>;
export type GeneratedPost = GeneratedRaw & { issues: string[] };

export function cleanTopicTag(tag: string): string {
  return tag.replace(/^#/, "").replace(/[.&]/g, "").trim().slice(0, 50);
}

export function validateGenerated(posts: GeneratedRaw[], opts: { recent: string[]; banned: string[]; accepted?: string[] }): GeneratedPost[] {
  const accepted = [...(opts.accepted ?? [])];
  return posts.map((p) => {
    const text = p.text.trim();
    const issues: string[] = [];
    if (!text) issues.push("본문이 비어 있음");
    const n = countThreadsChars(text);
    if (n > THREADS_TEXT_LIMIT) issues.push(`본문 ${n}자로 ${THREADS_TEXT_LIMIT}자 초과`);
    if (countThreadsChars(p.first_reply) > THREADS_TEXT_LIMIT) issues.push("첫 댓글 500자 초과");
    if (/(^|\s)#[^\s#]+/.test(text)) issues.push("해시태그 포함");
    const lower = `${text}\n${p.first_reply}`.toLowerCase();
    const hits = opts.banned.filter((w) => w.trim() && lower.includes(w.trim().toLowerCase()));
    if (hits.length) issues.push(`금칙어: ${hits.join(", ")}`);
    const simRecent = opts.recent.find((r) => similarity(text, r) >= SIMILARITY_WARN);
    if (simRecent) issues.push(`최근 글과 비슷함: “${simRecent.slice(0, 30)}…”`);
    if (accepted.some((a) => similarity(text, a) >= SIMILARITY_WARN)) issues.push("같이 만든 글과 비슷함");
    if (!issues.length) accepted.push(text);
    return { text, first_reply: p.first_reply.trim(), topic_tag: cleanTopicTag(p.topic_tag), category: p.category.trim(), issues };
  });
}
```

### `lib/ai/pricing.ts` — AI 비용 계산

```ts
import type { ModelRef, Usage } from "./types";

/** 1M 토큰당 USD. 설정 > AI 에서 직접 입력한다(회사·모델마다 다르고 자주 바뀌므로) */
export type Price = { input: number; output: number; cached?: number };
export type PricingTable = Record<string, Price>;

export const priceKey = (m: ModelRef) => `${m.provider}:${m.model}`;

export function costUsd(usage: Usage, price: Price | undefined): number | null {
  if (!price) return null;
  const cached = Math.min(usage.cached, usage.input);
  const cachedPrice = price.cached ?? price.input;
  const usd = ((usage.input - cached) * price.input + cached * cachedPrice + usage.output * price.output) / 1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}
```

### `lib/ai/models.ts` — Gemini 모델 목록 거르기

```ts
/** 모델 목록 정리(순수 함수) */

/** "gemini-3.8-flash" → 3.8, 버전이 없으면 null */
export function geminiVersion(name: string): number | null {
  const m = /^gemini-(\d+(?:\.\d+)?)/.exec(name);
  return m ? Number(m[1]) : null;
}

/** Gemini: 3 버전 이상만, 최신 버전부터 */
export function filterGeminiModels(names: string[], minVersion = 3): string[] {
  return [...new Set(names)]
    .filter((n) => (geminiVersion(n) ?? 0) >= minVersion)
    .sort((a, b) => geminiVersion(b)! - geminiVersion(a)! || a.localeCompare(b));
}
```

### `lib/crypto/token.ts` — 토큰 암호화(AES-256-GCM)

```ts
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Threads 토큰 암호화 (AES-256-GCM).
 * 저장 형식: "v1.<iv b64url>.<tag b64url>.<ciphertext b64url>"
 * TOKEN_ENCRYPTION_KEY: base64로 인코딩된 32바이트 키 (openssl rand -base64 32)
 */
const VERSION = "v1";

function getKey(raw = process.env.TOKEN_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY 환경변수가 없습니다.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY는 base64로 인코딩된 32바이트여야 합니다.");
  }
  return key;
}

export function encryptToken(plain: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(rawKey), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptToken(enc: string, rawKey?: string): string {
  const [version, iv, tag, ct] = enc.split(".");
  if (version !== VERSION || !iv || !tag || ct === undefined) {
    throw new Error("암호화된 토큰 형식이 올바르지 않습니다.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
```

### `lib/auth/session.ts` — 세션 쿠키 서명(Web Crypto)

```ts
/**
 * 서명된 세션 쿠키 (HMAC-SHA256, Web Crypto).
 * Edge(middleware)와 Node 런타임 모두에서 동작한다.
 * 쿠키 값 형식: "v1.<만료 epoch 초>.<base64url 서명>"
 */
export const SESSION_COOKIE = "at_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET 환경변수가 없거나 32자 미만입니다.");
  }
  return secret;
}

function toBase64Url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** 길이와 무관하게 일정 시간 비교 */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + SESSION_MAX_AGE;
  const payload = `v1.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = await hmac(`${parts[0]}.${parts[1]}`);
  return safeEqual(parts[2], expected);
}
```

### `lib/calendar.ts` — KST 날짜 계산

```ts
/**
 * KST 기준 달력 계산. 날짜는 "yyyy-MM-dd" 문자열로 다룬다(시간대 혼동 방지).
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { APP_TZ } from "./time";

const DAY = 86_400_000;

function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)); // 정오(UTC)로 두면 날짜 경계 문제가 없다
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function isDayKey(v: string | undefined | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parse(v).getTime());
}
export const addDays = (day: string, n: number) => fmt(new Date(parse(day).getTime() + n * DAY));
export const weekday = (day: string) => parse(day).getUTCDay(); // 0=일
export const todayKst = (now = new Date()) => formatInTimeZone(now, APP_TZ, "yyyy-MM-dd");
export const dayKeyOf = (iso: string) => formatInTimeZone(new Date(iso), APP_TZ, "yyyy-MM-dd");
export const timeOf = (iso: string) => formatInTimeZone(new Date(iso), APP_TZ, "HH:mm");

export function addMonths(day: string, n: number): string {
  const d = parse(day);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
  return fmt(t);
}

/** 그 달을 덮는 6주(42일) 격자. 일요일 시작 */
export function monthGrid(anchor: string): string[] {
  const first = anchor.slice(0, 8) + "01";
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** anchor 가 속한 주(일~토) */
export function weekDays(anchor: string): string[] {
  const start = addDays(anchor, -weekday(anchor));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** KST 날짜 범위 [from 00:00, to 다음날 00:00) → UTC ISO */
export function kstRange(from: string, to: string): { start: string; end: string } {
  return {
    start: fromZonedTime(`${from}T00:00:00`, APP_TZ).toISOString(),
    end: fromZonedTime(`${addDays(to, 1)}T00:00:00`, APP_TZ).toISOString(),
  };
}
```

### `lib/csv.ts` — CSV 파서

```ts
/** RFC 4180 CSV 파서(따옴표, 따옴표 안 쉼표·줄바꿈, "" 이스케이프, BOM). 첫 줄은 머리글 */
export function parseCsv(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = input.replace(/^﻿/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim().toLowerCase());
  const rows = nonEmpty.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, rows };
}
```

### `lib/csv-images.ts` — CSV 사진 칸 짝짓기

```ts
/** CSV 의 사진 칸(images, reply_image)을 선택한 파일과 이름으로 짝짓기(순수 함수) */
export const CSV_MAX_IMAGES = 5;

/** 경로·대소문자·유니코드 조합 차이를 무시한 파일 이름 */
export function normalizeFileName(name: string): string {
  return name.trim().replace(/^.*[\\/]/, "").normalize("NFC").toLowerCase();
}

export function splitImages(cell: string | undefined): string[] {
  return (cell ?? "")
    .split(/[|;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type RowImagePlan = {
  index: number;
  images: string[];
  replyImage: string | null;
  missing: string[];
  error: string | null;
};

export function planRowImages(rows: Record<string, string>[], fileNames: string[]): { rows: RowImagePlan[]; needed: string[]; missing: string[] } {
  const have = new Set(fileNames.map(normalizeFileName));
  const needed = new Set<string>();
  const missingAll = new Set<string>();
  const out = rows.map((r, index) => {
    const images = splitImages(r.images);
    const replyImage = splitImages(r.reply_image)[0] ?? null;
    const refs = [...images, ...(replyImage ? [replyImage] : [])];
    const missing = refs.filter((n) => !have.has(normalizeFileName(n)));
    refs.forEach((n) => (have.has(normalizeFileName(n)) ? needed.add(normalizeFileName(n)) : missingAll.add(n)));
    let error: string | null = null;
    if (images.length > CSV_MAX_IMAGES) error = `본문 사진이 ${images.length}장입니다(최대 ${CSV_MAX_IMAGES}장).`;
    else if (splitImages(r.reply_image).length > 1) error = "첫 댓글 사진은 1장만 넣을 수 있습니다.";
    else if (missing.length) error = `없는 파일: ${missing.join(", ")}`;
    return { index, images, replyImage, missing, error };
  });
  return { rows: out, needed: [...needed], missing: [...missingAll] };
}

export const CSV_EXAMPLE = [
  "text,first_reply,topic_tag,category,images,reply_image",
  '"요즘 잘 쓰는 살림템 3가지\n1. 건조대\n2. 주걱\n3. 청소기",다들 뭐 쓰세요?,살림템,살림,item_1.jpg|item_2.jpg|item_3.jpg,item_reply.jpg',
  "비 오는 날엔 괜히 따뜻한 국물이 당긴다,,음식,음식,,",
].join("\r\n");
```

### `lib/db/url.ts` — Supabase URL 정규화

```ts
/**
 * 프로젝트 주소만 남긴다. "https://xxx.supabase.co/rest/v1/" 처럼 경로까지 붙여 넣으면
 * Supabase가 "Invalid path specified in request URL"을 돌려준다.
 */
export function normalizeSupabaseUrl(raw: string): string {
  const u = new URL(raw.trim());
  return `${u.protocol}//${u.host}`;
}
```

### `lib/errors.ts` — 화면용 에러 문구

```ts
/** 화면에 보여 줄 에러 문구(한국어). 검증 오류의 원본 데이터가 그대로 노출되지 않게 한다 */
import { z } from "zod";

const HANGUL = /[가-힣]/;

const GENERIC: Record<string, string> = {
  invalid_type: "값의 종류가 올바르지 않습니다",
  invalid_format: "형식이 올바르지 않습니다",
  too_small: "값이 너무 짧거나 작습니다",
  too_big: "값이 너무 길거나 큽니다",
  invalid_value: "허용되지 않는 값입니다",
  unrecognized_keys: "알 수 없는 항목이 있습니다",
  custom: "입력값을 확인하세요",
};

export function errorMessage(e: unknown): string {
  if (e instanceof z.ZodError) {
    const msgs = e.issues.map((i) => (HANGUL.test(i.message) ? i.message : `${GENERIC[i.code] ?? "입력값을 확인하세요"}${i.path.length ? ` (${i.path.join(".")})` : ""}`));
    return [...new Set(msgs)].join(" / ");
  }
  if (e instanceof Error) {
    if (e.message === "fetch failed" || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(e.message)) return "서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.";
    if (e.message === "로그인이 필요합니다.") return "로그인이 만료되었습니다. 새로고침 후 다시 로그인하세요.";
    return e.message;
  }
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
```

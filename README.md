# AUTO THREAD

한 명이 쓰는 Threads 예약·자동 발행 웹앱. Next.js 15 + Supabase + Vercel.

## 진행 상황

| 단계 | 내용 | 상태 |
|---|---|---|
| M1 | 프로젝트 기반, 디자인 시스템, 사이드바, 비밀번호 로그인, DB 스키마·seed | ✅ |
| M2 | Threads 계정 연결(OAuth), 토큰 암호화·갱신, 텍스트 글 테스트 발행 | ✅ |
| M3 | 글 작성 3단계, 미디어, 댓글, 링크, 고지, 예약, publish 크론 | ✅ |
| M4 | 예약한 글, 내가 올린 글, 활동 알림 | ✅ |
| M5 | AI 생성 (OpenAI / Gemini) | ✅ |
| M6 | 글 창고 | ✅ |
| M7 | 계정 키우기 농장, 수익화 농장, 자료실 | 구현 완료 · 실사용 확인 대기 |
| M8 | 대시보드 통계 | |
| M9 | 보석함, 정리, 마무리 | |

## 준비물

- Node.js 20 이상 (권장 22)
- [Supabase](https://supabase.com) 프로젝트 1개
- [Vercel](https://vercel.com) 계정 (Hobby 플랜)
- GitHub 저장소 (Vercel 배포용)
- (M2부터) Meta 개발자 계정과 Threads 앱
- (M5부터) Anthropic API 키

## 1. Supabase 설정

1. Supabase에서 새 프로젝트를 만든다. 리전은 **Northeast Asia (Seoul)** 권장.
2. 왼쪽 메뉴 **SQL Editor** → New query 에서 아래 파일을 **순서대로** 붙여 넣고 Run 한다.
   1. `supabase/migrations/0001_init.sql` — 테이블, 인덱스, RLS, `media` 버킷
   2. `supabase/seed.sql` — 기본 설정, 쿠팡 파트너스 고지 문구, 기본 생성기, 글 형식 5개, 주제 50개
      (여러 번 실행해도 중복되지 않는다)
   3. `supabase/migrations/0002_publish.sql` — 발행 상태 머신용 컬럼과 `claim_due_posts` 함수(M3)
      (다시 실행해도 안전하다)
   4. `supabase/migrations/0003_product_disclosure.sql` — 상품 홍보글 고지 문구 위치(첫 댓글 맨 앞) 허용
   5. `supabase/migrations/0004_reply_media.sql` — 댓글에 사진·영상 1개 첨부
   6. `supabase/migrations/0005_ai.sql` — AI 회사·모델 선택, 상품 홍보글 생성기
   7. `supabase/migrations/0006_pools.sql` — 창고 배정 정보, jobs 큐 잠금 함수, `call_cron` 대기 시간 인자
   8. `supabase/migrations/0007_pool_compose.sql` — 창고 글을 글 작성과 같은 형태로 저장
   9. `supabase/migrations/0008_farm.sql` — 농장 묶음(batch)·설정, 상품 사진
3. **Table Editor**에서 테이블 26개가 생겼고, **Storage**에 `media` 버킷(Public)이 생겼는지 확인한다.
4. **Project Settings → API** 에서 다음 값을 복사해 둔다.
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (**절대 공개 금지**)

> 모든 테이블에 RLS가 켜져 있고 정책이 없으므로 anon 키로는 아무것도 읽을 수 없다. 앱은 서버에서 service role 키로만 DB에 접근한다.
>
> Free 플랜의 업로드 파일 크기 상한은 50MB다. 큰 영상(최대 1GB)을 올리려면 Pro 플랜에서 Storage → Settings의 상한을 올려야 한다.

## 1-1. 주기 작업 등록 (pg_cron)

현재 등록되는 작업: `refresh-tokens`(매일 04:00 KST), `publish`(1분마다), `jobs`(1분마다, 응답 5분까지 대기), `pool-maintenance`(매일 02:00 KST).

1. Supabase → **Database → Extensions** 에서 `pg_cron`, `pg_net`을 켠다(SQL에서도 켜지만 권한 문제로 실패하면 여기서 켠다).
2. `supabase/cron.sql`을 SQL Editor에 붙여 넣고, `<APP_URL>`(배포 주소, 끝에 `/` 없이)과 `<CRON_SECRET>`(Vercel의 같은 값)을 바꾼 뒤 Run.
3. 확인: `select jobname, schedule, active from cron.job;`
4. 단계가 진행되면 cron.sql의 주석 처리된 작업이 하나씩 열린다. 파일을 다시 실행하면 된다(같은 이름은 덮어씀).

비밀값은 Supabase Vault(`app_url`, `cron_secret`)에 저장된다. `CRON_SECRET`을 바꾸면 Vercel과 cron.sql 둘 다 다시 맞춘다.

## 1-2. Threads 앱 설정 (Meta)

1. https://developers.facebook.com/apps → **앱 만들기** → 사용 사례에서 **Threads API 액세스**를 고른다.
2. **사용 사례 → Threads API → 맞춤 설정(Customize)**
   - 권한: `threads_basic`, `threads_content_publish`, `threads_manage_insights`, `threads_manage_replies` 추가
   - **설정(Settings)**: 리디렉션 콜백 URL에 `https://<배포주소>/api/threads/oauth/callback` 입력 후 저장
     (제거 콜백·삭제 콜백 URL도 필수 입력이면 같은 주소를 넣어도 된다)
3. **앱 설정 → 기본 설정**에서 **Threads 앱 ID**와 **Threads 앱 시크릿**을 복사한다.
   앱 ID·시크릿이 두 쌍 보이면 반드시 "Threads"가 붙은 쪽을 쓴다.
4. **앱 역할 → 역할 → 사람 추가 → Threads 테스터**로 연결할 계정을 초대하고,
   각 계정에서 Threads **설정 → 계정 → 웹사이트 권한 → 초대**에서 수락한다.
5. Vercel 환경변수에 `THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`를 넣고 **Redeploy**.
6. 앱의 **설정 → Threads 계정 → 계정 연결** → 테스트 발행.

> **`TOKEN_ENCRYPTION_KEY`는 반드시 따로 백업한다.** 잃어버리면 저장된 토큰을 복호화할 수 없어 모든 계정을 다시 연결해야 한다.
>
> 토큰 정책(공식 문서): 장기 토큰 60일, 발급 24시간 이후부터 갱신 가능. 공개 프로필은 갱신 시 권한이 90일 연장되지만
> **비공개 프로필은 90일마다 다시 연결**해야 한다. 앱은 매일 04:00(KST)에 만료 7일 이내 토큰을 갱신하고, 실패하면 "재연결 필요"로 표시한다.

## 2. 환경변수

`.env.example`을 `.env.local`로 복사하고 값을 채운다.

```bash
cp .env.example .env.local
```

무작위 값 생성:

```bash
openssl rand -base64 48   # SESSION_SECRET
```

```bash
openssl rand -hex 32      # CRON_SECRET
```

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
```

| 변수 | 필요 단계 | 설명 |
|---|---|---|
| `APP_PASSWORD` | M1 | 로그인 비밀번호 |
| `SESSION_SECRET` | M1 | 세션 쿠키 서명 키(32자 이상) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | M1 | Supabase 접속 정보 |
| `SUPABASE_SERVICE_ROLE_KEY` | M1 | 서버 전용 DB 키 |
| `STORAGE_BUCKET` | M3 | 기본 `media` |
| `CRON_SECRET` | M1 | `/api/cron/*` 호출 인증 |
| `THREADS_APP_ID` / `THREADS_APP_SECRET` / `THREADS_REDIRECT_URI` | M2 | Threads 앱 정보 |
| `TOKEN_ENCRYPTION_KEY` | M2 | Threads 토큰 암호화(AES-256-GCM) |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | M5 | (선택) AI 키. **앱의 설정 > AI 에서 등록하는 것을 권장**하며, 거기 등록한 키가 우선한다 |
| `APP_TIMEZONE` | – | 기본 `Asia/Seoul` |

## 3. 로컬 실행

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 접속 → `APP_PASSWORD`로 로그인.

## 4. Vercel 배포

1. 이 프로젝트를 GitHub 저장소에 push 한다.
2. Vercel → Add New → Project → 저장소 Import (Framework: Next.js 자동 인식).
3. **Environment Variables**에 `.env.local`의 값을 모두 입력한다(Production).
4. Deploy. 배포 주소(예: `https://auto-thread-xxx.vercel.app`)를 기록해 둔다. M2의 `THREADS_REDIRECT_URI`와 M3의 `cron.sql`에 쓴다.
5. Vercel Cron은 쓰지 않는다. 주기 작업은 Supabase pg_cron이 호출한다.

## 발행 동작 (M3)

- 글 작성(`/compose`): 설정 → 작성 → 발행. 작성 중에는 오른쪽(모바일은 하단 탭)에 Threads 모양 미리보기가 나온다.
- 사진·영상은 브라우저에서 바로 Supabase Storage(`media/uploads/…`)로 올라간다. HEIC·WebP는 JPEG로 바뀌고 가로 1440px로 줄어든다.
- 미디어가 있으면 링크는 자동으로 첫 댓글로 간다(Threads의 링크 미리보기는 텍스트 글에서만 동작).
- 고지 문구 위치: 본문 끝 / 링크 댓글 / 별도 댓글. 본문에 넣으면 고지 문구까지 500자에 포함해 검사한다.
- 댓글마다 사진·영상 1개를 붙일 수 있다. 글자만 있는 글·댓글은 Threads가 첫 링크를 미리보기 카드로 만들기 때문에(끄는 옵션 없음), 링크 댓글에 사진을 붙이면 카드 없이 링크만 보인다. 「첫 댓글에 본문 첫 사진 붙이기」 옵션(상품 홍보글은 기본 켜짐).
- 상품 홍보글은 고지 문구가 항상 **첫 댓글 맨 앞**에 들어간다(고지 문구 + 댓글 내용 + 링크). 기본 고지 문구가 자동 선택된다.
- 1분마다 `publish` 작업이 예약 시간이 된 글을 잠그고(중복 발행 방지) 컨테이너 생성 → 상태 확인 → 발행 → 댓글 순으로 진행한다.
  같은 회차에 여러 글이 있으면 30초~2분 간격으로 나눠 올린다.
- 실패하면 1분 → 5분 뒤 재시도하고, 3번째 실패하면 `failed`로 바꾸고 활동 알림을 남긴다. 토큰 오류는 바로 실패 + 재연결 필요 표시.
- 직접 올린 첨부는 발행 30일 뒤 삭제 대상으로 표시된다(실제 삭제는 M9 cleanup).

## 발행 관리 (M4)

- **예약한 글**(`/scheduled`): 목록 / 월 / 주 보기, 계정·상태 필터. 글을 누르면 오른쪽에 상세와 관리 버튼(시간 변경, 수정, 예약 취소, 재시도, 삭제).
  - 최소 간격 안에 겹친 예약은 주황색으로 표시한다.
  - 시간 변경 시 겹치면 「가까운 빈 시간으로」 / 「그대로 변경」을 고른다.
  - 재시도: 본문 실패면 처음부터 다시(원래 시간이 지났으면 바로), 댓글만 실패했으면 남은 댓글만 다시 올린다.
- **내가 올린 글**(`/published`): 발행된 글, 성과(조회·좋아요·댓글·리포스트, M8부터 채워짐), Threads 링크, ★ 보석함 저장.
- **활동**(`/activity`): 알림 목록, 읽지 않음·종류·수준 필터, 누르면 읽음 처리 후 해당 화면으로 이동, 모두 읽음.
- 사이드바 배지: 활동(읽지 않은 알림 수), 예약한 글(실패한 글 수).

## AI 글 생성 (M5)

- 지원 회사: **OpenAI(GPT)**, **Google Gemini**. `lib/ai/providers/*` 에 회사별 구현이 있고, 앱 코드는 `lib/ai` 의 공통 형태만 쓴다.
- 설정 > AI
  - **API 키 등록**: 키를 붙여넣고 저장하면 모델 목록을 불러와 키가 맞는지 확인한 뒤 `TOKEN_ENCRYPTION_KEY`로 암호화해 `app_settings.ai_keys`에 저장한다. 다시 배포할 필요 없음. 화면에는 끝 4자리만 보인다. 등록한 키가 없으면 Vercel 환경변수 키를 쓴다.
  - 모델 칸(기본 모델·생성기)은 그 회사의 모델 목록에서 고른다(목록에 없으면 「직접 입력」). Gemini 는 3 버전 이상만 보여 준다.
  - 기본 모델·생성기를 저장할 때 짧은 시험 호출로 **실제로 쓸 수 있는 모델인지 확인**하고, 안 되면 저장하지 않고 이유를 보여 준다.
  - 기본 모델: 글쓰기용 / 사진 이해용(수익화 농장).
  - 모델 단가: 1M 토큰당 USD를 **직접 입력**한다(회사·모델마다 다르고 자주 바뀐다). 비우면 비용을 계산하지 않는다.
  - 이번 달 AI 비용(입력한 단가로 계산한 추정치), AI 생성기 추가·수정·복제(새 버전)·삭제. 생성기마다 회사·모델을 따로 고를 수 있다.
- 설정 > 주제·형식: 주제 풀(여러 줄 붙여넣기 지원)과 글 형식 관리. 설정 > 계정: 계정별 페르소나.
- 글 작성 1단계에서 「AI로 만들기」 → 생성기·주제(비우면 랜덤, 상품이면 상품명·특징). 2단계 「AI 후보」에서 1~5개씩 만들고 비교해 「적용」.
- 프롬프트 = 생성기 시스템 프롬프트 + 공통 규칙 + 페르소나 + 주제(최근 안 쓴 것 중 랜덤) + 글 형식(랜덤) + 길이(랜덤) + 보석함 예시 + 이 계정 최근 글 15개.
- 결과는 JSON 스키마로 강제하고, 길이·금칙어·해시태그·유사도 검사에 떨어진 글만 한 번 더 만든다. 그래도 남은 문제는 후보에 경고로 표시한다.
- 호출마다 토큰 수와 비용을 `generation_logs` 에 남긴다. 실패하면 활동에 알림.
- 고정된 시스템 프롬프트를 맨 앞에 두어 두 회사의 자동 프롬프트 캐시가 잘 맞도록 했다(별도 설정 없음).

## 글 창고 (M6)

- `/pools`: 창고 목록과 재고(「남은 글 N개 · 약 N일 분량」, 기준 일수보다 적으면 주황색). 하루 소비량은 이 창고를 쓰는 진행 중 캠페인의 하루 게시 수 합 → 없으면 최근 7일 평균 사용량 → 없으면 연결 계정 수(하루 1개)로 계산한다.
- `/pools/[id]`: 창고 설정(이름, 설명, 연결 계정, 페르소나 필터, 재고 부족 기준, 재사용 금지 기간, 자동 보충과 생성기), 글 채우기 4가지, 글 목록(상태 필터, 검색, 선택 후 승인·보관·검수 대기로·삭제, 펼쳐서 수정).
  - AI 일괄 생성: 1회 호출로 최대 20개. jobs 큐로 처리하고 진행률을 화면에서 보여 준다(화면을 떠나도 계속). 주제를 비우면 주제 풀에서 여러 개를 뽑아 글마다 다르게 쓰게 한다. 검사를 통과한 글만 넣는다.
  - 직접 작성: 글 작성과 같은 편집 화면(`/pools/[id]/items/new`, 수정은 `/pools/[id]/items/[itemId]`)에서 사진·영상, 댓글 여러 개(댓글 사진), 링크, 고지 문구, 커뮤니티 주제, AI 표시까지 준비하고 모바일 미리보기로 확인한다. 창고 사진은 `media/assets/…` 에 올라가 자동 삭제되지 않는다. 꺼낼 때 이 내용이 그대로 글 작성에 들어간다.
  - CSV 가져오기: `images`(본문 사진, 최대 5장, `|` 구분)와 `reply_image`(첫 댓글 사진 1장) 칸에 **파일 이름**을 적고, CSV와 함께 그 사진 파일들을 고르면 이름(대소문자·경로 무시)으로 짝지어 브라우저에서 변환·업로드(`media/assets/…`)한다. 없는 파일·5장 초과 줄은 미리보기에서 알려 주고 빼고 가져온다. 화면에서 예시 CSV를 내려받을 수 있다.
  - (기존 열)(`text`, `first_reply`, `topic_tag`, `category` 열), 보석함에서 옮기기.
- 랜덤 선택(`lib/pool/select.ts`, 단위 테스트 있음)
  - 후보: 계정에 연결된 창고의 사용 가능 글 중 창고 페르소나 필터·글의 persona_tags 가 계정 페르소나와 맞는 것.
  - 제외: 다른 계정이 이미 쓴 글, 재사용 금지 기간 안의 글(비어 있으면 한 번 쓴 글은 다시 안 씀), 이 계정 직전 글과 같은 분류.
  - 가중치(weight) 랜덤. 배정은 "지금도 사용 가능일 때만 예약됨으로 바꾸기"(조건부 업데이트)라 동시에 같은 글을 두 곳에 주지 않는다.
  - 발행되면 사용 기록을 남기고, 재사용 금지 기간이 없으면 사용 완료·있으면 다시 사용 가능(기간 동안은 규칙이 막음). 예약을 취소하면 창고로 돌아간다.
  - 맞는 글이 없으면 설정(글 설정 > 일반 설정)에 따라 건너뛰기 또는 AI 즉석 생성. 둘 다 활동 알림.
- 글 작성 1단계 「글 창고에서 가져오기」 → 2단계 「랜덤으로 뽑기 / 다른 글 뽑기」. 창고 글의 전체 내용(사진·댓글·링크·고지 문구 등)이 들어간다.
- 창고 삭제: 목록 카드의 ⋯ 메뉴 또는 상세 화면의 「삭제」. 이 창고 글로 예약된 게시물이 있으면 막는다.
- 매일 02:00 `pool-maintenance`: 재고 부족 알림, 자동 보충(생성기로 20개, 바로 사용 가능), 48시간 넘게 쓰이지 않은 배정 풀기.

## 농장과 자료실 (M7)

- **자료실**(`/assets`): 상품 사진·영상을 묶음(이름, 카테고리, 메모)으로 관리, 검색·카테고리 필터. 파일은 `media/assets/…` 에 보관(자동 삭제 없음).
  묶음의 「글로 만들기」 → 글 작성이 사진이 붙은 상태·AI 모드·상품 홍보로 열린다. AI 후보에서 「첨부한 사진을 AI에게 보여 주고 쓰기」(사진 이해 모델).
  글 작성·창고 글 편집·상품 등록의 「자료실에서 고르기」로 묶음에서 사진을 골라 붙일 수 있다.
- **계정 키우기 농장**(`/farm/growth`): 계정(여러 개, 계정마다 하루 게시 수 — 팔로워 구간표로 추천), 시작일, 기간(1~30일), 활동 시간대, 글 출처(AI 새로 생성 / 글 창고 랜덤 — 미리 배정 또는 발행 직전 뽑기), 진행 방식(검토 / 자동).
- **수익화 농장**(`/farm/monetize`): 상품 등록(사진, 상품명, 제휴 링크, 고지 문구, 특징). 계정마다 하루 일상글·상품글 수를 정하면 하루 안에서 섞어 배치하고, 상품은 시간순으로 돌아가며 쓴다.
  상품글은 AI가 상품 사진(최대 3장)과 상품명·특징을 보고 본문과 첫 댓글을 쓰고, **링크와 고지 문구는 서버가 그대로** 첫 댓글에 붙인다(고지 문구 + 댓글 + 링크, 첫 댓글에 상품 사진 → 미리보기 카드 없음).
- 만들기는 jobs 큐 작업(`farm_build`)으로 처리한다: ① 시간 배치(`lib/scheduler/slots.ts`, 단위 테스트) → 자리 잡기 ② 내용 채우기(AI는 20개씩, 창고는 규칙대로 뽑기). 시간이 모자라면 다음 실행에서 이어서 한다.
  - 시간 배치: 활동 시간대를 하루 게시 수로 나누고 ±(간격의 30%, 최대 20분) 랜덤, 같은 계정 최소 간격, 계정 간 최소 간격, 계정·전역 하루 상한, 이미 잡힌 예약을 모두 지킨다. 못 넣은 자리 수는 농장 화면에 표시.
  - 검토 모드: 글이 「검토 대기」로 만들어지고, 농장 화면(`/farm/batch/[id]`)에서 확인·수정(✎ → 글 작성) 후 「예약 확정」. 자동 모드: 바로 예약(검사에 걸린 글만 검토 대기).
  - 발행 직전 뽑기: 시간만 예약해 두고, 발행할 때 발행 작업이 창고에서 뽑아 채운다(없으면 설정대로 건너뛰기/AI 즉석 생성).
  - 농장 취소: 발행 전 글을 모두 취소하고 창고 글은 되돌린다(농장은 목록에 「취소됨」으로 남음).
  - 농장 삭제(목록의 🗑 또는 상세 화면): 농장과 만들기 작업, 발행되지 않은 글을 지운다(창고 글은 되돌림). 이미 발행된 글은 「내가 올린 글」에 남기고 농장 연결만 끊는다. 발행 중인 글이 있으면 막는다.
- 설정 > 글 설정 > 팔로워 구간별 권장 게시 수.

## 테스트

```bash
npm test
```

발행 상태 머신은 메모리 DB와 가짜 Threads API로 시나리오 테스트를 한다(`tests/publisher.test.ts`).

## 보안 구조

- 로그인: `APP_PASSWORD` 비교 후 HMAC 서명 httpOnly 쿠키(30일) 발급. `middleware.ts`가 `/login`, `/api/cron/*` 외 모든 경로를 보호한다.
- `/api/cron/*`: `Authorization: Bearer ${CRON_SECRET}` 헤더가 없으면 401.
- 비밀값은 서버 코드(`lib/env.ts`, `server-only`)에서만 읽는다.

## 폴더 구조

```
app/(auth)/login          로그인
app/(main)/...            로그인 후 화면들 (사이드바 레이아웃)
components/ui             shadcn/ui 스타일 기본 컴포넌트 (+ Chip)
components/layout         사이드바, 앱 셸, 페이지 헤더
lib/auth                  세션 쿠키 서명/검증
lib/crypto                토큰 암호화(AES-256-GCM)
lib/threads               Threads API 클라이언트, 계정·토큰 관리, 글자 수 계산
lib/notify                활동 알림 저장
lib/ai                    AI 공통 형태, 회사별 구현(openai/gemini), 프롬프트, 검사, 생성
lib/compose               작성 내용 검증(zod)·발행 형태 변환·저장
lib/publisher             발행 상태 머신(/api/cron/publish)
lib/pool                  창고 선택 규칙(select), 배정·사용 기록·재고(pick), 매일 정리(maintenance)
lib/jobs                  jobs 큐와 작업 처리기
lib/farm                  농장 만들기(build), 발행 직전 뽑기(at-publish), 화면 데이터
components/farm           농장 폼·목록·상세, 상품
components/assets         자료실, 자료실 고르기 창
lib/scheduler             예약 충돌 검사, 가까운 빈 시간 찾기
lib/media                 브라우저 이미지 변환·업로드
components/compose        글 작성 화면
components/preview        모바일 미리보기
components/settings       설정 화면 구성요소
tests                     단위 테스트(vitest): npm test
lib/db                    Supabase service role 클라이언트
lib/env.ts                서버 환경변수 검증(zod)
supabase/migrations       스키마 SQL
supabase/seed.sql         기본 데이터
supabase/cron.sql         pg_cron 주기 작업 등록
```

## 참고

- shadcn/ui 컴포넌트는 `components.json` 설정에 맞춰 직접 추가했다. 추가 컴포넌트는 `npx shadcn@latest add <이름>`으로 넣을 수 있다.
- 디자인 토큰은 `app/globals.css`의 `:root`에 있다(배경 #F7F5F0, 포인트 #E8590C).

# 작업지시서: AUTO THREAD 사이트 하나 더 구축하기

> 이 문서는 이미 완성된 AUTO THREAD(M1~M9)를 **두 번째 사이트**로 하나 더 띄우기 위한 작업지시서다.
> 새 Claude Code 세션에 이 파일과 `README.md`, `CLAUDE.md`(원래 작업지시서)를 함께 읽게 한 뒤 시작한다.
> 코드를 새로 만드는 작업이 아니라, **같은 코드를 새 DB·새 배포·새 비밀값으로 한 벌 더 설치하는 작업**이다.

---

## 0. 목표와 결과물

- 결과물: 기존 사이트(1호)와 **데이터가 완전히 분리된** 2호 사이트
  - 별도 Supabase 프로젝트(DB·파일 저장소·주기 작업)
  - 별도 Vercel 프로젝트(배포 주소)
  - 별도 비밀번호·비밀값
- 1호 사이트의 데이터, 계정 연결, 예약 글에는 **아무 영향이 없어야 한다.**
- 완료 기준(모두 통과해야 끝):
  1. 2호 주소에서 로그인된다.
  2. 설정 → 계정에서 Threads 계정이 연결되고 테스트 발행이 된다.
  3. 예약한 글이 시간에 맞춰 자동 발행된다(`publish` 주기 작업 동작).
  4. 설정 → AI에서 키 등록·모델 확인 후 AI 글 생성이 된다.
  5. 다음 날 대시보드에 통계가 들어온다(`sync-stats`).

---

## 1. 작업 규칙 (원래 작업지시서 규칙 그대로)

1. 한 단계씩 진행하고, 단계마다 **사용자가 할 일 → 확인 방법**을 알려 준 뒤 멈춘다.
2. 이 문서와 다르게 하려면 먼저 사용자에게 묻는다.
3. **비밀값(API 키, 토큰, service role key, 비밀번호)은 절대 브라우저 코드나 Git에 넣지 않는다.** Vercel 환경변수·Supabase Vault·앱 설정 화면에만 넣는다. 채팅에 붙여 넣으라고 요구하지 않는다.
4. **1호와 2호의 비밀값을 섞어 쓰지 않는다.** 특히 `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SESSION_SECRET`은 새로 만든다.
5. 구현하지 않는 것(변함없음): 프록시/IP 우회, 기기 지문 위장, 비공식 로그인 자동화, 타인 게시물 자동 수집.
6. 이 작업에는 **코드 수정이 필요 없다.** 사용자가 2호만의 기능 변경을 요청하면 먼저 아래 「4. 코드 관리 방식」을 함께 정한 뒤 진행한다.
7. 사용자 화면 안내는 한국어, 메뉴 이름은 실제 화면에 보이는 그대로 쓴다.

---

## 2. 시작 전에 정할 것 (사용자에게 먼저 묻기)

| 질문 | 선택지 | 권장 |
|---|---|---|
| 2호는 누가 쓰나? | 나 혼자 / 다른 사람 | — |
| 코드 관리 | ① 같은 GitHub 저장소를 Vercel 프로젝트 2개가 함께 사용 ② 저장소를 복사해 따로 관리 | 나 혼자면 ①, 다른 사람 것이면 ② |
| Meta(Threads) 앱 | ① 1호 앱에 리디렉션 주소만 추가 ② 새 앱 만들기 | 나 혼자면 ①, 다른 사람 것이면 ② |
| AI 키 | 1호와 같은 키 / 새 키 | 비용을 따로 보려면 새 키 |

### 선택지 설명

- **코드 ① 같은 저장소**: `main`에 push 하면 1호·2호가 동시에 업데이트된다. 대신 새 마이그레이션 SQL은 **두 Supabase에 각각** 실행해야 한다.
- **코드 ② 저장소 복사**: GitHub에서 새 저장소를 만들어 코드를 복사(또는 fork). 2호만 다르게 고칠 수 있지만, 1호에서 고친 내용을 2호에 옮기는 일은 따로 해야 한다.
- **Meta ① 같은 앱**: 테스터 계정 한도(최대 50개)를 1호·2호가 나눠 쓴다. 앱 ID·시크릿은 같고, 리디렉션 콜백 URL만 하나 더 등록한다.
- **Meta ② 새 앱**: 계정 한도와 권한이 완전히 분리된다. 다른 사람이 쓰는 사이트라면 그 사람의 Meta 개발자 계정으로 만드는 것이 맞다.

---

## 3. 작업 단계

### 단계 1. Supabase 새 프로젝트

1. Supabase → New project. 이름 예: `auto-thread-2`, 리전 **Northeast Asia (Seoul)**.
   - Free 플랜은 조직당 활성 프로젝트가 2개까지다. 이미 2개면 다른 조직을 만들거나 유료 플랜이 필요하다.
   - DB 비밀번호는 새로 만들어 따로 보관한다.
2. **SQL Editor**에서 아래 파일을 **순서대로** 실행한다(README 「1. Supabase 설정」과 같은 순서).
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/seed.sql`
   3. `0002_publish.sql` → `0003_product_disclosure.sql` → `0004_reply_media.sql` → `0005_ai.sql`
      → `0006_pools.sql` → `0007_pool_compose.sql` → `0008_farm.sql` → `0009_cleanup.sql`
   - 이후 저장소에 새 마이그레이션이 추가되었으면 그것도 번호 순서대로 실행한다.
3. 확인: Table Editor에 테이블 26개, Storage에 `media` 버킷(Public).
4. **Project Settings → API**에서 Project URL, `anon` 키, `service_role` 키를 복사해 둔다(1호 값과 헷갈리지 않게 「2호」라고 적어 둔다).

**확인 방법**: SQL Editor에서 `select count(*) from information_schema.tables where table_schema = 'public';` → 26 이상.

### 단계 2. 새 비밀값 만들기

터미널(또는 아무 무작위 문자열 생성기)로 **새 값**을 만든다. 1호 값을 재사용하지 않는다.

```bash
openssl rand -base64 48   # SESSION_SECRET
```

```bash
openssl rand -hex 32      # CRON_SECRET
```

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
```

- `APP_PASSWORD`(로그인 비밀번호)도 1호와 다르게 정한다.
- 이 값들은 비밀번호 관리자 등에 **「AUTO THREAD 2호」** 이름으로 백업한다. 특히 `TOKEN_ENCRYPTION_KEY`를 잃으면 2호의 모든 계정을 다시 연결해야 한다.

### 단계 3. Vercel 새 프로젝트

1. Vercel → **Add New → Project** → 저장소 Import
   - 코드 ①: 1호와 같은 `ikhjeon00/auto-thread`를 한 번 더 Import 하고, 프로젝트 이름만 다르게(예: `auto-thread-2`).
   - 코드 ②: 새로 만든 저장소를 Import.
2. **Environment Variables**에 아래를 입력한다(Production). 이 단계에서는 Threads 값을 비워 두고 먼저 배포해도 된다.

| 변수 | 값 |
|---|---|
| `APP_PASSWORD` | 2호 로그인 비밀번호 |
| `SESSION_SECRET` | 단계 2에서 만든 새 값 |
| `NEXT_PUBLIC_SUPABASE_URL` | 2호 Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 2호 anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 2호 service_role 키 |
| `CRON_SECRET` | 단계 2에서 만든 새 값 |
| `TOKEN_ENCRYPTION_KEY` | 단계 2에서 만든 새 값 |
| `THREADS_APP_ID` / `THREADS_APP_SECRET` | 단계 5에서 입력 |
| `THREADS_REDIRECT_URI` | `https://<2호 배포주소>/api/threads/oauth/callback` (단계 5에서 입력) |

3. Deploy → 배포 주소(예: `https://auto-thread-2-xxx.vercel.app`)를 기록한다.

**확인 방법**: 2호 주소에 접속 → 로그인 화면 → 2호 `APP_PASSWORD`로 로그인 → 대시보드가 빈 상태로 열린다.

### 단계 4. 주기 작업 등록 (2호 Supabase에서)

1. 2호 Supabase → **Database → Extensions**에서 `pg_cron`, `pg_net` 켜기.
2. `supabase/cron.sql`을 2호 SQL Editor에 붙여 넣고 두 자리를 바꾼 뒤 Run.
   - `<APP_URL>` → **2호** 배포 주소(끝에 `/` 없이)
   - `<CRON_SECRET>` → **2호** `CRON_SECRET`
3. 확인: `select jobname, schedule, active from cron.job;` → 7줄(`refresh-tokens`, `publish`, `jobs`, `pool-maintenance`, `sync-stats`, `sync-stats-3h`, `cleanup`).
4. 1~2분 뒤 `select status_code, content from net._http_response order by created desc limit 5;` → `200`이면 정상, `401`이면 `CRON_SECRET` 불일치.

> 주의: 1호 Supabase의 `cron.sql`을 2호 주소로 바꿔 실행하면 1호 발행이 멈춘다. 반드시 **2호 Supabase**에서 실행한다.

### 단계 5. Threads 앱 연결

- **Meta ① 같은 앱 사용**
  1. developers.facebook.com → 1호 앱 → **사용 사례 → Threads API → 설정**의 리디렉션 콜백 URL에 2호 주소 `https://<2호>/api/threads/oauth/callback`을 **추가**(입력 후 Enter로 칩이 생겨야 함) → 저장. 1호 주소는 지우지 않는다.
  2. Vercel 2호 환경변수에 1호와 같은 `THREADS_APP_ID`, `THREADS_APP_SECRET`과 2호용 `THREADS_REDIRECT_URI` 입력.
- **Meta ② 새 앱**
  1. README 「1-2. Threads 앱 설정」을 그대로 따라 새 앱을 만든다(권한 4개, 리디렉션 URL = 2호 주소).
  2. 새 앱의 **Threads 앱 ID·시크릿**을 2호 Vercel 환경변수에 입력.
- 공통: 연결할 계정을 **Threads 테스터**로 초대 → 각 계정에서 수락.
- Vercel 2호 → Deployments → **Redeploy**(환경변수 반영).

**확인 방법**: 2호 앱 → 설정 → 계정 → 계정 연결 → 테스트 발행 성공.

> 같은 Threads 계정을 1호와 2호에 동시에 연결해도 동작은 하지만, 두 사이트가 서로의 예약을 모르기 때문에 발행 간격·하루 한도 검사가 따로 계산된다. **한 계정은 한 사이트에서만 쓰는 것을 권장**한다.

### 단계 6. 앱 안의 초기 설정

1. 설정 → **AI**: API 키 등록 → 「확인」 → 기본 모델 선택 → 저장.
2. 설정 → **작성**: 고지 문구, 금지어, 최소 발행 간격 확인(seed 기본값이 들어 있다).
3. 설정 → **주제**: 필요하면 수정.
4. 1호에서 쓰던 생성기·창고 글·상품을 옮기고 싶으면:
   - 창고 글: 1호에서 내보낼 기능은 없으므로, CSV(`text`, `first_reply`, `topic_tag`, `category`)를 만들어 2호 창고에서 「CSV 가져오기」.
   - 생성기·상품: 2호 화면에서 다시 입력한다.
   - DB를 통째로 복사하는 방법은 쓰지 않는다(암호화된 토큰은 키가 달라 2호에서 쓸 수 없다).

### 단계 7. 최종 확인

| 확인 | 방법 |
|---|---|
| 예약 발행 | 5분 뒤로 예약한 글이 시간에 맞춰 올라가는지 |
| AI 생성 | 글 작성 → AI로 생성 |
| 창고·농장 | 창고에 AI 5개 채우기 → 진행률이 끝까지 가는지(`jobs` 주기 작업) |
| 통계 | 다음 날 대시보드 그래프, 또는 SQL `select public.call_cron('sync-stats');` 후 새로고침 |
| 1호 이상 없음 | 1호 사이트에 로그인해 예약한 글·대시보드가 그대로인지 |

---

## 4. 코드 관리 방식 (구축 후)

- **코드 ① 같은 저장소**
  - 코드를 고치면 1호·2호 모두 자동 재배포된다.
  - 새 마이그레이션 파일이 생기면 **1호와 2호 Supabase 둘 다**에서 실행한다(모든 마이그레이션은 다시 실행해도 안전).
  - 2호에만 다른 동작이 필요하면 코드 분기 대신 환경변수·설정값으로 처리할 수 있는지 먼저 검토하고, 안 되면 사용자에게 ②로 바꿀지 묻는다.
- **코드 ② 저장소 복사**
  - 각 저장소가 독립적이다. 한쪽에서 고친 내용을 다른 쪽에 옮길 때는 변경 파일과 마이그레이션을 함께 옮긴다.

## 5. 백업 체크리스트 (2호 전용)

- [ ] `APP_PASSWORD`
- [ ] `SESSION_SECRET`
- [ ] `CRON_SECRET`
- [ ] `TOKEN_ENCRYPTION_KEY` (**가장 중요**)
- [ ] Supabase DB 비밀번호, Project URL, anon 키, service_role 키
- [ ] Threads 앱 ID·시크릿(새 앱을 만든 경우)
- [ ] 2호 배포 주소

## 6. 문제가 생기면

README 「운영 안내 → 문제 해결」 표를 먼저 본다. 2호에서 특히 자주 생기는 실수:

| 증상 | 원인 |
|---|---|
| 계정 연결 시 리디렉션 오류 | Meta 앱에 2호 콜백 주소가 없음, 또는 `THREADS_REDIRECT_URI`가 1호 주소로 들어감 |
| 예약 글이 안 올라감, 응답 401 | 2호 `cron.sql`의 `<CRON_SECRET>`이 2호 Vercel 값과 다름 |
| 1호 발행이 갑자기 멈춤 | 1호 Supabase에서 `cron.sql`을 2호 주소로 실행함 → 1호 주소로 다시 실행 |
| 「화면을 불러오지 못했습니다」 | 2호 Vercel에 1호 Supabase 값이 들어가 있거나 환경변수 누락 |
| 연결된 계정이 모두 「재연결 필요」 | `TOKEN_ENCRYPTION_KEY`를 바꿈 → 원래 값으로 되돌리거나 다시 연결 |

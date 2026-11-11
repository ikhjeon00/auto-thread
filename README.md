# AUTO THREAD

한 명이 쓰는 Threads 예약·자동 발행 웹앱. Next.js 15 + Supabase + Vercel.

## 진행 상황

| 단계 | 내용 | 상태 |
|---|---|---|
| M1 | 프로젝트 기반, 디자인 시스템, 사이드바, 비밀번호 로그인, DB 스키마·seed | ✅ |
| M2 | Threads 계정 연결(OAuth), 토큰 암호화·갱신, 텍스트 글 테스트 발행 | ⏳ |
| M3 | 글 작성 3단계, 미디어, 댓글, 링크, 고지, 예약, publish 크론 | |
| M4 | 예약한 글, 내가 올린 글, 활동 알림 | |
| M5 | AI 생성 | |
| M6 | 글 창고 | |
| M7 | 농장, 자료실 | |
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
3. **Table Editor**에서 테이블 26개가 생겼고, **Storage**에 `media` 버킷(Public)이 생겼는지 확인한다.
4. **Project Settings → API** 에서 다음 값을 복사해 둔다.
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (**절대 공개 금지**)

> 모든 테이블에 RLS가 켜져 있고 정책이 없으므로 anon 키로는 아무것도 읽을 수 없다. 앱은 서버에서 service role 키로만 DB에 접근한다.
>
> Free 플랜의 업로드 파일 크기 상한은 50MB다. 큰 영상(최대 1GB)을 올리려면 Pro 플랜에서 Storage → Settings의 상한을 올려야 한다.

주기 작업(pg_cron) 등록 SQL `supabase/cron.sql`은 M3에서 추가된다.

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
| `ANTHROPIC_API_KEY` / `AI_MODEL_TEXT` / `AI_MODEL_VISION` | M5 | AI 생성 |
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
lib/db                    Supabase service role 클라이언트
lib/env.ts                서버 환경변수 검증(zod)
supabase/migrations       스키마 SQL
supabase/seed.sql         기본 데이터
```

## 참고

- shadcn/ui 컴포넌트는 `components.json` 설정에 맞춰 직접 추가했다. 추가 컴포넌트는 `npx shadcn@latest add <이름>`으로 넣을 수 있다.
- 디자인 토큰은 `app/globals.css`의 `:root`에 있다(배경 #F7F5F0, 포인트 #E8590C).

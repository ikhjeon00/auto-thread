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

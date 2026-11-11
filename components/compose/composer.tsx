"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { AlertTriangle, CheckCircle2, Plus, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ThreadPreview } from "@/components/preview/thread-preview";
import { AccountAvatar } from "@/components/settings/account-avatar";
import { buildPlan, hasErrors, hostOf, matchDisclosure, type DisclosureLite } from "@/lib/compose/plan";
import { MAX_REPLIES, type Compose, type DisclosurePosition, type ReplyItem } from "@/lib/compose/schema";
import { THREADS_TEXT_LIMIT, countThreadsChars } from "@/lib/threads/text";
import { SIMILARITY_WARN, mostSimilar } from "@/lib/text/similarity";
import { APP_TZ } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  checkScheduleAction,
  recentTextsAction,
  saveDraftAction,
  scheduleAction,
} from "@/app/(main)/compose/actions";
import type { ScheduleCheck } from "@/lib/scheduler/check";
import { MediaPicker } from "./media-picker";
import { DraftsMenu, type DraftItem } from "./drafts-menu";

export type ComposerAccount = { id: string; username: string; profile_picture_url: string | null; status: string };
export type ComposerDisclosure = DisclosureLite & { is_default: boolean };

type Props = {
  accounts: ComposerAccount[];
  disclosures: ComposerDisclosure[];
  bannedWords: string[];
  drafts: DraftItem[];
  initial: { postId: string | null; compose: Compose; status: string | null; scheduledAt: string | null };
};

const STEPS = ["설정", "작성", "발행"] as const;
const DISCLOSURE_POS_LABEL: Record<DisclosurePosition, string> = {
  body: "본문 끝",
  link_reply: "링크 댓글",
  separate_reply: "별도 댓글",
};

function defaultScheduleValue(): string {
  const t = new Date(Date.now() + 15 * 60_000);
  t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5, 0, 0);
  return formatInTimeZone(t, APP_TZ, "yyyy-MM-dd'T'HH:mm");
}
const kstInputToIso = (v: string) => fromZonedTime(`${v}:00`, APP_TZ).toISOString();
const isoToKstInput = (iso: string) => formatInTimeZone(new Date(iso), APP_TZ, "yyyy-MM-dd'T'HH:mm");
const fmtKst = (iso: string) => formatInTimeZone(new Date(iso), APP_TZ, "M월 d일 HH:mm");

export function Composer({ accounts, disclosures, bannedWords, drafts, initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(initial.postId && initial.compose.accountId ? 1 : 0);
  const [c, setC] = useState<Compose>(initial.compose);
  const [postId, setPostId] = useState<string | null>(initial.postId);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [recent, setRecent] = useState<string[]>([]);
  const [done, setDone] = useState<{ scheduledAt: string | null } | null>(null);

  const set = <K extends keyof Compose>(k: K, v: Compose[K]) => setC((prev) => ({ ...prev, [k]: v }));
  const account = accounts.find((a) => a.id === c.accountId) ?? null;
  const disclosure = disclosures.find((d) => d.id === c.disclosureId) ?? null;
  const plan = useMemo(() => buildPlan(c, { disclosure, bannedWords }), [c, disclosure, bannedWords]);
  const errors = plan.issues.filter((i) => i.level === "error");

  // 유사도 검사용 최근 글
  useEffect(() => {
    if (!c.accountId) return;
    let alive = true;
    recentTextsAction(c.accountId, postId).then((r) => alive && r.ok && setRecent(r.data));
    return () => {
      alive = false;
    };
  }, [c.accountId, postId]);
  const similar = useMemo(() => {
    if (!c.text.trim() || !recent.length) return null;
    const best = mostSimilar(c.text, recent);
    return best && best.score >= SIMILARITY_WARN ? best : null;
  }, [c.text, recent]);

  // 링크 도메인이 고지 문구와 맞으면 자동 선택
  const lastLinkHost = useRef<string | null>(null);
  useEffect(() => {
    const m = matchDisclosure(c.linkUrl, disclosures);
    const host = hostOf(c.linkUrl);
    if (host === lastLinkHost.current) return;
    lastLinkHost.current = host;
    if (m && m.id !== c.disclosureId) {
      setC((prev) => ({ ...prev, disclosureId: m.id, disclosurePosition: m.default_position }));
    }
  }, [c.linkUrl, c.disclosureId, disclosures]);

  // 상품 홍보글인데 고지 문구가 없으면 기본 문구를 자동 선택
  useEffect(() => {
    if (c.kind !== "product") return;
    const d = c.disclosureId ? null : (disclosures.find((x) => x.is_default) ?? disclosures[0]);
    setC((prev) => ({ ...prev, firstReplyMainMedia: true, ...(d ? { disclosureId: d.id } : {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.kind]);

  function saveDraft() {
    start(async () => {
      const r = await saveDraftAction(c, postId);
      if (r.ok) {
        setPostId(r.data.postId);
        setNotice({ ok: true, text: "임시 저장했습니다." });
        router.replace(`/compose?id=${r.data.postId}`, { scroll: false });
        router.refresh();
      } else setNotice({ ok: false, text: r.error });
    });
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <p className="text-lg font-semibold">{done.scheduledAt ? "예약했습니다" : "발행을 시작했습니다"}</p>
          <p className="text-sm text-muted-foreground">
            {done.scheduledAt
              ? `${fmtKst(done.scheduledAt)}(KST)에 @${account?.username} 계정으로 발행됩니다.`
              : "1분 안에 발행됩니다. 결과는 활동 메뉴에서 확인할 수 있습니다."}
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/scheduled">예약한 글 보기</Link>
            </Button>
            <Button asChild>
              <a href="/compose">새 글 쓰기</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-20 lg:pb-0">
      {/* 단계 표시 + 임시 저장 목록 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex items-center gap-2 text-sm">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={i > step || (i > 0 && !c.accountId)}
                onClick={() => setStep(i)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 transition-colors",
                  i === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i < step
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-input bg-card text-muted-foreground",
                )}
              >
                <span className="num font-semibold">{i + 1}</span> {label}
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-5 bg-border" />}
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2">
          {postId && <Badge variant="outline">{initial.status === "scheduled" ? "예약된 글 수정 중" : "저장된 글"}</Badge>}
          <DraftsMenu drafts={drafts} currentId={postId} />
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm",
            notice.ok ? "border-green-200 bg-green-50 text-success" : "border-red-200 bg-red-50 text-destructive",
          )}
        >
          {notice.text}
          <button type="button" aria-label="닫기" onClick={() => setNotice(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {step === 0 && (
        <StepSetup c={c} set={set} accounts={accounts} onNext={() => setStep(1)} />
      )}

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className={cn("flex min-w-0 flex-col gap-4", mobileTab === "preview" && "hidden lg:flex")}>
            <StepWrite c={c} set={set} plan={plan} disclosures={disclosures} />
            <Checks plan={plan} similar={similar} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" onClick={saveDraft} disabled={pending || !c.accountId}>
                <Save /> 임시 저장
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>
                  이전
                </Button>
                <Button onClick={() => setStep(2)} disabled={hasErrors(plan)}>
                  다음
                </Button>
              </div>
            </div>
          </div>
          <div className={cn("min-w-0 lg:block", mobileTab === "edit" && "hidden")}>
            <div className="lg:sticky lg:top-6">
              <Preview account={account} plan={plan} c={c} />
            </div>
          </div>
          {/* 1024px 미만: 하단 탭 */}
          <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t bg-card lg:hidden">
            {(["edit", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMobileTab(t)}
                className={cn("h-12 text-sm font-medium", mobileTab === t ? "text-primary" : "text-muted-foreground")}
              >
                {t === "edit" ? "편집" : "미리보기"}
                {t === "edit" && errors.length > 0 && <span className="ml-1 text-destructive">●</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && account && (
        <StepPublish
          c={c}
          account={account}
          postId={postId}
          initialScheduledAt={initial.scheduledAt}
          plan={plan}
          onBack={() => setStep(1)}
          onDone={(scheduledAt) => {
            setDone({ scheduledAt });
            router.refresh();
          }}
          onError={(text) => setNotice({ ok: false, text })}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 1단계: 설정

function StepSetup({
  c,
  set,
  accounts,
  onNext,
}: {
  c: Compose;
  set: <K extends keyof Compose>(k: K, v: Compose[K]) => void;
  accounts: ComposerAccount[];
  onNext: () => void;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>계정 선택</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              연결된 계정이 없습니다.{" "}
              <Link href="/settings" className="text-primary underline">
                설정에서 계정을 연결하세요.
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  selected={c.accountId === a.id}
                  disabled={a.status !== "active"}
                  onClick={() => set("accountId", a.id)}
                  title={a.status !== "active" ? "재연결이 필요한 계정입니다" : undefined}
                >
                  @{a.username}
                  {a.status !== "active" && <span className="text-xs text-destructive">(재연결 필요)</span>}
                </Chip>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">페르소나(연령·성별·직업·말투)는 AI 단계(M5)에서 추가됩니다.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>글 종류</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Chip selected={c.kind === "general"} onClick={() => set("kind", "general")}>
            일반
          </Chip>
          <Chip selected={c.kind === "product"} onClick={() => set("kind", "product")}>
            상품 홍보
          </Chip>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>작성 방법</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Chip disabled title="M5 단계에서 추가됩니다">
            AI로 만들기 <span className="text-xs text-muted-foreground">M5</span>
          </Chip>
          <Chip selected>직접 작성</Chip>
          <Chip disabled title="M6 단계에서 추가됩니다">
            글 창고에서 가져오기 <span className="text-xs text-muted-foreground">M6</span>
          </Chip>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!c.accountId}>
          다음
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 2단계: 작성

function Counter({ n, label }: { n: number; label?: string }) {
  const over = n > THREADS_TEXT_LIMIT;
  return (
    <span className={cn("num text-xs", over ? "font-semibold text-destructive" : "text-muted-foreground")}>
      {label && <span className="mr-1">{label}</span>}
      {n} / {THREADS_TEXT_LIMIT}
    </span>
  );
}

function Section({ no, title, children, aside }: { no: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">
          <span className="mr-1.5 text-primary">{no}</span>
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StepWrite({
  c,
  set,
  plan,
  disclosures,
}: {
  c: Compose;
  set: <K extends keyof Compose>(k: K, v: Compose[K]) => void;
  plan: ReturnType<typeof buildPlan>;
  disclosures: ComposerDisclosure[];
}) {
  const hasMedia = c.media.length > 0;
  const mainCount = countThreadsChars(plan.mainText);
  const appended = plan.mainText !== c.text.trim();

  return (
    <>
      <Card className="gap-3">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">본문</CardTitle>
          <Counter n={mainCount} label={appended ? "링크·고지 포함" : undefined} />
        </CardHeader>
        <CardContent>
          <Textarea
            value={c.text}
            onChange={(e) => set("text", e.target.value)}
            rows={8}
            placeholder="무슨 이야기를 나누고 싶으세요?"
            aria-invalid={mainCount > THREADS_TEXT_LIMIT}
            className="text-[15px] leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">이모지는 Threads 규칙대로 UTF-8 바이트 수(보통 4자)로 셉니다.</p>
        </CardContent>
      </Card>

      <Section no="①" title="사진·영상">
        <MediaPicker value={c.media} onChange={(v) => set("media", v)} />
      </Section>

      <Section no="②" title="댓글" aside={<span className="num text-xs text-muted-foreground">{c.replies.length} / {MAX_REPLIES}</span>}>
        <div className="flex flex-col gap-4">
          {c.replies.map((r, i) => {
            const update = (patch: Partial<ReplyItem>) => set("replies", c.replies.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            const usesMain = i === 0 && c.firstReplyMainMedia && c.media.length > 0 && !r.media;
            return (
              <div key={i} className="flex flex-col gap-2 rounded-md border bg-background p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{i === 0 ? "첫 댓글" : `${i + 1}번째 댓글`}</Label>
                  <div className="flex items-center gap-2">
                    <Counter n={countThreadsChars(r.text)} />
                    <button
                      type="button"
                      aria-label="댓글 삭제"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => set("replies", c.replies.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <Textarea
                  rows={2}
                  value={r.text}
                  onChange={(e) => update({ text: e.target.value })}
                  aria-invalid={countThreadsChars(r.text) > THREADS_TEXT_LIMIT}
                />
                {usesMain ? (
                  <p className="text-xs text-muted-foreground">본문 첫 사진이 이 댓글에 붙습니다.</p>
                ) : (
                  <MediaPicker compact max={1} value={r.media ? [r.media] : []} onChange={(v) => update({ media: v[0] ?? null })} />
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={c.replies.length >= MAX_REPLIES}
            onClick={() => set("replies", [...c.replies, { text: "", media: null }])}
          >
            <Plus /> 댓글 추가
          </Button>
          {c.media.length > 0 && (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                checked={c.firstReplyMainMedia}
                onChange={(e) => set("firstReplyMainMedia", e.target.checked)}
              />
              <span>
                첫 댓글에 본문 첫 사진 붙이기
                <span className="block text-xs text-muted-foreground">사진이 있는 댓글은 링크 미리보기 카드 없이 링크만 표시됩니다.</span>
              </span>
            </label>
          )}
          <p className="text-xs text-muted-foreground">댓글은 본문 아래에 순서대로 이어서(스레드 형태로) 달립니다. 댓글마다 사진·영상 1개를 붙일 수 있습니다.</p>
        </div>
      </Section>

      <Section no="③" title="링크·커뮤니티 주제">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="link">링크 URL</Label>
            <Input
              id="link"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={c.linkUrl ?? ""}
              onChange={(e) => set("linkUrl", e.target.value || null)}
            />
          </div>
          {c.linkUrl && (
            <div className="flex flex-col gap-2">
              <Label>링크 위치</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Chip selected={plan.linkPosition === "body"} disabled={hasMedia} onClick={() => set("linkPosition", "body")}>
                  본문 끝
                </Chip>
                <Chip selected={plan.linkPosition === "first_reply"} onClick={() => set("linkPosition", "first_reply")}>
                  첫 댓글
                </Chip>
              </div>
              {hasMedia && (
                <p className="text-xs text-muted-foreground">사진·영상이 있으면 링크 미리보기가 동작하지 않아 첫 댓글에 넣습니다.</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="topic">커뮤니티 주제</Label>
            <Input
              id="topic"
              maxLength={50}
              placeholder="예) 살림템 (# 없이, 50자 이하)"
              value={c.topicTag ?? ""}
              onChange={(e) => set("topicTag", e.target.value || null)}
            />
          </div>
        </div>
      </Section>

      <Section no="④" title="제휴 고지 문구">
        <div className="flex flex-col gap-3">
          <NativeSelect value={c.disclosureId ?? ""} onChange={(e) => set("disclosureId", e.target.value || null)}>
            <option value="">없음</option>
            {disclosures.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
          {c.disclosureId && (
            <>
              {c.kind === "product" ? (
                <p className="text-xs text-muted-foreground">
                  상품 홍보글은 고지 문구가 <b className="text-foreground">첫 댓글 맨 앞</b>에 들어갑니다. (고지 문구 + 댓글 내용 + 링크)
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DISCLOSURE_POS_LABEL) as DisclosurePosition[]).map((p) => (
                    <Chip key={p} selected={c.disclosurePosition === p} onClick={() => set("disclosurePosition", p)}>
                      {DISCLOSURE_POS_LABEL[p]}
                    </Chip>
                  ))}
                </div>
              )}
              {c.kind !== "product" && plan.disclosurePosition && plan.disclosurePosition !== "reply_top" && plan.disclosurePosition !== c.disclosurePosition && (
                <p className="text-xs text-muted-foreground">
                  링크 댓글이 없어서 &lsquo;{DISCLOSURE_POS_LABEL[plan.disclosurePosition]}&rsquo;에 넣습니다.
                </p>
              )}
              <p className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {disclosures.find((d) => d.id === c.disclosureId)?.text}
              </p>
            </>
          )}
        </div>
      </Section>

      <Card className="py-4">
        <CardContent>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={c.isAiLabel}
              onChange={(e) => set("isAiLabel", e.target.checked)}
            />
            AI 생성 표시 <span className="text-xs text-muted-foreground">(Threads에 &lsquo;AI 정보&rsquo; 라벨이 붙습니다)</span>
          </label>
        </CardContent>
      </Card>
    </>
  );
}

function Checks({ plan, similar }: { plan: ReturnType<typeof buildPlan>; similar: { score: number; text: string } | null }) {
  const issues = [...plan.issues];
  if (similar) {
    issues.push({
      level: "warn",
      field: "text",
      message: `최근 글과 ${Math.round(similar.score * 100)}% 비슷합니다: “${similar.text.slice(0, 40)}${similar.text.length > 40 ? "…" : ""}”`,
    });
  }
  if (!issues.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="size-4" /> 자동 검사 통과
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-sm">
      {issues.map((i, k) => (
        <li key={k} className={cn("flex items-start gap-2", i.level === "error" ? "text-destructive" : "text-warning")}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {i.message}
        </li>
      ))}
    </ul>
  );
}

function Preview({ account, plan, c }: { account: ComposerAccount | null; plan: ReturnType<typeof buildPlan>; c: Compose }) {
  return (
    <ThreadPreview
      username={account?.username ?? ""}
      avatarUrl={account?.profile_picture_url ?? null}
      mainText={plan.mainText}
      media={c.media.map((m) => ({ url: m.publicUrl, mediaType: m.mediaType }))}
      replies={plan.replies.map((r) => ({ text: r.text, media: r.media ? { url: r.media.publicUrl, mediaType: r.media.mediaType } : null }))}
      linkAttachment={plan.linkAttachment}
      topicTag={c.topicTag}
      isAiLabel={c.isAiLabel}
    />
  );
}

// ------------------------------------------------------------------ 3단계: 발행

function StepPublish({
  c,
  account,
  postId,
  initialScheduledAt,
  plan,
  onBack,
  onDone,
  onError,
}: {
  c: Compose;
  account: ComposerAccount;
  postId: string | null;
  initialScheduledAt: string | null;
  plan: ReturnType<typeof buildPlan>;
  onBack: () => void;
  onDone: (scheduledAt: string | null) => void;
  onError: (msg: string) => void;
}) {
  const [when, setWhen] = useState(() =>
    initialScheduledAt && Date.parse(initialScheduledAt) > Date.now() ? isoToKstInput(initialScheduledAt) : defaultScheduleValue(),
  );
  const [check, setCheck] = useState<ScheduleCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!when) return;
    let alive = true;
    setChecking(true);
    const t = setTimeout(async () => {
      const r = await checkScheduleAction(account.id, kstInputToIso(when), postId);
      if (!alive) return;
      setChecking(false);
      setCheckError(r.ok ? null : r.error);
      setCheck(r.ok ? r.data : null);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [when, account.id, postId]);

  const submit = (scheduledAt: string | null) =>
    start(async () => {
      const r = await scheduleAction(c, { postId, scheduledAt });
      if (r.ok) onDone(scheduledAt);
      else onError(r.error);
    });

  const hasConflict = (check?.conflicts.length ?? 0) > 0;
  const overAccount = check && check.accountDaily.count + 1 > check.accountDaily.limit;
  const overGlobal = check && check.globalDaily.count + 1 > check.globalDaily.limit;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>발행 확인</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <AccountAvatar src={account.profile_picture_url} username={account.username} />
            <div>
              <div className="font-semibold">@{account.username}</div>
              <div className="text-xs text-muted-foreground">
                {c.kind === "product" ? "상품 홍보" : "일반"} · {plan.mediaType === "TEXT" ? "텍스트" : plan.mediaType === "CAROUSEL" ? `캐러셀 ${c.media.length}장` : plan.mediaType === "VIDEO" ? "영상" : "사진"} · 댓글 {plan.replies.length}개
                {c.topicTag ? ` · 주제 ${c.topicTag}` : ""}
                {c.isAiLabel ? " · AI 표시" : ""}
              </div>
            </div>
          </div>
          <p className="max-h-40 overflow-y-auto rounded-md bg-muted px-3 py-2 whitespace-pre-wrap">{plan.mainText || "(본문 없음)"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>발행 일시 (KST)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="num w-60" />
          {checking && <p className="text-xs text-muted-foreground">다른 예약과 겹치는지 확인 중…</p>}
          {checkError && !checking && <p className="text-xs text-destructive">예약 겹침 확인 실패: {checkError}</p>}
          {check && !checking && (
            <ul className="flex flex-col gap-1.5 text-sm">
              {hasConflict && (
                <li className="rounded-md border border-orange-200 bg-primary-soft p-3 text-warning">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="size-4" /> 다른 예약과 너무 가깝습니다
                  </div>
                  <ul className="mt-1.5 ml-6 list-disc text-xs">
                    {check.conflicts.map((x) => (
                      <li key={x.id}>
                        {fmtKst(x.atIso)} @{x.username ?? "계정"}{" "}
                        {x.reason === "same_account_gap" ? "(같은 계정 최소 간격)" : "(계정 간 최소 간격)"}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {check.suggestion && (
                      <Button size="sm" onClick={() => setWhen(isoToKstInput(check.suggestion!))}>
                        가까운 빈 시간으로 자동 이동 ({fmtKst(check.suggestion)})
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => submit(kstInputToIso(when))}>
                      그대로 예약
                    </Button>
                  </div>
                </li>
              )}
              {overAccount && (
                <li className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="size-4" /> 이 계정의 그날 예약이 하루 최대({check.accountDaily.limit}개)를 넘습니다.
                </li>
              )}
              {overGlobal && (
                <li className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="size-4" /> 그날 전체 예약이 전역 하루 상한({check.globalDaily.limit}개)을 넘습니다.
                </li>
              )}
              {check.outsideActiveHours && (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="size-4" /> 설정한 활동 시간대 밖입니다.
                </li>
              )}
              {!hasConflict && !overAccount && !overGlobal && (
                <li className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="size-4" /> 겹치는 예약이 없습니다. (이 계정 그날 {check.accountDaily.count}/{check.accountDaily.limit})
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => submit(null)}>
            지금 발행
          </Button>
          <Button disabled={pending || !when || hasConflict || checking} onClick={() => submit(kstInputToIso(when))}>
            {pending ? "저장 중…" : "예약하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}

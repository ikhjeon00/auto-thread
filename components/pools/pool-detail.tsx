"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Archive, Check, ChevronDown, FileUp, Gem, Image as ImageIcon, Link2, Loader2, MessageSquare, Pencil, PenLine, Search, Settings2, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { parseCsv } from "@/lib/csv";
import { formatKst } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  deleteItemsAction,
  deletePoolAction,
  enqueueFillAction,
  getJobAction,
  importBookmarksAction,
  importRowsAction,
  setItemsStatusAction,
  type JobStatus,
} from "@/app/(main)/pools/actions";
import { PoolForm, type PoolFormValue } from "./pool-form";

export type PoolItemView = {
  id: string;
  text: string;
  first_reply: string | null;
  topic_tag: string | null;
  category: string | null;
  status: "pending" | "available" | "reserved" | "used" | "archived";
  weight: number;
  source: string;
  persona_tags: string[];
  created_at: string;
  media_count: number;
  reply_count: number;
  has_link: boolean;
};

type Stock = { available: number; pending: number; reserved: number; used: number; archived: number; dailyNeed: number; days: number | null; low: boolean };

const STATUS_LABEL: Record<PoolItemView["status"], string> = { pending: "검수 대기", available: "사용 가능", reserved: "예약됨", used: "사용 완료", archived: "보관" };
const STATUS_VARIANT: Record<PoolItemView["status"], "warning" | "success" | "outline" | "default"> = {
  pending: "warning",
  available: "success",
  reserved: "outline",
  used: "default",
  archived: "default",
};
const SOURCE_LABEL: Record<string, string> = { ai: "AI", manual: "직접", csv: "CSV", bookmark: "보석함" };

type Props = {
  poolId: string;
  pool: PoolFormValue & { id: string };
  stock: Stock;
  accounts: { id: string; username: string }[];
  generators: { id: string; name: string; kind: string }[];
  items: PoolItemView[];
  total: number;
  page: number;
  pageCount: number;
  filter: { status: string | null; q: string | null };
  bookmarks: { id: string; text: string; kind: string }[];
  activeJobId: string | null;
};

export function PoolDetail(p: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      {/* 재고 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={cn("gap-1 sm:col-span-2", p.stock.low && "border-warning/60")}>
          <CardContent>
            <div className="text-sm text-muted-foreground">재고</div>
            <div className={cn("num text-2xl font-bold", p.stock.low && "text-warning")}>
              남은 글 {p.stock.available}개{p.stock.days !== null ? ` · 약 ${p.stock.days}일 분량` : ""}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {p.stock.low && <AlertTriangle className="size-3.5 text-warning" />}
              하루 약 {p.stock.dailyNeed}개 사용 기준 · 재고 부족 기준 {p.pool.low_stock_days}일
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardContent>
            <div className="text-sm text-muted-foreground">검수 대기 / 예약됨</div>
            <div className="num text-2xl font-bold">
              {p.stock.pending} <span className="text-base text-muted-foreground">/ {p.stock.reserved}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardContent className="flex h-full items-center justify-between gap-2">
            <div>
              <div className="text-sm text-muted-foreground">사용 완료 / 보관</div>
              <div className="num text-2xl font-bold">
                {p.stock.used} <span className="text-base text-muted-foreground">/ {p.stock.archived}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
                <Settings2 /> 설정
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (!confirm("이 창고와 안의 글을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
                  start(async () => {
                    const r = await deletePoolAction(p.poolId);
                    if (r.ok) router.push("/pools");
                    else alert(r.error);
                  });
                }}
              >
                <Trash2 /> 삭제
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {editing && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>창고 설정</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => {
                if (!confirm("이 창고와 안의 글을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
                start(async () => {
                  const r = await deletePoolAction(p.poolId);
                  if (r.ok) router.push("/pools");
                  else alert(r.error);
                });
              }}
            >
              <Trash2 /> 창고 삭제
            </Button>
          </CardHeader>
          <CardContent>
            <PoolForm id={p.poolId} initial={p.pool} accounts={p.accounts} generators={p.generators.filter((g) => g.kind === "daily")} onDone={() => setEditing(false)} />
          </CardContent>
        </Card>
      )}

      <FillPanel {...p} />
      <ItemsTable {...p} />
    </div>
  );
}

// ------------------------------------------------------------------ 채우기

type FillTab = "ai" | "manual" | "csv" | "bookmark";

function FillPanel(p: Props) {
  const [tab, setTab] = useState<FillTab>("ai");
  const tabs: [FillTab, string, React.ComponentType<{ className?: string }>][] = [
    ["ai", "AI 일괄 생성", Sparkles],
    ["manual", "직접 작성", PenLine],
    ["csv", "CSV 가져오기", FileUp],
    ["bookmark", "보석함에서 옮기기", Gem],
  ];
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>글 채우기</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([t, label, Icon]) => (
            <Chip key={t} selected={tab === t} onClick={() => setTab(t)}>
              <Icon className="size-4" /> {label}
            </Chip>
          ))}
        </div>
        {tab === "ai" && <AiFill {...p} />}
        {tab === "manual" && <ManualFill poolId={p.poolId} />}
        {tab === "csv" && <CsvFill poolId={p.poolId} />}
        {tab === "bookmark" && <BookmarkFill poolId={p.poolId} bookmarks={p.bookmarks} />}
      </CardContent>
    </Card>
  );
}

function AiFill({ poolId, generators, activeJobId }: Props) {
  const router = useRouter();
  const daily = generators.filter((g) => g.kind === "daily");
  const [count, setCount] = useState(20);
  const [generatorId, setGeneratorId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [jobId, setJobId] = useState<string | null>(activeJobId);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // 진행률 폴링
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    const tick = async () => {
      const r = await getJobAction(jobId);
      if (!alive) return;
      if (!r.ok) return setError(r.error);
      setJob(r.data);
      if (r.data.status === "done" || r.data.status === "failed") {
        router.refresh();
        return;
      }
      setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [jobId, router]);

  const running = !!jobId && (!job || job.status === "queued" || job.status === "running");
  const result = job?.result as { added?: number; dropped?: number; costUsd?: number | null } | null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-count">개수</Label>
          <Input id="f-count" type="number" min={1} max={20} className="num" value={String(count)} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>생성기</Label>
          <NativeSelect value={generatorId} onChange={(e) => setGeneratorId(e.target.value)}>
            <option value="">{daily[0] ? `기본 (${daily[0].name})` : "기본"}</option>
            {daily.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-topic">주제</Label>
          <Input id="f-topic" placeholder="비우면 주제 풀에서 여러 개를 랜덤으로" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
        검수 없이 바로 &lsquo;사용 가능&rsquo;으로 넣기 (끄면 &lsquo;검수 대기&rsquo;로 들어갑니다)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending || running}
          onClick={() =>
            start(async () => {
              setError(null);
              setJob(null);
              const r = await enqueueFillAction(poolId, { count, generatorId: generatorId || null, topic: topic.trim() || null, autoApprove });
              if (r.ok) setJobId(r.data.jobId);
              else setError(r.error);
            })
          }
        >
          {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {running ? "만드는 중…" : `${count}개 만들기`}
        </Button>
        {running && (
          <span className="num text-sm text-muted-foreground">
            {job?.status === "queued" ? "대기 중" : "AI가 쓰는 중"} · {job?.progress ?? 0}/{job?.total || count} (보통 30초~2분, 이 화면을 떠나도 계속됩니다)
          </span>
        )}
        {job?.status === "done" && (
          <span className="text-sm text-success">
            {result?.added ?? 0}개를 넣었습니다{result?.dropped ? ` (검사 탈락 ${result.dropped}개 제외)` : ""}
            {typeof result?.costUsd === "number" ? ` · 약 $${result.costUsd.toFixed(4)}` : ""}
          </span>
        )}
        {job?.status === "failed" && <span className="text-sm text-destructive">실패: {job.error}</span>}
        {job?.status === "queued" && job.error && <span className="text-sm text-warning">재시도 대기: {job.error}</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function ManualFill({ poolId }: { poolId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild>
        <Link href={`/pools/${poolId}/items/new`}>
          <PenLine /> 새 창고 글 쓰기
        </Link>
      </Button>
      <span className="text-sm text-muted-foreground">글 작성과 같은 화면에서 사진·영상, 댓글, 링크, 고지 문구까지 준비하고 미리보기로 확인합니다.</span>
    </div>
  );
}

function CsvFill({ poolId }: { poolId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [approve, setApprove] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        첫 줄에 열 이름이 있어야 합니다: <code className="rounded bg-muted px-1">text</code>(필수), <code className="rounded bg-muted px-1">first_reply</code>,{" "}
        <code className="rounded bg-muted px-1">topic_tag</code>, <code className="rounded bg-muted px-1">category</code>. 엑셀에서 &lsquo;CSV UTF-8&rsquo;로 저장하세요.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="text-sm"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          setMsg(null);
          if (!f) return;
          setFileName(f.name);
          const { headers, rows } = parseCsv(await f.text());
          if (!headers.includes("text")) {
            setRows(null);
            setMsg({ ok: false, text: `'text' 열이 없습니다. 지금 열: ${headers.join(", ") || "(없음)"}` });
            return;
          }
          setRows(rows.filter((r) => r.text?.trim()));
        }}
      />
      {rows && (
        <>
          <div className="rounded-md border bg-background p-3 text-sm">
            <div className="mb-2 font-medium">
              {fileName}: {rows.length}줄
            </div>
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-muted-foreground">
              {rows.slice(0, 5).map((r, i) => (
                <li key={i} className="truncate">
                  {i + 1}. {r.text}
                </li>
              ))}
              {rows.length > 5 && <li>… 외 {rows.length - 5}줄</li>}
            </ul>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
            바로 &lsquo;사용 가능&rsquo;으로 넣기 (끄면 &lsquo;검수 대기&rsquo;)
          </label>
          <div className="flex justify-end">
            <Button
              disabled={pending || !rows.length}
              onClick={() =>
                start(async () => {
                  const r = await importRowsAction(poolId, rows, approve);
                  setMsg(r.ok ? { ok: true, text: `${r.data.added}개를 가져왔습니다${r.data.skipped ? ` (형식 오류 ${r.data.skipped}개 제외)` : ""}.` } : { ok: false, text: r.error });
                  if (r.ok) {
                    setRows(null);
                    router.refresh();
                  }
                })
              }
            >
              {rows.length}개 가져오기
            </Button>
          </div>
        </>
      )}
      {msg && <p className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}
    </div>
  );
}

function BookmarkFill({ poolId, bookmarks }: { poolId: string; bookmarks: { id: string; text: string; kind: string }[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!bookmarks.length) return <p className="text-sm text-muted-foreground">보석함이 비어 있습니다. 내가 올린 글에서 ★로 저장할 수 있습니다.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="max-h-72 divide-y overflow-y-auto rounded-md border bg-background">
        {bookmarks.map((b) => (
          <li key={b.id}>
            <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                checked={sel.has(b.id)}
                onChange={() => {
                  const n = new Set(sel);
                  if (n.has(b.id)) n.delete(b.id);
                  else n.add(b.id);
                  setSel(n);
                }}
              />
              <span className="line-clamp-2 flex-1">{b.text}</span>
              <Badge variant="outline">{b.kind === "mine" ? "내 글" : "참고"}</Badge>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-3">
        {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</span>}
        <Button
          disabled={pending || !sel.size}
          onClick={() =>
            start(async () => {
              const r = await importBookmarksAction(poolId, [...sel]);
              setMsg(r.ok ? { ok: true, text: `${r.data.added}개를 옮겼습니다(사용 가능).` } : { ok: false, text: r.error });
              if (r.ok) {
                setSel(new Set());
                router.refresh();
              }
            })
          }
        >
          {sel.size}개 옮기기
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 글 목록

function ItemsTable(p: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(p.filter.q ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const go = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (!("page" in patch)) sp.delete("page");
    setSel(new Set());
    router.push(`${pathname}?${sp}`);
  };

  const bulk = (fn: () => Promise<{ ok: boolean; error?: string; data?: { changed?: number; deleted?: number } }>, label: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        const n = r.data?.changed ?? r.data?.deleted ?? 0;
        setMsg({ ok: true, text: `${n}개 ${label}` });
        setSel(new Set());
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "오류" });
    });

  const allSelected = p.items.length > 0 && p.items.every((i) => sel.has(i.id));
  const ids = [...sel];

  return (
    <Card className="gap-3">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>
          글 목록 <span className="num font-normal text-muted-foreground">{p.total}개</span>
        </CardTitle>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() || null });
          }}
        >
          <Input className="w-56" placeholder="본문 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="outline" size="icon" aria-label="검색">
            <Search />
          </Button>
        </form>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip selected={!p.filter.status} onClick={() => go({ status: null })}>
            전체
          </Chip>
          {(Object.keys(STATUS_LABEL) as PoolItemView["status"][]).map((s) => (
            <Chip key={s} selected={p.filter.status === s} onClick={() => go({ status: s })}>
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={allSelected}
              onChange={() => setSel(allSelected ? new Set() : new Set(p.items.map((i) => i.id)))}
            />
            {sel.size ? `${sel.size}개 선택` : "이 페이지 전체 선택"}
          </label>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" disabled={!sel.size || pending} onClick={() => bulk(() => setItemsStatusAction(p.poolId, ids, "available"), "승인했습니다")}>
              <Check /> 승인
            </Button>
            <Button size="sm" variant="outline" disabled={!sel.size || pending} onClick={() => bulk(() => setItemsStatusAction(p.poolId, ids, "archived"), "보관했습니다")}>
              <Archive /> 보관
            </Button>
            <Button size="sm" variant="outline" disabled={!sel.size || pending} onClick={() => bulk(() => setItemsStatusAction(p.poolId, ids, "pending"), "검수 대기로 돌렸습니다")}>
              <Undo2 /> 검수 대기로
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:text-destructive"
              disabled={!sel.size || pending}
              onClick={() => confirm(`${sel.size}개를 삭제할까요? (예약된 글은 빠집니다)`) && bulk(() => deleteItemsAction(p.poolId, ids), "삭제했습니다")}
            >
              <Trash2 /> 삭제
            </Button>
          </span>
        </div>
        {msg && <p className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}

        {p.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">글이 없습니다. 위에서 채워 보세요.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {p.items.map((i) => (
              <li key={i.id} className={cn(sel.has(i.id) && "bg-primary-soft/40")}>
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--primary)]"
                    checked={sel.has(i.id)}
                    onChange={() => {
                      const n = new Set(sel);
                      if (n.has(i.id)) n.delete(i.id);
                      else n.add(i.id);
                      setSel(n);
                    }}
                    aria-label="선택"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm whitespace-pre-wrap", openId !== i.id && "line-clamp-2")}>{i.text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant={STATUS_VARIANT[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                      {i.category && <Badge variant="outline">{i.category}</Badge>}
                      {i.topic_tag && <span>#{i.topic_tag}</span>}
                      {i.media_count > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <ImageIcon className="size-3.5" />
                          {i.media_count}
                        </span>
                      )}
                      {i.reply_count > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <MessageSquare className="size-3.5" />
                          {i.reply_count}
                        </span>
                      )}
                      {i.has_link && (
                        <span className="inline-flex items-center gap-0.5">
                          <Link2 className="size-3.5" />
                          링크
                        </span>
                      )}
                      {i.weight > 1 && <span>가중치 {i.weight}</span>}
                      <span>{SOURCE_LABEL[i.source] ?? i.source}</span>
                      <span className="num">{formatKst(i.created_at, "M/d HH:mm")}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="전체 보기" onClick={() => setOpenId(openId === i.id ? null : i.id)}>
                    <ChevronDown className={cn("transition-transform", openId === i.id && "rotate-180")} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="편집" asChild>
                    <Link href={`/pools/${p.poolId}/items/${i.id}`}>
                      <Pencil />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {p.pageCount > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={p.page <= 1} onClick={() => go({ page: String(p.page - 1) })}>
              이전
            </Button>
            <span className="num text-sm">
              {p.page} / {p.pageCount}
            </span>
            <Button variant="outline" size="sm" disabled={p.page >= p.pageCount} onClick={() => go({ page: String(p.page + 1) })}>
              다음
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

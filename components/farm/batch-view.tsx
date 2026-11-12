"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, CalendarCheck, ExternalLink, Image as ImageIcon, Loader2, MessageSquare, Pencil, Shuffle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { formatKst } from "@/lib/time";
import { cn } from "@/lib/utils";
import { cancelFarmPostsAction, confirmBatchAction } from "@/app/(main)/farm/actions";
import { getJobAction, type JobStatus } from "@/app/(main)/pools/actions";

export type BatchPost = {
  id: string;
  username: string;
  kind: string;
  status: string;
  text: string;
  scheduledAt: string | null;
  lastError: string | null;
  pickAtPublish: boolean;
  issues: string[];
  mediaCount: number;
  replyCount: number;
  permalink: string | null;
};

const LABEL: Record<string, string> = { draft: "만드는 중", review: "검토 대기", scheduled: "예약", processing: "발행 중", published: "발행됨", failed: "실패", cancelled: "취소" };
const VARIANT: Record<string, "warning" | "success" | "outline" | "default" | "error"> = {
  draft: "default",
  review: "warning",
  scheduled: "outline",
  processing: "warning",
  published: "success",
  failed: "error",
  cancelled: "default",
};

const SELECTABLE = ["review", "scheduled", "failed", "draft"];

export function BatchView(p: { batchId: string; jobId: string | null; mode: string; cancelled: boolean; skipped: number; counts: Record<string, number>; posts: BatchPost[]; status: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!p.jobId) return;
    let alive = true;
    const tick = async () => {
      const r = await getJobAction(p.jobId!);
      if (!alive || !r.ok) return;
      setJob(r.data);
      if (r.data.status === "queued" || r.data.status === "running") {
        router.refresh();
        setTimeout(tick, 3000);
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [p.jobId, router]);

  const building = job && (job.status === "queued" || job.status === "running");
  const total = Object.values(p.counts).reduce((a, b) => a + b, 0);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, ok: (d: never) => string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: ok(r.data as never) } : { ok: false, text: r.error ?? "오류" });
      setSel(new Set());
      router.refresh();
    });
  const ids = [...sel];
  const selectable = p.posts.filter((x) => SELECTABLE.includes(x.status));
  const allSelected = selectable.length > 0 && selectable.every((x) => sel.has(x.id));

  return (
    <div className="flex flex-col gap-4">
      {(building || job?.status === "failed") && (
        <Card className={cn("gap-2", job?.status === "failed" && !p.cancelled && "border-red-200")}>
          <CardContent className="flex items-center gap-3 text-sm">
            {building ? <Loader2 className="size-5 animate-spin text-primary" /> : <AlertTriangle className="size-5 text-destructive" />}
            <div className="flex-1">
              {building ? (
                <>
                  <div className="font-medium">글을 만드는 중입니다 {job.total ? <span className="num">({job.progress}/{job.total})</span> : null}</div>
                  <div className="text-xs text-muted-foreground">시간 배치 → AI 생성·창고 배정 순서로 진행합니다. 이 화면을 떠나도 계속됩니다(1분마다 이어서 처리).</div>
                  {job.total > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((job.progress / job.total) * 100)}%` }} />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-destructive">{p.cancelled ? "취소된 농장입니다." : `만들기 실패: ${job?.error}`}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {p.skipped > 0 && (
        <p className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="size-4" /> 간격 규칙·하루 상한 때문에 {p.skipped}개 자리는 만들지 못했습니다.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Chip selected={!p.status} onClick={() => router.push(pathname)}>
          전체 <span className="num">{total}</span>
        </Chip>
        {Object.entries(p.counts).map(([s, n]) => (
          <Chip key={s} selected={p.status === s} onClick={() => router.push(`${pathname}?status=${s}`)}>
            {LABEL[s] ?? s} <span className="num">{n}</span>
          </Chip>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {(p.counts.review ?? 0) > 0 && (
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => confirmBatchAction(p.batchId, ids.length ? ids : undefined),
                  (d: { confirmed: number; past: number }) => `${d.confirmed}개를 예약으로 확정했습니다${d.past ? ` (이미 시간이 지난 ${d.past}개는 남겨 둠)` : ""}.`,
                )
              }
            >
              <CalendarCheck /> {ids.length ? `선택한 ${ids.length}개 예약 확정` : "검토 대기 전체 예약 확정"}
            </Button>
          )}
          {!p.cancelled && (
            <Button
              variant="outline"
              className="hover:text-destructive"
              disabled={pending}
              onClick={() => {
                const msgText = ids.length ? `선택한 ${ids.length}개 글을 취소할까요?` : "이 농장의 발행 전 글을 모두 취소하고 농장을 멈출까요?";
                if (!confirm(msgText)) return;
                run(() => cancelFarmPostsAction(p.batchId, ids.length ? ids : null), (d: { cancelled: number }) => `${d.cancelled}개를 취소했습니다.`);
              }}
            >
              <X /> {ids.length ? `선택한 ${ids.length}개 취소` : "농장 취소"}
            </Button>
          )}
        </div>
      </div>
      {msg && <p className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}

      {p.posts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{building ? "곧 글이 나타납니다." : "글이 없습니다."}</CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          {selectable.length > 0 && (
            <label className="flex cursor-pointer items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = sel.size > 0 && !allSelected;
                }}
                onChange={() => setSel(allSelected ? new Set() : new Set(selectable.map((x) => x.id)))}
              />
              <span className="font-medium">{sel.size ? `${sel.size}개 선택` : "전체 선택"}</span>
              <span className="text-xs text-muted-foreground">
                (선택 가능한 글 <span className="num">{selectable.length}</span>개)
              </span>
            </label>
          )}
          <ul className="divide-y">
            {p.posts.map((x) => {
              const editable = ["review", "scheduled", "failed"].includes(x.status) && !x.pickAtPublish;
              return (
                <li key={x.id} className={cn("flex items-start gap-3 px-4 py-3", sel.has(x.id) && "bg-primary-soft/40")}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--primary)]"
                    aria-label="선택"
                    disabled={!SELECTABLE.includes(x.status)}
                    checked={sel.has(x.id)}
                    onChange={() => {
                      const n = new Set(sel);
                      if (n.has(x.id)) n.delete(x.id);
                      else n.add(x.id);
                      setSel(n);
                    }}
                  />
                  <div className="num w-24 shrink-0 text-sm">
                    <div className="font-semibold">{x.scheduledAt ? formatKst(x.scheduledAt, "M/d") : "-"}</div>
                    <div className="text-muted-foreground">{x.scheduledAt ? formatKst(x.scheduledAt, "HH:mm") : ""}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="font-medium">@{x.username}</span>
                      <Badge variant={VARIANT[x.status] ?? "default"}>{LABEL[x.status] ?? x.status}</Badge>
                      {x.kind === "product" && <Badge variant="outline">상품</Badge>}
                      {x.mediaCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <ImageIcon className="size-3.5" />
                          {x.mediaCount}
                        </span>
                      )}
                      {x.replyCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <MessageSquare className="size-3.5" />
                          {x.replyCount}
                        </span>
                      )}
                    </div>
                    {x.pickAtPublish ? (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <Shuffle className="size-3.5" /> 발행할 때 창고에서 뽑습니다
                      </p>
                    ) : (
                      <p className="mt-0.5 line-clamp-3 text-sm whitespace-pre-wrap text-foreground/90">{x.text || (x.status === "draft" ? "(만드는 중)" : "(본문 없음)")}</p>
                    )}
                    {x.issues.length > 0 && <p className="mt-1 text-xs text-warning">{x.issues.join(" / ")}</p>}
                    {x.lastError && <p className="mt-1 text-xs text-destructive">{x.lastError}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {editable && (
                      <Button variant="ghost" size="icon" aria-label="수정" asChild>
                        <Link href={`/compose?id=${x.id}`}>
                          <Pencil />
                        </Link>
                      </Button>
                    )}
                    {x.permalink && (
                      <Button variant="ghost" size="icon" aria-label="Threads에서 보기" asChild>
                        <a href={x.permalink} target="_blank" rel="noreferrer">
                          <ExternalLink />
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {p.mode === "review" && (p.counts.review ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground">
          검토 대기 글은 발행되지 않습니다. 확인하고 고칠 글은 ✎로 글 작성 화면에서 수정한 뒤, 위의 「예약 확정」을 누르세요. 글 작성에서 「예약하기」로 저장해도 그 글은 예약됩니다.
        </p>
      )}
    </div>
  );
}

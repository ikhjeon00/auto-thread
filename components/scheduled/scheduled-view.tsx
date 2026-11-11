"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ko } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  List,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { AccountAvatar } from "@/components/settings/account-avatar";
import { addDays, addMonths, dayKeyOf, monthGrid, timeOf, todayKst, weekDays } from "@/lib/calendar";
import { APP_TZ } from "@/lib/time";
import { cn } from "@/lib/utils";
import { cancelAction, deleteAction, rescheduleAction, retryAction } from "@/app/(main)/scheduled/actions";
import { FILTER_STATUSES, STATUS_LABEL, type PostStatus, type ScheduledItem } from "./types";

type Props = {
  items: ScheduledItem[];
  view: "list" | "month" | "week";
  anchor: string;
  statuses: PostStatus[];
  accountId: string | null;
  accounts: { id: string; username: string }[];
  conflictIds: string[];
  focusId: string | null;
  page: number;
  pageCount: number;
  total: number;
  minGapMinutes: number;
};

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function effectiveStatus(i: ScheduledItem): PostStatus | "reply_failed" {
  return i.status === "published" && i.repliesFailed > 0 ? "reply_failed" : i.status;
}

function StatusBadge({ item }: { item: ScheduledItem }) {
  const s = effectiveStatus(item);
  if (s === "reply_failed") return <Badge variant="error">댓글 실패</Badge>;
  const variant = s === "published" ? "success" : s === "failed" ? "error" : s === "processing" ? "warning" : s === "scheduled" ? "outline" : "default";
  return <Badge variant={variant}>{STATUS_LABEL[s]}</Badge>;
}

const dotColor = (i: ScheduledItem) => {
  const s = effectiveStatus(i);
  return s === "failed" || s === "reply_failed"
    ? "bg-destructive"
    : s === "published"
      ? "bg-success"
      : s === "processing"
        ? "bg-warning"
        : s === "cancelled"
          ? "bg-muted-foreground/40"
          : "bg-foreground/70";
};

const fmtFull = (iso: string | null) => (iso ? formatInTimeZone(new Date(iso), APP_TZ, "M월 d일 (EEE) HH:mm", { locale: ko }) : "시간 없음");

export function ScheduledView(p: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(p.focusId);
  const conflicts = useMemo(() => new Set(p.conflictIds), [p.conflictIds]);
  const selected = p.items.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (p.focusId) document.getElementById(`post-${p.focusId}`)?.scrollIntoView({ block: "center" });
  }, [p.focusId]);

  const go = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    if (!("page" in patch)) sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  };

  const toggleStatus = (s: PostStatus) => {
    const next = p.statuses.includes(s) ? p.statuses.filter((x) => x !== s) : [...p.statuses, s];
    go({ status: next.length ? next.join(",") : null });
  };

  const navLabel =
    p.view === "month"
      ? `${p.anchor.slice(0, 4)}년 ${Number(p.anchor.slice(5, 7))}월`
      : p.view === "week"
        ? (() => {
            const w = weekDays(p.anchor);
            return `${Number(w[0].slice(5, 7))}/${Number(w[0].slice(8))} – ${Number(w[6].slice(5, 7))}/${Number(w[6].slice(8))}`;
          })()
        : null;
  const shift = (dir: number) => go({ d: p.view === "month" ? addMonths(p.anchor, dir) : addDays(p.anchor, dir * 7) });

  return (
    <div className="flex flex-col gap-4">
      {/* 도구 모음 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border bg-card p-0.5">
          {(
            [
              ["list", "목록", List],
              ["month", "월", CalendarDays],
              ["week", "주", CalendarDays],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => go({ view: v === "list" ? null : v })}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm",
                p.view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {navLabel && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="이전" onClick={() => shift(-1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={() => go({ d: null })}>
              오늘
            </Button>
            <Button variant="outline" size="icon" aria-label="다음" onClick={() => shift(1)}>
              <ChevronRight />
            </Button>
            <span className="num ml-2 font-semibold">{navLabel}</span>
          </div>
        )}
        <NativeSelect className="ml-auto w-44" value={p.accountId ?? ""} onChange={(e) => go({ account: e.target.value || null })}>
          <option value="">모든 계정</option>
          {p.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.username}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_STATUSES.map((s) => (
          <Chip key={s} selected={p.statuses.includes(s)} onClick={() => toggleStatus(s)}>
            {STATUS_LABEL[s]}
          </Chip>
        ))}
        <span className="num ml-auto text-sm text-muted-foreground">{p.total}개</span>
      </div>
      {conflicts.size > 0 && (
        <p className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="size-4" /> 최소 간격 안에 겹친 예약이 {conflicts.size}개 있습니다(주황색 표시). 시간을 바꾸는 걸 권장합니다.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {p.view === "list" && <ListView {...p} conflicts={conflicts} selectedId={selectedId} onSelect={setSelectedId} onPage={(n) => go({ page: String(n) })} />}
          {p.view === "month" && <MonthView {...p} conflicts={conflicts} selectedId={selectedId} onSelect={setSelectedId} />}
          {p.view === "week" && <WeekView {...p} conflicts={conflicts} selectedId={selectedId} onSelect={setSelectedId} />}
        </div>
        <div className="min-w-0">
          <div className="xl:sticky xl:top-6">
            {selected ? (
              <Detail key={selected.id} item={selected} conflict={conflicts.has(selected.id)} onClose={() => setSelectedId(null)} />
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">글을 누르면 자세한 내용과 관리 버튼이 나옵니다.</CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type ViewProps = Props & { conflicts: Set<string>; selectedId: string | null; onSelect: (id: string) => void };

function ListView({ items, conflicts, selectedId, onSelect, page, pageCount, onPage }: ViewProps & { onPage: (n: number) => void }) {
  if (!items.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          해당하는 글이 없습니다.{" "}
          <Link href="/compose" className="text-primary underline">
            글 작성하기
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="gap-0 py-0">
      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} id={`post-${i.id}`}>
            <button
              type="button"
              onClick={() => onSelect(i.id)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60",
                selectedId === i.id && "bg-primary-soft/60",
                conflicts.has(i.id) && "border-l-4 border-l-warning",
              )}
            >
              <div className="num w-24 shrink-0 text-sm">
                <div className="font-semibold">{i.scheduledAt ? formatInTimeZone(new Date(i.scheduledAt), APP_TZ, "M/d") : "-"}</div>
                <div className="text-muted-foreground">{i.scheduledAt ? timeOf(i.scheduledAt) : ""}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-medium">@{i.username}</span>
                  <StatusBadge item={i} />
                  {i.kind === "product" && <Badge variant="outline">상품</Badge>}
                  {conflicts.has(i.id) && (
                    <Badge variant="warning">
                      <AlertTriangle className="size-3" /> 간격 겹침
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{i.text || "(본문 없음)"}</p>
                {(i.status === "failed" || i.repliesFailed > 0) && i.lastError && (
                  <p className="mt-1 line-clamp-1 text-xs text-destructive">{i.lastError}</p>
                )}
              </div>
              <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
                {i.mediaCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <ImageIcon className="size-3.5" />
                    {i.mediaCount}
                  </span>
                )}
                {i.replyCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <MessageSquare className="size-3.5" />
                    {i.replyCount}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 border-t py-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            이전
          </Button>
          <span className="num text-sm">
            {page} / {pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            다음
          </Button>
        </div>
      )}
    </Card>
  );
}

function groupByDay(items: ScheduledItem[]) {
  const m = new Map<string, ScheduledItem[]>();
  for (const i of items) {
    if (!i.scheduledAt) continue;
    const k = dayKeyOf(i.scheduledAt);
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  return m;
}

function CalItem({ i, conflict, selected, onSelect }: { i: ScheduledItem; conflict: boolean; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      id={`post-${i.id}`}
      onClick={() => onSelect(i.id)}
      title={`${timeOf(i.scheduledAt!)} @${i.username} · ${i.text.slice(0, 60)}`}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-accent",
        conflict && "bg-primary-soft text-warning ring-1 ring-warning/60",
        selected && "ring-2 ring-primary",
        i.status === "cancelled" && "line-through opacity-60",
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dotColor(i))} />
      <span className="num shrink-0">{timeOf(i.scheduledAt!)}</span>
      <span className="truncate">@{i.username}</span>
    </button>
  );
}

function MonthView({ items, anchor, conflicts, selectedId, onSelect }: ViewProps) {
  const days = monthGrid(anchor);
  const byDay = groupByDay(items);
  const today = todayKst();
  const month = anchor.slice(0, 7);
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {WEEK.map((w, i) => (
          <div key={w} className={cn("py-2", i === 0 && "text-destructive")}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, idx) => {
          const list = byDay.get(d) ?? [];
          const show = expanded === d ? list : list.slice(0, 4);
          return (
            <div
              key={d}
              className={cn(
                "min-h-24 border-b p-1 sm:min-h-28",
                idx % 7 !== 6 && "border-r",
                d.slice(0, 7) !== month && "bg-muted/30 text-muted-foreground",
              )}
            >
              <div className={cn("num mb-0.5 px-1 text-xs", d === today && "inline-flex size-5 items-center justify-center rounded-full bg-primary px-0 font-semibold text-primary-foreground")}>
                {Number(d.slice(8))}
              </div>
              <div className="flex flex-col gap-0.5">
                {show.map((i) => (
                  <CalItem key={i.id} i={i} conflict={conflicts.has(i.id)} selected={selectedId === i.id} onSelect={onSelect} />
                ))}
                {list.length > 4 && expanded !== d && (
                  <button type="button" onClick={() => setExpanded(d)} className="px-1 text-left text-[11px] text-muted-foreground hover:text-foreground">
                    +{list.length - 4}개 더
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({ items, anchor, conflicts, selectedId, onSelect }: ViewProps) {
  const days = weekDays(anchor);
  const byDay = groupByDay(items);
  const today = todayKst();
  return (
    <div className="overflow-x-auto">
      <Card className="min-w-[720px] gap-0 py-0">
        <div className="grid grid-cols-7">
          {days.map((d, idx) => {
            const list = byDay.get(d) ?? [];
            return (
              <div key={d} className={cn("min-h-80", idx < 6 && "border-r")}>
                <div className={cn("border-b px-2 py-2 text-center text-xs", d === today && "bg-primary-soft font-semibold text-primary")}>
                  <span className={cn(idx === 0 && "text-destructive")}>{WEEK[idx]}</span> <span className="num">{Number(d.slice(5, 7))}/{Number(d.slice(8))}</span>
                  <span className="num ml-1 text-muted-foreground">({list.length})</span>
                </div>
                <div className="flex flex-col gap-1 p-1.5">
                  {list.map((i) => (
                    <button
                      key={i.id}
                      id={`post-${i.id}`}
                      type="button"
                      onClick={() => onSelect(i.id)}
                      className={cn(
                        "rounded-md border bg-card px-2 py-1.5 text-left text-xs hover:bg-accent",
                        conflicts.has(i.id) && "border-warning bg-primary-soft",
                        selectedId === i.id && "ring-2 ring-primary",
                        i.status === "cancelled" && "opacity-60",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span className={cn("size-1.5 rounded-full", dotColor(i))} />
                        <span className="num font-semibold">{timeOf(i.scheduledAt!)}</span>
                        {conflicts.has(i.id) && <AlertTriangle className="size-3 text-warning" />}
                      </div>
                      <div className="truncate">@{i.username}</div>
                      <div className="line-clamp-2 text-muted-foreground">{i.text}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ 상세 패널

const toInput = (iso: string | null) => formatInTimeZone(iso ? new Date(iso) : new Date(Date.now() + 15 * 60_000), APP_TZ, "yyyy-MM-dd'T'HH:mm");
const fromInput = (v: string) => fromZonedTime(`${v}:00`, APP_TZ).toISOString();

function Detail({ item: i, conflict, onClose }: { item: ScheduledItem; conflict: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(toInput(i.scheduledAt));
  const [conflictInfo, setConflictInfo] = useState<{ suggestion: string | null; list: { atIso: string; username?: string }[] } | null>(null);
  const s = effectiveStatus(i);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "오류" });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  const reschedule = (iso: string, force: boolean) =>
    start(async () => {
      const r = await rescheduleAction(i.id, iso, force);
      if (r.ok) {
        setEditing(false);
        setConflictInfo(null);
        setMsg({ ok: true, text: "시간을 바꿨습니다." });
        router.refresh();
      } else if (r.conflict) {
        setConflictInfo({ suggestion: r.conflict.suggestion, list: r.conflict.conflicts });
      } else setMsg({ ok: false, text: r.error });
    });

  return (
    <Card className="gap-3">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <AccountAvatar src={i.avatarUrl} username={i.username} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold">@{i.username}</span>
              <StatusBadge item={i} />
            </div>
            <div className="num text-sm text-muted-foreground">{fmtFull(i.scheduledAt)}</div>
          </div>
          <button type="button" aria-label="닫기" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {conflict && (
          <p className="flex items-center gap-2 rounded-md bg-primary-soft px-3 py-2 text-sm text-warning">
            <AlertTriangle className="size-4" /> 다른 예약과 최소 간격 안에 겹칩니다.
          </p>
        )}
        <p className="max-h-60 overflow-y-auto rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{i.text || "(본문 없음)"}</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{i.kind === "product" ? "상품 홍보" : "일반"}</span>
          {i.mediaCount > 0 && <span>사진·영상 {i.mediaCount}</span>}
          {i.replyCount > 0 && <span>댓글 {i.replyCount}</span>}
          {i.attemptCount > 0 && <span>시도 {i.attemptCount}회</span>}
        </div>

        {(s === "failed" || s === "reply_failed" || (s === "processing" && i.lastError)) && i.lastError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">
            <div className="font-medium">{s === "processing" ? "재시도 대기 중" : s === "reply_failed" ? `댓글 ${i.repliesFailed}개 발행 실패` : "발행 실패"}</div>
            <div className="mt-0.5 text-xs break-words">{i.lastError}</div>
          </div>
        )}

        {editing && (
          <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="num" />
            {conflictInfo && (
              <div className="text-sm text-warning">
                <p className="font-medium">다른 예약과 너무 가깝습니다.</p>
                <ul className="ml-4 list-disc text-xs">
                  {conflictInfo.list.map((c, k) => (
                    <li key={k}>
                      {fmtFull(c.atIso)} @{c.username}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  {conflictInfo.suggestion && (
                    <Button size="sm" disabled={pending} onClick={() => reschedule(conflictInfo.suggestion!, false)}>
                      가까운 빈 시간으로 ({fmtFull(conflictInfo.suggestion)})
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => reschedule(fromInput(when), true)}>
                    그대로 변경
                  </Button>
                </div>
              </div>
            )}
            {!conflictInfo && (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  닫기
                </Button>
                <Button size="sm" disabled={pending || !when} onClick={() => reschedule(fromInput(when), false)}>
                  저장
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {s === "scheduled" && !editing && (
            <Button size="sm" variant="outline" onClick={() => { setEditing(true); setConflictInfo(null); }}>
              시간 변경
            </Button>
          )}
          {(s === "scheduled" || s === "failed" || s === "cancelled") && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/compose?id=${i.id}`}>
                <Pencil /> 수정
              </a>
            </Button>
          )}
          {(s === "failed" || s === "reply_failed") && (
            <Button size="sm" disabled={pending} onClick={() => run(() => retryAction(i.id), "다시 시도하도록 예약했습니다. 1분 안에 처리됩니다.")}>
              <RotateCcw /> {s === "reply_failed" ? "댓글 다시 올리기" : "재시도"}
            </Button>
          )}
          {(s === "scheduled" || s === "failed") && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => confirm("이 예약을 취소할까요?") && run(() => cancelAction(i.id), "취소했습니다.")}
            >
              <X /> 예약 취소
            </Button>
          )}
          {s === "cancelled" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => confirm("이 글을 완전히 삭제할까요?") && run(() => deleteAction(i.id), "삭제했습니다.", onClose)}
            >
              <Trash2 /> 삭제
            </Button>
          )}
          {i.permalink && (
            <Button size="sm" variant="ghost" asChild>
              <a href={i.permalink} target="_blank" rel="noreferrer">
                Threads에서 보기 <ExternalLink />
              </a>
            </Button>
          )}
        </div>
        {s === "processing" && <p className="text-xs text-muted-foreground">발행 중인 글은 수정하거나 취소할 수 없습니다.</p>}
        {msg && <p className={cn("text-sm", msg.ok ? "text-success" : "text-destructive")}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}

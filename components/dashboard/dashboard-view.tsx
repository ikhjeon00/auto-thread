"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Search, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { AccountAvatar } from "@/components/settings/account-avatar";
import { addDays } from "@/lib/calendar";
import { formatKst } from "@/lib/time";
import { cn } from "@/lib/utils";
import { accountDetailAction, type AccountDetail } from "@/app/(main)/dashboard-actions";

export type DashAccount = { id: string; username: string; profile_picture_url: string | null; status: string; group_id: string | null; follower_count: number | null; last_synced_at: string | null };
export type DashStat = { account_id: string; date: string; followers: number | null; views: number; likes: number; replies: number };
type Group = { id: string; name: string; color: string };

// 검증된 범주형 팔레트(라이트). 고정 순서로 배정하고 순환하지 않는다
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const MAX_LINES = SERIES.length;
const INK = { primary: "#1f1d1a", secondary: "#78726a", grid: "#ece8e0" };
const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("ko-KR");
const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;

const METRICS = { views: "조회수", replies: "댓글수", likes: "좋아요수" } as const;
type Metric = keyof typeof METRICS;

export function DashboardView({ accounts, groups, stats, today }: { accounts: DashAccount[]; groups: Group[]; stats: DashStat[]; today: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byAccount = useMemo(() => {
    const m = new Map<string, Map<string, DashStat>>();
    for (const s of stats) {
      if (!m.has(s.account_id)) m.set(s.account_id, new Map());
      m.get(s.account_id)!.set(s.date, s);
    }
    return m;
  }, [stats]);
  const hasStats = stats.length > 0;
  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {!hasStats && (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          아직 모아 둔 통계가 없습니다. 통계는 매일 00:10과 3시간마다 수집되니, 첫 수집 뒤에 그래프와 표가 채워집니다.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <FollowerTrend accounts={accounts} byAccount={byAccount} today={today} />
        <Reactions accounts={accounts} byAccount={byAccount} today={today} />
      </div>
      <div className={cn("grid gap-6", selected && "2xl:grid-cols-[minmax(0,1fr)_420px]")}>
        <AccountTable accounts={accounts} groups={groups} byAccount={byAccount} today={today} selectedId={selectedId} onSelect={setSelectedId} />
        {selected && <DetailPanel account={selected} series={byAccount.get(selected.id)} today={today} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 팔로워 추이

function PeriodToggle({ value, onChange }: { value: 7 | 14 | 30; onChange: (v: 7 | 14 | 30) => void }) {
  return (
    <div className="flex rounded-md border bg-card p-0.5 text-xs">
      {([7, 14, 30] as const).map((d) => (
        <button key={d} type="button" onClick={() => onChange(d)} className={cn("rounded px-2.5 py-1", value === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
          {d}일
        </button>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label, names }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string; names: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].filter((p) => p.value !== null && p.value !== undefined).sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium" style={{ color: INK.primary }}>
        {label}
      </div>
      {rows.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: INK.secondary }}>{names[p.dataKey] ?? p.dataKey}</span>
          <span className="num ml-auto pl-3 font-medium" style={{ color: INK.primary }}>
            {n(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FollowerTrend({ accounts, byAccount, today }: { accounts: DashAccount[]; byAccount: Map<string, Map<string, DashStat>>; today: string }) {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  // 처음엔 팔로워 많은 순 8개. 선택된 계정은 빈 칸(slot) 중 가장 앞 색을 받고, 선택이 바뀌어도 남은 계정 색은 그대로
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const top = [...accounts].sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0)).slice(0, MAX_LINES).map((a) => a.id);
    return Array.from({ length: MAX_LINES }, (_, i) => top[i] ?? null);
  });
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(today, i - days + 1)), [days, today]);
  const active = slots.map((id, i) => ({ id, color: SERIES[i] })).filter((s): s is { id: string; color: string } => !!s.id);
  const names = Object.fromEntries(accounts.map((a) => [a.id, `@${a.username}`]));
  const data = dates.map((d) => ({ date: shortDate(d), ...Object.fromEntries(active.map((s) => [s.id, byAccount.get(s.id)?.get(d)?.followers ?? null])) }));
  const toggle = (id: string) =>
    setSlots((cur) => {
      const i = cur.indexOf(id);
      if (i >= 0) return cur.map((x, j) => (j === i ? null : x));
      const free = cur.indexOf(null);
      if (free < 0) return cur;
      return cur.map((x, j) => (j === free ? id : x));
    });
  const full = slots.every(Boolean);

  return (
    <Card className="gap-3">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>계정별 팔로워 추이</CardTitle>
        <PeriodToggle value={days} onChange={setDays} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="h-64" role="img" aria-label={`계정별 팔로워 추이, 최근 ${days}일`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: INK.secondary, fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: INK.secondary, fontSize: 11 }} width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toLocaleString("ko-KR")} />
              <Tooltip content={<ChartTooltip names={names} />} cursor={{ stroke: INK.secondary, strokeDasharray: "3 3" }} />
              {active.map((s) => (
                <Line key={s.id} type="monotone" dataKey={s.id} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* 범례 겸 선택(최대 8개) */}
        <div className="flex flex-wrap gap-1.5">
          {accounts.map((a) => {
            const slot = slots.indexOf(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                disabled={slot < 0 && full}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-40",
                  slot >= 0 ? "border-input bg-card text-foreground" : "border-dashed text-muted-foreground hover:bg-accent",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: slot >= 0 ? SERIES[slot] : "transparent", border: slot >= 0 ? "none" : `1px solid ${INK.secondary}` }} />
                @{a.username}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">계정을 눌러 그래프에 넣거나 뺍니다(최대 {MAX_LINES}개).</p>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ 반응 지표

function Reactions({ accounts, byAccount, today }: { accounts: DashAccount[]; byAccount: Map<string, Map<string, DashStat>>; today: string }) {
  const [metric, setMetric] = useState<Metric>("views");
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  const rows = accounts
    .map((a) => ({ name: `@${a.username}`, value: dates.reduce((s, d) => s + (byAccount.get(a.id)?.get(d)?.[metric] ?? 0), 0) }))
    .sort((x, y) => y.value - x.value);
  const shown = rows.slice(0, 12);
  const height = Math.max(160, shown.length * 28 + 24);

  return (
    <Card className="gap-3">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>계정별 반응 지표</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border bg-card p-0.5 text-xs">
            {(Object.keys(METRICS) as Metric[]).map((m) => (
              <button key={m} type="button" onClick={() => setMetric(m)} className={cn("rounded px-2.5 py-1", metric === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                {METRICS[m]}
              </button>
            ))}
          </div>
          <PeriodToggle value={days} onChange={setDays} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div style={{ height }} role="img" aria-label={`계정별 ${METRICS[metric]}, 최근 ${days}일 합계`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shown} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 0 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke={INK.grid} />
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={110} tick={{ fill: INK.secondary, fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "rgba(31,29,26,0.04)" }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-lg">
                      <div className="font-medium">{(payload[0].payload as { name: string }).name}</div>
                      <div className="num" style={{ color: INK.secondary }}>
                        {METRICS[metric]} {n(payload[0].value as number)}
                      </div>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="value" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" formatter={(v: unknown) => n(Number(v))} style={{ fill: INK.secondary, fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground">
          최근 {days}일 합계{rows.length > shown.length ? ` · 상위 ${shown.length}개 계정(전체는 아래 표)` : ""}.{metric === "views" ? " 조회수는 Threads 기준 프로필 조회수입니다." : ""}
        </p>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ 계정 표

const PERIODS = { today: "오늘", yesterday: "어제", d7: "7일", d14: "14일", d30: "30일" } as const;
type Period = keyof typeof PERIODS;
type SortKey = "username" | "group" | "followers" | "delta" | "views" | "replies" | "likes" | "status" | "synced";
const STATUS_LABEL: Record<string, string> = { active: "정상", needs_reconnect: "재연결 필요", disabled: "해제됨" };

function AccountTable({
  accounts,
  groups,
  byAccount,
  today,
  selectedId,
  onSelect,
}: {
  accounts: DashAccount[];
  groups: Group[];
  byAccount: Map<string, Map<string, DashStat>>;
  today: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState<Period>("d7");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "followers", desc: true });
  const [page, setPage] = useState(1);
  const PAGE = 50;
  const yesterday = addDays(today, -1);
  const groupName = new Map(groups.map((g) => [g.id, g]));
  const dates = period === "today" ? [today] : period === "yesterday" ? [yesterday] : Array.from({ length: period === "d7" ? 7 : period === "d14" ? 14 : 30 }, (_, i) => addDays(today, -i));

  const rows = accounts
    .filter((a) => (!q || a.username.toLowerCase().includes(q.toLowerCase())) && (!group || a.group_id === group) && (!status || a.status === status))
    .map((a) => {
      const s = byAccount.get(a.id);
      const sum = (k: "views" | "replies" | "likes") => dates.reduce((t, d) => t + (s?.get(d)?.[k] ?? 0), 0);
      const fToday = s?.get(today)?.followers ?? a.follower_count;
      const fYest = s?.get(yesterday)?.followers ?? null;
      return {
        a,
        groupLabel: a.group_id ? (groupName.get(a.group_id)?.name ?? "") : "",
        followers: fToday ?? null,
        yesterday: fYest,
        delta: fToday !== null && fToday !== undefined && fYest !== null ? fToday - fYest : null,
        views: sum("views"),
        replies: sum("replies"),
        likes: sum("likes"),
      };
    });
  const val = (r: (typeof rows)[number]): string | number => {
    switch (sort.key) {
      case "username":
        return r.a.username;
      case "group":
        return r.groupLabel;
      case "status":
        return r.a.status;
      case "synced":
        return r.a.last_synced_at ?? "";
      case "followers":
        return r.followers ?? -1;
      case "delta":
        return r.delta ?? -Infinity;
      default:
        return r[sort.key];
    }
  };
  rows.sort((x, y) => {
    const a = val(x), b = val(y);
    const c = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ko");
    return sort.desc ? -c : c;
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  useEffect(() => setPage(1), [q, group, status, period]);

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={cn("px-3 py-2 font-medium", right && "text-right")}>
      <button type="button" className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")} onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k !== "username" && k !== "group" }))}>
        {children}
        {sort.key === k ? sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );

  return (
    <Card className="min-w-0 gap-3">
      <CardHeader className="flex-row flex-wrap items-center gap-2">
        <CardTitle className="mr-auto">계정</CardTitle>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 w-44 pl-8" placeholder="계정 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <NativeSelect className="w-32" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">모든 그룹</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">모든 상태</option>
          <option value="active">정상</option>
          <option value="needs_reconnect">재연결 필요</option>
        </NativeSelect>
        <div className="flex gap-1">
          {(Object.keys(PERIODS) as Period[]).map((p) => (
            <Chip key={p} selected={period === p} onClick={() => setPeriod(p)} className="h-8">
              {PERIODS[p]}
            </Chip>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <Th k="username">계정</Th>
                <Th k="group">그룹</Th>
                <Th k="followers" right>
                  팔로워(어제→오늘)
                </Th>
                <Th k="delta" right>
                  증감
                </Th>
                <Th k="views" right>
                  조회수
                </Th>
                <Th k="replies" right>
                  댓글수
                </Th>
                <Th k="likes" right>
                  좋아요수
                </Th>
                <Th k="status">상태</Th>
                <Th k="synced">마지막 갱신</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const g = r.a.group_id ? groupName.get(r.a.group_id) : null;
                return (
                  <tr
                    key={r.a.id}
                    onClick={() => onSelect(selectedId === r.a.id ? null : r.a.id)}
                    className={cn("cursor-pointer border-b last:border-0 hover:bg-accent/50", selectedId === r.a.id && "bg-primary-soft/50")}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <AccountAvatar src={r.a.profile_picture_url} username={r.a.username} size={28} />
                        <span className="font-medium">@{r.a.username}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {g ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: g.color }} />
                          {g.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="num px-3 py-2 text-right">
                      <span className="text-muted-foreground">{r.yesterday === null ? "-" : n(r.yesterday)} → </span>
                      {r.followers === null ? "-" : n(r.followers)}
                    </td>
                    <td className="num px-3 py-2 text-right">
                      {r.delta === null ? (
                        <span className="text-muted-foreground">-</span>
                      ) : r.delta > 0 ? (
                        <span className="text-success">▲ {n(r.delta)}</span>
                      ) : r.delta < 0 ? (
                        <span className="text-destructive">▼ {n(-r.delta)}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="num px-3 py-2 text-right">{n(r.views)}</td>
                    <td className="num px-3 py-2 text-right">{n(r.replies)}</td>
                    <td className="num px-3 py-2 text-right">{n(r.likes)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.a.status === "active" ? "success" : r.a.status === "needs_reconnect" ? "error" : "default"}>{STATUS_LABEL[r.a.status] ?? r.a.status}</Badge>
                    </td>
                    <td className="num px-3 py-2 text-xs text-muted-foreground">{r.a.last_synced_at ? formatKst(r.a.last_synced_at, "M/d HH:mm") : "-"}</td>
                  </tr>
                );
              })}
              {!shown.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    해당하는 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 pt-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              이전
            </Button>
            <span className="num text-sm">
              {page} / {pageCount}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
              다음
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ 상세 패널

function DetailPanel({ account, series, today, onClose }: { account: DashAccount; series: Map<string, DashStat> | undefined; today: string; onClose: () => void }) {
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    accountDetailAction(account.id).then((r) => {
      if (!alive) return;
      if (r.ok) setDetail(r.data);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [account.id]);
  const data = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((d) => ({ date: shortDate(d), followers: series?.get(d)?.followers ?? null }));

  return (
    <Card className="gap-3 2xl:sticky 2xl:top-6 2xl:self-start">
      <CardHeader className="flex-row items-center gap-3">
        <AccountAvatar src={account.profile_picture_url} username={account.username} />
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">@{account.username}</CardTitle>
          <div className="num text-xs text-muted-foreground">팔로워 {n(account.follower_count)}</div>
        </div>
        <Button variant="ghost" size="icon" aria-label="닫기" onClick={onClose}>
          <X />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section>
          <div className="mb-1 text-xs font-medium text-muted-foreground">팔로워 추이 (30일)</div>
          <div className="h-36" role="img" aria-label={`@${account.username} 팔로워 추이 30일`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: INK.secondary, fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: INK.secondary, fontSize: 10 }} width={44} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toLocaleString("ko-KR")} />
                <Tooltip content={<ChartTooltip names={{ followers: "팔로워" }} />} cursor={{ stroke: INK.secondary, strokeDasharray: "3 3" }} />
                <Line type="monotone" dataKey="followers" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            최근 게시물 성과
            <Link href={`/published?account=${account.id}`} className="text-primary hover:underline">
              전체 보기
            </Link>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!detail && !error && <p className="text-sm text-muted-foreground">불러오는 중…</p>}
          {detail && !detail.recent.length && <p className="text-sm text-muted-foreground">발행된 글이 없습니다.</p>}
          <ul className="flex flex-col divide-y">
            {detail?.recent.map((p) => (
              <li key={p.id} className="flex items-start gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm">{p.text || "(사진 글)"}</p>
                  <div className="num text-xs text-muted-foreground">
                    {formatKst(p.publishedAt, "M/d")} · 조회 {n(p.views)} · 좋아요 {n(p.likes)} · 댓글 {n(p.replies)}
                  </div>
                </div>
                {p.permalink && (
                  <a href={p.permalink} target="_blank" rel="noreferrer" aria-label="Threads에서 보기" className="mt-0.5 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            예약된 글
            <Link href={`/scheduled?account=${account.id}`} className="text-primary hover:underline">
              전체 보기
            </Link>
          </div>
          {detail && !detail.upcoming.length && <p className="text-sm text-muted-foreground">예약된 글이 없습니다.</p>}
          <ul className="flex flex-col divide-y">
            {detail?.upcoming.map((p) => (
              <li key={p.id} className="py-2">
                <div className="num text-xs text-muted-foreground">
                  {formatKst(p.scheduledAt, "M/d HH:mm")} {p.status === "review" ? "· 검토 대기" : ""}
                </div>
                <p className="line-clamp-1 text-sm">{p.text || "(발행할 때 창고에서 뽑음)"}</p>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

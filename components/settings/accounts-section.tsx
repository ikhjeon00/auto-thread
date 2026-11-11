"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Link2, RefreshCw, Send, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { THREADS_TEXT_LIMIT, countThreadsChars } from "@/lib/threads/text";
import { daysUntil, formatKst } from "@/lib/time";
import { cn } from "@/lib/utils";
import { disconnectAccount, testPublish, updateAccount } from "@/app/(main)/settings/actions";
import { AccountAvatar } from "./account-avatar";
import type { AccountView, GroupView } from "./types";

const STATUS: Record<AccountView["status"], { label: string; variant: "success" | "error" | "default" }> = {
  active: { label: "정상", variant: "success" },
  needs_reconnect: { label: "재연결 필요", variant: "error" },
  disabled: { label: "해제됨", variant: "default" },
};

export function AccountsSection({ accounts, groups }: { accounts: AccountView[]; groups: GroupView[] }) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Threads 계정</CardTitle>
          <CardDescription>
            연결된 계정 <span className="num font-medium text-foreground">{accounts.filter((a) => a.status !== "disabled").length}</span>
            개 · 최대 50개
          </CardDescription>
        </div>
        <Button asChild>
          {/* OAuth는 전체 페이지 이동이 필요해서 <a> 사용 */}
          <a href="/api/threads/oauth/start">
            <Link2 /> 계정 연결
          </a>
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        {accounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            아직 연결된 계정이 없습니다. 아래 안내대로 테스터 초대를 수락한 뒤 &lsquo;계정 연결&rsquo;을 누르세요.
          </p>
        ) : (
          <ul className="divide-y border-t">
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} groups={groups} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AccountRow({ account: a, groups }: { account: AccountView; groups: GroupView[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [limit, setLimit] = useState(String(a.daily_post_limit));
  const st = STATUS[a.status];
  const left = daysUntil(a.token_expires_at);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "오류");
    });

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <AccountAvatar src={a.profile_picture_url} username={a.username} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={`https://www.threads.com/@${a.username}`}
                target="_blank"
                rel="noreferrer"
                className="truncate font-semibold hover:underline"
              >
                @{a.username}
              </a>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
            <div className="num text-xs text-muted-foreground">
              {a.status === "disabled"
                ? "토큰 없음"
                : `토큰 만료 ${formatKst(a.token_expires_at, "yyyy-MM-dd")}${left !== null ? ` (${left}일 남음)` : ""}`}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">그룹</span>
          <NativeSelect
            className="w-32"
            value={a.group_id ?? ""}
            disabled={pending}
            onChange={(e) => run(() => updateAccount(a.id, { group_id: e.target.value || null }))}
          >
            <option value="">없음</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">하루 최대</span>
          <Input
            type="number"
            min={0}
            max={250}
            className="num w-20"
            value={limit}
            disabled={pending}
            onChange={(e) => setLimit(e.target.value)}
            onBlur={() => {
              if (limit !== String(a.daily_post_limit)) run(() => updateAccount(a.id, { daily_post_limit: Number(limit) }));
            }}
          />
          <span className="text-muted-foreground">개</span>
        </label>

        <div className="flex items-center gap-1.5">
          {a.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => setTestOpen((v) => !v)}>
              <Send /> 테스트 발행
            </Button>
          )}
          <Button variant={a.status === "active" ? "ghost" : "default"} size="sm" asChild>
            <a href="/api/threads/oauth/start">
              <RefreshCw /> {a.status === "disabled" ? "다시 연결" : "재연결"}
            </a>
          </Button>
          {a.status !== "disabled" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm(`@${a.username} 계정 연결을 해제할까요?\n예약된 글은 모두 취소됩니다.`)) run(() => disconnectAccount(a.id));
              }}
            >
              <Unplug /> 해제
            </Button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {testOpen && <TestPublish accountId={a.id} />}
    </li>
  );
}

function TestPublish({ accountId }: { accountId: string }) {
  const [text, setText] = useState("AUTO THREAD 연결 테스트 글입니다.");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; link?: string | null } | null>(null);
  const count = countThreadsChars(text);
  const over = count > THREADS_TEXT_LIMIT;

  return (
    <div className="mt-3 rounded-md border bg-background p-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} disabled={pending} aria-invalid={over} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={cn("num text-xs", over ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {count} / {THREADS_TEXT_LIMIT}
        </span>
        <Button
          size="sm"
          disabled={pending || over || !text.trim()}
          onClick={() =>
            start(async () => {
              setResult(null);
              const r = await testPublish(accountId, text);
              setResult(
                r.ok
                  ? { ok: true, message: "발행했습니다.", link: r.data?.permalink }
                  : { ok: false, message: r.error },
              );
            })
          }
        >
          {pending ? "발행 중… (최대 30초)" : "지금 발행"}
        </Button>
      </div>
      {result && (
        <p className={cn("mt-2 flex items-center gap-2 text-sm", result.ok ? "text-success" : "text-destructive")}>
          {result.message}
          {result.link && (
            <a href={result.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
              Threads에서 보기 <ExternalLink className="size-3.5" />
            </a>
          )}
        </p>
      )}
    </div>
  );
}

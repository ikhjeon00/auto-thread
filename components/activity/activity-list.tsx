"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertCircle, AlertTriangle, CheckCheck, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { formatKst } from "@/lib/time";
import { cn } from "@/lib/utils";
import { markAllReadAction, markReadAction } from "@/app/(main)/activity/actions";

export type NotificationItem = {
  id: string;
  level: "info" | "warn" | "error";
  type: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const LEVEL = {
  info: { icon: Info, cls: "text-success", label: "정보" },
  warn: { icon: AlertTriangle, cls: "text-warning", label: "경고" },
  error: { icon: AlertCircle, cls: "text-destructive", label: "오류" },
} as const;

export function ActivityList({
  items,
  unreadCount,
  filter,
  types,
  page,
  pageCount,
}: {
  items: NotificationItem[];
  unreadCount: number;
  filter: { unreadOnly: boolean; level: string | null; type: string | null };
  types: Record<string, string>;
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const go = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (!("page" in patch)) sp.delete("page");
    router.push(`${pathname}?${sp}`);
  };

  const open = (n: NotificationItem) => {
    if (!n.is_read && !readIds.has(n.id)) {
      setReadIds((s) => new Set(s).add(n.id));
      void markReadAction([n.id]).then(() => router.refresh());
    }
    if (!n.link) return;
    if (/^https?:\/\//.test(n.link)) window.open(n.link, "_blank", "noopener");
    else router.push(n.link);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip selected={!filter.unreadOnly} onClick={() => go({ filter: null })}>
          전체
        </Chip>
        <Chip selected={filter.unreadOnly} onClick={() => go({ filter: "unread" })}>
          읽지 않음 <span className="num">{unreadCount}</span>
        </Chip>
        <span className="mx-1 h-5 w-px bg-border" />
        {Object.entries(types).map(([k, label]) => (
          <Chip key={k} selected={filter.type === k} onClick={() => go({ type: filter.type === k ? null : k })}>
            {label}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {(["error", "warn"] as const).map((l) => (
          <Chip key={l} selected={filter.level === l} onClick={() => go({ level: filter.level === l ? null : l })}>
            {LEVEL[l].label}만
          </Chip>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={pending || unreadCount === 0}
          onClick={() =>
            start(async () => {
              await markAllReadAction();
              setReadIds(new Set(items.map((i) => i.id)));
              router.refresh();
            })
          }
        >
          <CheckCheck /> 모두 읽음
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">알림이 없습니다.</CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {items.map((n) => {
              const read = n.is_read || readIds.has(n.id);
              const L = LEVEL[n.level] ?? LEVEL.info;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/60", !read && "bg-primary-soft/40")}
                  >
                    <L.icon className={cn("mt-0.5 size-4 shrink-0", L.cls)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm break-words", !read && "font-medium")}>{n.message}</p>
                      <p className="num mt-0.5 text-xs text-muted-foreground" title={formatKst(n.created_at, "yyyy-MM-dd HH:mm:ss")}>
                        {formatDistanceToNowStrict(new Date(n.created_at), { locale: ko, addSuffix: true })} · {formatKst(n.created_at, "M/d HH:mm")}
                      </p>
                    </div>
                    {!read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="읽지 않음" />}
                    {n.link && /^https?:/.test(n.link) && <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>
            이전
          </Button>
          <span className="num text-sm">
            {page} / {pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => go({ page: String(page + 1) })}>
            다음
          </Button>
        </div>
      )}
    </div>
  );
}

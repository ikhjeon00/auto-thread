"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, ExternalLink, Heart, MessageCircle, Repeat2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import { AccountAvatar } from "@/components/settings/account-avatar";
import { formatKst } from "@/lib/time";
import { cn } from "@/lib/utils";
import { toggleBookmarkAction } from "@/app/(main)/published/actions";

export type PublishedItem = {
  id: string;
  username: string;
  avatarUrl: string | null;
  kind: string;
  text: string;
  permalink: string | null;
  publishedAt: string;
  insights: { views: number; likes: number; replies: number; reposts: number; updated_at: string } | null;
  bookmarked: boolean;
  thumb: { url: string; type: string } | null;
  mediaCount: number;
  repliesFailed: number;
};

const n = (v: number | undefined) => (v ?? 0).toLocaleString("ko-KR");

export function PublishedList({
  items,
  accounts,
  accountId,
  page,
  pageCount,
  total,
}: {
  items: PublishedItem[];
  accounts: { id: string; username: string }[];
  accountId: string | null;
  page: number;
  pageCount: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const go = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (!("page" in patch)) sp.delete("page");
    router.push(`${pathname}?${sp}`);
  };
  const noInsights = items.length > 0 && items.every((i) => !i.insights);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect className="w-48" value={accountId ?? ""} onChange={(e) => go({ account: e.target.value || null })}>
          <option value="">모든 계정</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.username}
            </option>
          ))}
        </NativeSelect>
        <span className="num ml-auto text-sm text-muted-foreground">{total}개</span>
      </div>
      {noInsights && (
        <p className="text-xs text-muted-foreground">조회수·좋아요·댓글 수는 통계 수집(3시간마다)이 돌면 채워집니다.</p>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            아직 발행된 글이 없습니다.{" "}
            <Link href="/compose" className="text-primary underline">
              글 작성하기
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {items.map((i) => (
              <Row key={i.id} item={i} />
            ))}
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

function Row({ item: i }: { item: PublishedItem }) {
  const [saved, setSaved] = useState(i.bookmarked);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex gap-3 px-4 py-4">
      {i.thumb ? (
        i.thumb.type === "video" ? (
          <video src={i.thumb.url} className="size-16 shrink-0 rounded-md border bg-black object-cover" muted preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={i.thumb.url} alt="" className="size-16 shrink-0 rounded-md border object-cover" />
        )
      ) : (
        <AccountAvatar src={i.avatarUrl} username={i.username} size={40} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-medium">@{i.username}</span>
          <span className="num text-xs text-muted-foreground">{formatKst(i.publishedAt, "yyyy-MM-dd HH:mm")}</span>
          {i.kind === "product" && <Badge variant="outline">상품</Badge>}
          {i.mediaCount > 1 && <Badge variant="outline">사진 {i.mediaCount}</Badge>}
          {i.repliesFailed > 0 && (
            <Link href={`/scheduled?status=failed&post=${i.id}`}>
              <Badge variant="error">댓글 실패 {i.repliesFailed}</Badge>
            </Link>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm whitespace-pre-wrap text-foreground/90">{i.text}</p>
        <div className="num mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="조회수">
            <Eye className="size-3.5" /> {n(i.insights?.views)}
          </span>
          <span className="inline-flex items-center gap-1" title="좋아요">
            <Heart className="size-3.5" /> {n(i.insights?.likes)}
          </span>
          <span className="inline-flex items-center gap-1" title="댓글">
            <MessageCircle className="size-3.5" /> {n(i.insights?.replies)}
          </span>
          <span className="inline-flex items-center gap-1" title="리포스트">
            <Repeat2 className="size-3.5" /> {n(i.insights?.reposts)}
          </span>
          {i.insights?.updated_at && <span>갱신 {formatKst(i.insights.updated_at, "M/d HH:mm")}</span>}
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={saved ? "보석함에서 빼기" : "보석함에 저장"}
          title={saved ? "보석함에서 빼기" : "보석함에 저장"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await toggleBookmarkAction(i.id);
              if (r.ok) setSaved(r.data.saved);
              setError(r.ok ? null : r.error);
            })
          }
        >
          <Star className={cn("size-5", saved ? "fill-primary text-primary" : "text-muted-foreground")} />
        </Button>
        {i.permalink && (
          <Button variant="ghost" size="icon" asChild title="Threads에서 보기">
            <a href={i.permalink} target="_blank" rel="noreferrer" aria-label="Threads에서 보기">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}

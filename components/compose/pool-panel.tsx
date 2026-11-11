"use client";

import { useState, useTransition } from "react";
import { Archive, Loader2, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Compose } from "@/lib/compose/schema";
import { pickFromPoolAction, type PoolPick } from "@/app/(main)/compose/actions";

/** 글 창고에서 랜덤으로 뽑아 본문·첫 댓글·주제에 넣는다. 다시 뽑으면 이전 글은 창고로 돌아간다 */
export function PoolPanel({ c, poolId, onPick }: { c: Compose; poolId: string | null; onPick: (p: PoolPick) => void }) {
  const [picked, setPicked] = useState<PoolPick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pick = () =>
    start(async () => {
      setError(null);
      const r = await pickFromPoolAction(c.accountId, { poolId, previousItemId: c.poolItemId });
      if (r.ok) {
        setPicked(r.data);
        onPick(r.data);
      } else setError(r.error);
    });

  return (
    <Card className="gap-3 border-primary/30">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Archive className="size-4 text-primary" /> 글 창고에서 가져오기
        </CardTitle>
        <Button size="sm" onClick={pick} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Shuffle />}
          {c.poolItemId ? "다른 글 뽑기" : "랜덤으로 뽑기"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-destructive">{error}</p>}
        {!c.poolItemId && !error && (
          <p className="text-muted-foreground">
            이 계정에 연결된 창고에서 규칙(다른 계정이 쓴 글·재사용 금지 기간·직전 글과 같은 분류 제외, 가중치 랜덤)에 맞는 글을 하나 뽑아 아래에 넣습니다. 뽑은 글은 예약됨으로
            잡히고, 발행되면 사용 완료가 됩니다.
          </p>
        )}
        {c.poolItemId && (
          <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
            뽑은 글을 아래에 넣었습니다.
            {picked?.poolName && <Badge variant="outline">{picked.poolName}</Badge>}
            {picked?.category && <Badge variant="outline">{picked.category}</Badge>}
            필요하면 아래에서 고쳐 쓰세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

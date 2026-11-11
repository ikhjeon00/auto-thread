"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import { countThreadsChars } from "@/lib/threads/text";
import { cn } from "@/lib/utils";
import type { Compose } from "@/lib/compose/schema";
import { generateAction, type GeneratedCandidate } from "@/app/(main)/compose/actions";

function usd(v: number | null): string {
  if (v === null) return "단가 미입력";
  return "$" + (v < 0.01 ? v.toFixed(4) : v.toFixed(3));
}

/** AI 후보 만들기 → 비교 → 적용 */
export function AiPanel({
  c,
  candidates,
  setCandidates,
  onApply,
}: {
  c: Compose;
  candidates: GeneratedCandidate[];
  setCandidates: (fn: (prev: GeneratedCandidate[]) => GeneratedCandidate[]) => void;
  onApply: (cand: GeneratedCandidate) => void;
}) {
  const [count, setCount] = useState(3);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const needTopic = c.kind === "product" && !c.aiTopic?.trim() && !c.media.length;
  const images = c.media.filter((m) => m.mediaType === "image").slice(0, 4);
  const [useImages, setUseImages] = useState(true);

  const generate = () =>
    start(async () => {
      setError(null);
      const r = await generateAction({
        accountId: c.accountId,
        generatorId: c.generatorId,
        kind: c.kind,
        topic: c.aiTopic,
        count,
        imageUrls: useImages && images.length ? images.map((m) => m.publicUrl) : undefined,
      });
      if (r.ok) {
        setCandidates((prev) => [...r.data, ...prev]);
        setApplied((a) => (a === null ? null : a + r.data.length));
      } else setError(r.error);
    });

  return (
    <Card className="gap-3 border-primary/30">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Sparkles className="size-4 text-primary" /> AI 후보
          {c.aiTopic && <span className="font-normal text-muted-foreground">· {c.aiTopic.slice(0, 30)}</span>}
        </CardTitle>
        <div className="flex items-center gap-2">
          <NativeSelect className="w-24" value={String(count)} onChange={(e) => setCount(Number(e.target.value))} aria-label="한 번에 만들 개수">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}개씩
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" onClick={generate} disabled={pending || needTopic}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "만드는 중… (최대 1분)" : candidates.length ? "다른 글 만들기" : "글 만들기"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {needTopic && <p className="text-xs text-warning">상품 홍보글은 1단계에서 상품명·특징을 입력하거나 사진을 첨부하세요.</p>}
        {images.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={useImages} onChange={(e) => setUseImages(e.target.checked)} />
            첨부한 사진 {images.length}장을 AI에게 보여 주고 쓰기 <span className="text-xs text-muted-foreground">(설정의 사진 이해 모델 사용)</span>
          </label>
        )}
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>}
        {!candidates.length && !pending && !error && (
          <p className="text-sm text-muted-foreground">
            &lsquo;글 만들기&rsquo;를 누르면 페르소나·주제·글 형식에 맞춘 후보가 나옵니다. 마음에 드는 후보를 &lsquo;적용&rsquo;하면 아래 본문과 첫 댓글에 들어갑니다.
          </p>
        )}
        {candidates.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {candidates.map((cand, i) => (
              <li
                key={`${cand.text.slice(0, 20)}-${i}`}
                className={cn("flex flex-col gap-2 rounded-md border bg-background p-3", applied === i && "border-primary ring-1 ring-primary")}
              >
                <p className="text-sm whitespace-pre-wrap">{cand.text}</p>
                {cand.first_reply && <p className="border-l-2 pl-2 text-xs whitespace-pre-wrap text-muted-foreground">첫 댓글: {cand.first_reply}</p>}
                <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <span className="num">{countThreadsChars(cand.text)}자</span>·<span>{cand.meta.format.split(":")[0]}</span>·<span>{cand.meta.length}</span>
                  {cand.topic_tag && <Badge variant="outline">{cand.topic_tag}</Badge>}
                </div>
                {cand.issues.length > 0 && (
                  <p className="flex items-start gap-1 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {cand.issues.join(" / ")}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="truncate text-[11px] text-muted-foreground" title={`${cand.meta.model} · ${cand.meta.topic}`}>
                    {cand.meta.model} · 약 {usd(cand.meta.costUsd)}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="후보 지우기"
                      onClick={() => {
                        setCandidates((prev) => prev.filter((_, j) => j !== i));
                        setApplied(null);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={applied === i ? "default" : "outline"}
                      onClick={() => {
                        onApply(cand);
                        setApplied(i);
                      }}
                    >
                      <Check /> {applied === i ? "적용됨" : "적용"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

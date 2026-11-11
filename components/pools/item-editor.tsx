"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checks, Preview, StepWrite, type ComposerDisclosure } from "@/components/compose/composer";
import { buildPlan, hasErrors, hostOf, matchDisclosure } from "@/lib/compose/plan";
import { emptyCompose, type Compose, type PoolContent } from "@/lib/compose/schema";
import { cn } from "@/lib/utils";
import { savePoolContentAction } from "@/app/(main)/pools/actions";

type Status = "pending" | "available" | "archived";
const STATUS_LABEL: Record<Status, string> = { pending: "검수 대기", available: "사용 가능", archived: "보관" };

/** 창고 글 편집: 글 작성의 '작성' 단계와 같은 편집 칸 + 모바일 미리보기 */
export function PoolItemEditor({
  poolId,
  poolName,
  itemId,
  initial,
  meta,
  lockedStatus,
  disclosures,
  bannedWords,
}: {
  poolId: string;
  poolName: string;
  itemId: string | null;
  initial: PoolContent;
  meta: { category: string | null; weight: number; status: Status };
  /** 예약됨·사용 완료 글은 상태를 여기서 바꾸지 않는다 */
  lockedStatus: string | null;
  disclosures: ComposerDisclosure[];
  bannedWords: string[];
}) {
  const router = useRouter();
  // 편집 부품은 글 작성 형태(Compose)를 쓰므로 계정 없이 감싼다
  const [c, setC] = useState<Compose>({ ...emptyCompose(), ...initial });
  const [category, setCategory] = useState(meta.category ?? "");
  const [weight, setWeight] = useState(String(meta.weight));
  const [status, setStatus] = useState<Status>(meta.status);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof Compose>(k: K, v: Compose[K]) => setC((prev) => ({ ...prev, [k]: v }));
  const disclosure = disclosures.find((d) => d.id === c.disclosureId) ?? null;
  const plan = useMemo(() => buildPlan(c, { disclosure, bannedWords }), [c, disclosure, bannedWords]);

  // 글 작성과 같게: 링크 도메인이 고지 문구와 맞으면 자동 선택, 상품 홍보면 기본 고지 문구
  const lastHost = useRef<string | null>(hostOf(initial.linkUrl));
  useEffect(() => {
    const host = hostOf(c.linkUrl);
    if (host === lastHost.current) return;
    lastHost.current = host;
    const m = matchDisclosure(c.linkUrl, disclosures);
    if (m && m.id !== c.disclosureId) setC((prev) => ({ ...prev, disclosureId: m.id, disclosurePosition: m.default_position }));
  }, [c.linkUrl, c.disclosureId, disclosures]);
  useEffect(() => {
    if (c.kind !== "product") return;
    const d = c.disclosureId ? null : (disclosures.find((x) => x.is_default) ?? disclosures[0]);
    setC((prev) => ({ ...prev, firstReplyMainMedia: true, ...(d ? { disclosureId: d.id } : {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.kind]);

  const save = () =>
    start(async () => {
      setError(null);
      const { kind, text, media, replies, firstReplyMainMedia, linkUrl, linkPosition, topicTag, disclosureId, disclosurePosition, isAiLabel } = c;
      const r = await savePoolContentAction(
        poolId,
        itemId,
        { kind, text, media, replies, firstReplyMainMedia, linkUrl, linkPosition, topicTag, disclosureId, disclosurePosition, isAiLabel },
        { category: category || null, weight: Number(weight) || 1, ...(lockedStatus ? {} : { status }) },
      );
      if (!r.ok) return setError(r.error);
      router.push(`/pools/${poolId}`);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5 pb-20 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className={cn("flex min-w-0 flex-col gap-4", mobileTab === "preview" && "hidden lg:flex")}>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-sm">창고 글 정보</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-sm text-muted-foreground">글 종류</span>
                <Chip selected={c.kind === "general"} onClick={() => set("kind", "general")}>
                  일반
                </Chip>
                <Chip selected={c.kind === "product"} onClick={() => set("kind", "product")}>
                  상품 홍보
                </Chip>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-sm text-muted-foreground">상태</span>
                {lockedStatus ? (
                  <span className="text-sm">{lockedStatus} (발행·예약에 쓰이는 중이라 상태는 그대로 둡니다)</span>
                ) : (
                  (Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <Chip key={s} selected={status === s} onClick={() => setStatus(s)}>
                      {STATUS_LABEL[s]}
                    </Chip>
                  ))
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-cat">분류 (같은 분류가 연달아 나가지 않게 할 때 씀)</Label>
                  <Input id="pi-cat" maxLength={30} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예) 직장, 음식, 살림" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-w">가중치 (클수록 자주)</Label>
                  <Input id="pi-w" type="number" min={1} max={100} className="num" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <StepWrite c={c} set={set} plan={plan} disclosures={disclosures} mediaFolder="assets" />
          <Checks plan={plan} similar={null} />
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" asChild>
              <Link href={`/pools/${poolId}`}>취소</Link>
            </Button>
            <Button onClick={save} disabled={pending || hasErrors(plan)}>
              <Save /> {pending ? "저장 중…" : itemId ? "저장" : `「${poolName}」에 추가`}
            </Button>
          </div>
        </div>

        <div className={cn("min-w-0 lg:block", mobileTab === "edit" && "hidden")}>
          <div className="lg:sticky lg:top-6">
            <Preview account={{ id: "", username: "창고 글 미리보기", profile_picture_url: null, status: "active" }} plan={plan} c={c} />
            <p className="mt-2 text-center text-xs text-muted-foreground">실제로는 이 글을 꺼내 쓰는 계정 이름으로 올라갑니다.</p>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t bg-card lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setMobileTab(t)} className={cn("h-12 text-sm font-medium", mobileTab === t ? "text-primary" : "text-muted-foreground")}>
            {t === "edit" ? "편집" : "미리보기"}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { recommendDaily, type FollowerTier } from "@/lib/scheduler/slots";
import { cn } from "@/lib/utils";
import { createFarmAction } from "@/app/(main)/farm/actions";

export type FarmAccount = { id: string; username: string; follower_count: number | null; daily_post_limit: number; status: string };
export type FarmPool = { id: string; name: string; accountIds: string[] };
export type FarmGenerator = { id: string; name: string; kind: string };
export type FarmProduct = { id: string; name: string; thumb: string | null; is_active: boolean };

type Props = {
  kind: "growth" | "monetize";
  accounts: FarmAccount[];
  tiers: FollowerTier[];
  pools: FarmPool[];
  generators: FarmGenerator[];
  products?: FarmProduct[];
  activeHours: { start: string; end: string };
  sameAccountGapMinutes: number;
  aiReady: boolean;
  tomorrow: string;
};

type Row = { selected: boolean; general: string; product: string };

export function FarmForm(p: Props) {
  const router = useRouter();
  const monetize = p.kind === "monetize";
  const usable = p.accounts.filter((a) => a.status === "active");
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      usable.map((a) => {
        const rec = recommendDaily(a.follower_count, p.tiers);
        return [a.id, { selected: false, general: String(monetize ? Math.max(1, rec - 1) : rec), product: monetize ? "1" : "0" }];
      }),
    ),
  );
  const [startDate, setStartDate] = useState(p.tomorrow);
  const [days, setDays] = useState("7");
  const [activeStart, setActiveStart] = useState(p.activeHours.start);
  const [activeEnd, setActiveEnd] = useState(p.activeHours.end);
  const [source, setSource] = useState<"ai" | "pool">(p.aiReady ? "ai" : "pool");
  const [poolId, setPoolId] = useState<string>("");
  const [timing, setTiming] = useState<"pre" | "at_publish">("pre");
  const [generatorId, setGeneratorId] = useState("");
  const [productGeneratorId, setProductGeneratorId] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [useVision, setUseVision] = useState(true);
  const [isAiLabel, setIsAiLabel] = useState(true);
  const [mode, setMode] = useState<"review" | "auto">("review");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selected = usable.filter((a) => rows[a.id]?.selected);
  const perDay = (a: FarmAccount) => (Number(rows[a.id]?.general) || 0) + (monetize ? Number(rows[a.id]?.product) || 0 : 0);
  const total = selected.reduce((s, a) => s + perDay(a), 0) * (Number(days) || 0);
  const windowMin = (() => {
    const [sh, sm] = activeStart.split(":").map(Number);
    const [eh, em] = activeEnd.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  })();
  const tight = selected.filter((a) => perDay(a) > 0 && windowMin / perDay(a) < p.sameAccountGapMinutes);
  const overLimit = selected.filter((a) => perDay(a) > a.daily_post_limit);
  const pools = useMemo(() => p.pools.filter((pl) => selected.some((a) => pl.accountIds.includes(a.id))), [p.pools, selected]);
  const generalGens = p.generators.filter((g) => g.kind === "daily");
  const productGens = p.generators.filter((g) => g.kind === "product" || g.kind === "vision");
  const needsAi = source === "ai" || monetize;
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await createFarmAction({
        kind: p.kind,
        accounts: selected.map((a) => ({ id: a.id, generalCount: Number(rows[a.id].general) || 0, productCount: monetize ? Number(rows[a.id].product) || 0 : 0 })),
        startDate,
        days: Number(days),
        activeStart,
        activeEnd,
        generalSource: source,
        poolId: source === "pool" ? poolId || null : null,
        assignTiming: timing,
        generatorId: generatorId || null,
        productGeneratorId: productGeneratorId || null,
        productIds,
        useVision,
        isAiLabel,
        mode,
      });
      if (r.ok) router.push(`/farm/batch/${r.data.batchId}`);
      else setError(r.error);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{monetize ? "새 수익화 농장" : "새 계정 키우기 농장"}</CardTitle>
        <CardDescription>
          {monetize
            ? "상품글을 일상글과 섞어 기간 동안 배치합니다. 링크와 고지 문구는 AI가 아니라 서버가 첫 댓글에 그대로 붙입니다."
            : "기간 동안 계정마다 글을 만들어 활동 시간대에 자연스럽게 나눠 예약합니다."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* 계정 */}
        <section className="flex flex-col gap-2">
          <Label>계정과 하루 게시 수 {monetize ? "(일상글 / 상품글)" : ""}</Label>
          {usable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              연결된 계정이 없습니다. <Link href="/settings" className="text-primary underline">설정에서 연결하세요.</Link>
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="전체 선택"
                        className="size-4 accent-[var(--primary)]"
                        checked={selected.length === usable.length}
                        onChange={(e) => setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, selected: e.target.checked }])))}
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">계정</th>
                    <th className="px-3 py-2 font-medium">팔로워</th>
                    <th className="px-3 py-2 font-medium">추천</th>
                    <th className="px-3 py-2 font-medium">{monetize ? "일상글" : "하루 게시 수"}</th>
                    {monetize && <th className="px-3 py-2 font-medium">상품글</th>}
                    <th className="px-3 py-2 font-medium">하루 최대</th>
                  </tr>
                </thead>
                <tbody>
                  {usable.map((a) => {
                    const r = rows[a.id];
                    return (
                      <tr key={a.id} className={cn("border-t", r.selected && "bg-primary-soft/40")}>
                        <td className="px-3 py-1.5">
                          <input type="checkbox" aria-label={`@${a.username} 선택`} className="size-4 accent-[var(--primary)]" checked={r.selected} onChange={(e) => setRow(a.id, { selected: e.target.checked })} />
                        </td>
                        <td className="px-3 py-1.5 font-medium">@{a.username}</td>
                        <td className="num px-3 py-1.5 text-muted-foreground">{a.follower_count?.toLocaleString("ko-KR") ?? "-"}</td>
                        <td className="num px-3 py-1.5 text-muted-foreground">{recommendDaily(a.follower_count, p.tiers)}</td>
                        <td className="px-3 py-1.5">
                          <Input type="number" min={0} max={30} className="num h-8 w-20" value={r.general} onChange={(e) => setRow(a.id, { general: e.target.value })} />
                        </td>
                        {monetize && (
                          <td className="px-3 py-1.5">
                            <Input type="number" min={0} max={30} className="num h-8 w-20" value={r.product} onChange={(e) => setRow(a.id, { product: e.target.value })} />
                          </td>
                        )}
                        <td className={cn("num px-3 py-1.5", perDay(a) > a.daily_post_limit ? "font-semibold text-warning" : "text-muted-foreground")}>{a.daily_post_limit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">추천 값은 설정 &gt; 글 설정의 팔로워 구간표를 따릅니다(팔로워 수는 통계 수집 후 채워짐).</p>
        </section>

        {/* 기간·시간대 */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-start">시작일</Label>
            <Input id="f-start" type="date" className="num" min={p.tomorrow} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-days">기간(일, 1~30)</Label>
            <Input id="f-days" type="number" min={1} max={30} className="num w-28" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>활동 시간대</Label>
            <div className="flex items-center gap-2">
              <Input type="time" className="num w-32" value={activeStart} onChange={(e) => setActiveStart(e.target.value)} />
              <span>~</span>
              <Input type="time" className="num w-32" value={activeEnd} onChange={(e) => setActiveEnd(e.target.value)} />
            </div>
          </div>
        </section>

        {/* 글 출처 */}
        <section className="flex flex-col gap-3">
          <Label>{monetize ? "일상글 출처" : "글 출처"}</Label>
          <div className="flex flex-wrap gap-2">
            <Chip selected={source === "ai"} disabled={!p.aiReady} onClick={() => setSource("ai")}>
              AI 새로 생성
            </Chip>
            <Chip selected={source === "pool"} onClick={() => setSource("pool")}>
              글 창고에서 랜덤
            </Chip>
          </div>
          {source === "ai" && (
            <NativeSelect className="max-w-sm" value={generatorId} onChange={(e) => setGeneratorId(e.target.value)}>
              <option value="">{generalGens[0] ? `기본 생성기 (${generalGens[0].name})` : "기본 생성기"}</option>
              {generalGens.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          )}
          {source === "pool" && (
            <div className="flex flex-col gap-3">
              <NativeSelect className="max-w-sm" value={poolId} onChange={(e) => setPoolId(e.target.value)}>
                <option value="">계정마다 연결된 창고 전체</option>
                {pools.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </NativeSelect>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">배정 시점</span>
                <Chip selected={timing === "pre"} onClick={() => setTiming("pre")}>
                  미리 배정
                </Chip>
                <Chip selected={timing === "at_publish"} onClick={() => setTiming("at_publish")}>
                  발행 직전 뽑기
                </Chip>
              </div>
              <p className="text-xs text-muted-foreground">
                {timing === "pre" ? "지금 창고에서 글을 뽑아 각 시간에 넣습니다(검토 모드면 미리 확인 가능)." : "시간만 잡아 두고, 발행할 때 그때그때 창고에서 뽑습니다(창고를 계속 채우는 경우에 좋음)."}
              </p>
            </div>
          )}
        </section>

        {monetize && (
          <section className="flex flex-col gap-3">
            <Label>상품 (기간 안에 돌아가며 배치)</Label>
            {!p.products?.length ? (
              <p className="text-sm text-muted-foreground">위에서 상품을 먼저 등록하세요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {p.products
                  .filter((x) => x.is_active)
                  .map((x) => (
                    <Chip key={x.id} selected={productIds.includes(x.id)} onClick={() => setProductIds((s) => (s.includes(x.id) ? s.filter((y) => y !== x.id) : [...s, x.id]))}>
                      {x.name}
                    </Chip>
                  ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <NativeSelect className="max-w-sm" value={productGeneratorId} onChange={(e) => setProductGeneratorId(e.target.value)}>
                <option value="">{productGens[0] ? `기본 상품 생성기 (${productGens[0].name})` : "기본 상품 생성기"}</option>
                {productGens.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={useVision} onChange={(e) => setUseVision(e.target.checked)} />
                상품 사진을 AI에게 보여 주고 쓰기 (사진 이해 모델)
              </label>
            </div>
          </section>
        )}

        {/* 진행 방식 */}
        <section className="flex flex-col gap-3">
          <Label>진행 방식</Label>
          <div className="flex flex-wrap gap-2">
            <Chip selected={mode === "review"} onClick={() => setMode("review")}>
              검토 모드
            </Chip>
            <Chip selected={mode === "auto"} onClick={() => setMode("auto")}>
              자동 모드
            </Chip>
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "review" ? "만든 글을 목록에서 확인·수정한 뒤 「예약 확정」을 눌러야 발행됩니다." : "만든 글을 바로 예약합니다. 검사에 걸린 글만 검토 대기로 남습니다."}
          </p>
          {needsAi && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={isAiLabel} onChange={(e) => setIsAiLabel(e.target.checked)} />
              AI로 만든 글에 &lsquo;AI 정보&rsquo; 표시
            </label>
          )}
        </section>

        {/* 요약·경고 */}
        <section className="flex flex-col gap-2 rounded-md bg-muted/60 p-3 text-sm">
          <div>
            계정 <b className="num">{selected.length}</b>개 · <b className="num">{Number(days) || 0}</b>일 · 총 약 <b className="num">{total}</b>개 글
          </div>
          {!p.aiReady && needsAi && (
            <p className="flex items-center gap-1.5 text-warning">
              <AlertTriangle className="size-4" /> AI가 준비되지 않았습니다. <Link href="/settings?tab=ai" className="underline">설정 &gt; AI</Link>
            </p>
          )}
          {tight.length > 0 && (
            <p className="flex items-center gap-1.5 text-warning">
              <AlertTriangle className="size-4" /> {tight.map((a) => `@${a.username}`).join(", ")}: 활동 시간대에 같은 계정 최소 간격({p.sameAccountGapMinutes}분)으로 다 넣을 수 없어 일부는 빠집니다.
            </p>
          )}
          {overLimit.length > 0 && (
            <p className="flex items-center gap-1.5 text-warning">
              <AlertTriangle className="size-4" /> {overLimit.map((a) => `@${a.username}`).join(", ")}: 계정 하루 최대를 넘는 만큼은 빠집니다.
            </p>
          )}
        </section>

        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button disabled={pending || !selected.length || total === 0 || (needsAi && !p.aiReady) || (monetize && !productIds.length)} onClick={submit}>
            <Sprout /> {pending ? "만드는 중…" : `${total}개 글 만들기 시작`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

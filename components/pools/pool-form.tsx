"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { AGE_LABEL, GENDER_LABEL, JOB_LABEL } from "@/lib/ai/prompt";
import { savePoolAction, type PoolInput } from "@/app/(main)/pools/actions";

export type PoolFormValue = {
  name: string;
  description: string | null;
  accountIds: string[];
  persona_filter: { age_group?: string | null; gender?: string | null; job?: string | null };
  low_stock_days: number;
  auto_refill: boolean;
  refill_generator_id: string | null;
  reuse_cooldown_days: number | null;
};

export const EMPTY_POOL: PoolFormValue = {
  name: "",
  description: null,
  accountIds: [],
  persona_filter: {},
  low_stock_days: 3,
  auto_refill: false,
  refill_generator_id: null,
  reuse_cooldown_days: null,
};

function ChipRow({ label, options, value, onChange }: { label: string; options: Record<string, string>; value: string | null | undefined; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-10 shrink-0 text-sm text-muted-foreground">{label}</span>
      {Object.entries(options)
        .filter(([k]) => k !== "any")
        .map(([k, l]) => (
          <Chip key={k} selected={value === k} onClick={() => onChange(value === k ? null : k)}>
            {l}
          </Chip>
        ))}
    </div>
  );
}

export function PoolForm({
  id,
  initial,
  accounts,
  generators,
  onDone,
}: {
  id: string | null;
  initial: PoolFormValue;
  accounts: { id: string; username: string }[];
  generators: { id: string; name: string }[];
  onDone?: (id: string) => void;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [cooldown, setCooldown] = useState(initial.reuse_cooldown_days === null ? "" : String(initial.reuse_cooldown_days));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PoolFormValue>(k: K, val: PoolFormValue[K]) => setV({ ...v, [k]: val });
  const pf = (k: "age_group" | "gender" | "job", val: string | null) => setV({ ...v, persona_filter: { ...v.persona_filter, [k]: val } });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await savePoolAction(id, { ...v, reuse_cooldown_days: cooldown.trim() ? Number(cooldown) : null } as PoolInput);
          if (!r.ok) return setError(r.error);
          setError(null);
          router.refresh();
          onDone?.(r.data.id);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-name">이름</Label>
          <Input id="p-name" maxLength={50} value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="예) 30대 직장인 일상글" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-desc">설명</Label>
          <Input id="p-desc" maxLength={500} value={v.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>연결 계정 (이 계정들이 이 창고의 글을 씁니다)</Label>
        <div className="flex flex-wrap gap-2">
          {accounts.length === 0 && <span className="text-sm text-muted-foreground">연결된 계정이 없습니다.</span>}
          {accounts.map((a) => (
            <Chip
              key={a.id}
              selected={v.accountIds.includes(a.id)}
              onClick={() => set("accountIds", v.accountIds.includes(a.id) ? v.accountIds.filter((x) => x !== a.id) : [...v.accountIds, a.id])}
            >
              @{a.username}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>페르소나 필터 (선택한 항목과 맞는 계정에만 배정, AI로 채울 때도 참고)</Label>
        <ChipRow label="연령" options={AGE_LABEL} value={v.persona_filter.age_group} onChange={(x) => pf("age_group", x)} />
        <ChipRow label="성별" options={GENDER_LABEL} value={v.persona_filter.gender} onChange={(x) => pf("gender", x)} />
        <ChipRow label="직업" options={JOB_LABEL} value={v.persona_filter.job} onChange={(x) => pf("job", x)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-low">재고 부족 기준(일)</Label>
          <Input id="p-low" type="number" min={0} max={60} className="num w-28" value={String(v.low_stock_days)} onChange={(e) => set("low_stock_days", Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-cool">재사용 금지 기간(일) · 비우면 재사용 안 함</Label>
          <Input id="p-cool" type="number" min={1} className="num w-28" placeholder="안 함" value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v.auto_refill} onChange={(e) => set("auto_refill", e.target.checked)} />
          재고가 부족하면 AI로 자동 보충 (매일 02:00, 20개, 바로 사용 가능 상태로)
        </label>
        {v.auto_refill && (
          <NativeSelect className="max-w-sm" value={v.refill_generator_id ?? ""} onChange={(e) => set("refill_generator_id", e.target.value || null)}>
            <option value="">생성기 선택</option>
            {generators.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !v.name.trim()}>
          {pending ? "저장 중…" : id ? "저장" : "창고 만들기"}
        </Button>
      </div>
    </form>
  );
}

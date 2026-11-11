"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveGeneralSettings, type GeneralInput } from "@/app/(main)/settings/actions";

export function GeneralSection({ initial }: { initial: GeneralInput }) {
  const [v, setV] = useState({ ...initial, banned: initial.bannedWords.join(", ") });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const num = (k: "globalDailyLimit" | "defaultDailyPostLimit" | "minGapMinutes" | "sameAccountGapMinutes") => ({
    value: String(v[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>일반 설정</CardTitle>
        <CardDescription>예약 간격, 하루 상한, 금칙어를 정합니다. 이번 달 AI 비용은 M5에서 표시됩니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveGeneralSettings({
                activeHours: v.activeHours,
                bannedWords: v.banned.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean),
                globalDailyLimit: Number(v.globalDailyLimit),
                defaultDailyPostLimit: Number(v.defaultDailyPostLimit),
                minGapMinutes: Number(v.minGapMinutes),
                sameAccountGapMinutes: Number(v.sameAccountGapMinutes),
              });
              setMsg(r.ok ? { ok: true, text: "저장했습니다." } : { ok: false, text: r.error });
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>활동 시간대</Label>
              <div className="flex items-center gap-2">
                <Input type="time" className="num w-32" value={v.activeHours.start} onChange={(e) => setV({ ...v, activeHours: { ...v.activeHours, start: e.target.value } })} />
                <span>~</span>
                <Input type="time" className="num w-32" value={v.activeHours.end} onChange={(e) => setV({ ...v, activeHours: { ...v.activeHours, end: e.target.value } })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-global">전역 하루 상한 (모든 계정 합계)</Label>
              <Input id="g-global" type="number" min={1} className="num w-32" {...num("globalDailyLimit")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-gap">계정 간 최소 간격(분) · 0이면 제한 없음</Label>
              <Input id="g-gap" type="number" min={0} className="num w-32" {...num("minGapMinutes")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-same">같은 계정 최소 간격(분)</Label>
              <Input id="g-same" type="number" min={0} className="num w-32" {...num("sameAccountGapMinutes")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-def">새 계정 기본 하루 최대 게시 수</Label>
              <Input id="g-def" type="number" min={0} max={250} className="num w-32" {...num("defaultDailyPostLimit")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-banned">금칙어 (쉼표 또는 줄바꿈으로 구분)</Label>
            <Textarea id="g-banned" rows={3} value={v.banned} onChange={(e) => setV({ ...v, banned: e.target.value })} />
          </div>
          <div className="flex items-center justify-end gap-3">
            {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</span>}
            <Button type="submit" disabled={pending}>
              저장
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

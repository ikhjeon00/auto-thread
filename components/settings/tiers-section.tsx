"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveFollowerTiersAction } from "@/app/(main)/settings/actions";

type Tier = { min: string; max: string; daily_posts: string };

export function TiersSection({ initial }: { initial: { min: number; max: number | null; daily_posts: number }[] }) {
  const [rows, setRows] = useState<Tier[]>(initial.map((t) => ({ min: String(t.min), max: t.max === null ? "" : String(t.max), daily_posts: String(t.daily_posts) })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const upd = (i: number, patch: Partial<Tier>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>팔로워 구간별 권장 게시 수</CardTitle>
        <CardDescription>농장에서 계정마다 하루 게시 수를 추천할 때 씁니다. 마지막 구간의 끝을 비우면 &lsquo;이상&rsquo;입니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <table className="w-full max-w-lg text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">팔로워 (부터)</th>
              <th className="py-1 font-medium">(까지)</th>
              <th className="py-1 font-medium">하루 게시 수</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <Input type="number" min={0} className="num" value={r.min} onChange={(e) => upd(i, { min: e.target.value })} />
                </td>
                <td className="py-1 pr-2">
                  <Input type="number" min={0} className="num" placeholder="이상" value={r.max} onChange={(e) => upd(i, { max: e.target.value })} />
                </td>
                <td className="py-1 pr-2">
                  <Input type="number" min={0} max={50} className="num w-24" value={r.daily_posts} onChange={(e) => upd(i, { daily_posts: e.target.value })} />
                </td>
                <td>
                  <Button variant="ghost" size="icon" aria-label="구간 삭제" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex max-w-lg items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { min: "", max: "", daily_posts: "3" }])}>
            <Plus /> 구간 추가
          </Button>
          <div className="flex items-center gap-3">
            {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</span>}
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveFollowerTiersAction(rows.map((x) => ({ min: Number(x.min), max: x.max.trim() === "" ? null : Number(x.max), daily_posts: Number(x.daily_posts) })));
                  setMsg(r.ok ? { ok: true, text: "저장했습니다." } : { ok: false, text: r.error });
                })
              }
            >
              저장
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

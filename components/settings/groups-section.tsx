"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createGroup, deleteGroup } from "@/app/(main)/settings/actions";
import type { GroupView } from "./types";

const COLORS = ["#E8590C", "#2563EB", "#16A34A", "#9333EA", "#DB2777", "#0891B2", "#CA8A04", "#57534E"];

export function GroupsSection({ groups }: { groups: GroupView[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[1]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>계정 그룹</CardTitle>
        <CardDescription>대시보드에서 그룹별로 계정을 걸러 볼 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <span key={g.id} className="inline-flex h-8 items-center gap-2 rounded-full border bg-card pr-1 pl-3 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: g.color }} />
                {g.name}
                <button
                  type="button"
                  aria-label={`${g.name} 그룹 삭제`}
                  disabled={pending}
                  className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive"
                  onClick={() => {
                    if (!confirm(`'${g.name}' 그룹을 삭제할까요? 계정은 그룹 없음으로 바뀝니다.`)) return;
                    start(async () => {
                      const r = await deleteGroup(g.id);
                      setError(r.ok ? null : r.error);
                    });
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createGroup({ name, color });
              if (r.ok) setName("");
              setError(r.ok ? null : r.error);
            });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 그룹 이름" className="w-44" maxLength={30} />
          <div className="flex items-center gap-1" role="radiogroup" aria-label="그룹 색">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className="size-6 rounded-full border-2 transition-transform aria-checked:scale-110 aria-checked:border-foreground"
                style={{ background: c, borderColor: color === c ? undefined : "transparent" }}
              />
            ))}
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={pending || !name.trim()}>
            <Plus /> 추가
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

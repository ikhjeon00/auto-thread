"use client";

import { useState, useTransition } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROVIDER_LABEL, PROVIDERS } from "@/lib/ai/types";
import { deleteGeneratorAction, saveGeneratorAction, type GeneratorInput } from "@/app/(main)/settings/ai-actions";

export type GeneratorView = Omit<GeneratorInput, "version" | "example_count"> & { id: string; version: number; example_count: number };

const KIND: Record<GeneratorInput["kind"], string> = { daily: "일상", product: "상품", vision: "사진 보고 쓰기" };
const VARS = ["{{count}}", "{{persona}}", "{{topic}}", "{{format}}", "{{length}}", "{{examples}}", "{{recent_posts}}"];

const blank: GeneratorInput = {
  name: "",
  version: 1,
  kind: "daily",
  system_prompt: "",
  user_prompt_template: "다음 조건으로 Threads 글 {{count}}개를 만들어 주세요.\n\n[페르소나]\n{{persona}}\n\n[주제]\n{{topic}}\n\n[글 형식]\n{{format}}\n\n[길이]\n{{length}}\n\n[참고할 스타일 예시]\n{{examples}}\n\n[이 계정의 최근 글 — 겹치지 않게]\n{{recent_posts}}",
  provider: null,
  model: null,
  example_count: 3,
  is_active: true,
};

export function GeneratorsSection({ items }: { items: GeneratorView[] }) {
  const [editing, setEditing] = useState<{ id: string | null; v: GeneratorInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof GeneratorInput>(k: K, val: GeneratorInput[K]) => editing && setEditing({ ...editing, v: { ...editing.v, [k]: val } });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>AI 생성기</CardTitle>
          <CardDescription>글을 쓰는 방식(프롬프트)과 쓸 모델을 묶은 설정입니다. 모델을 비우면 기본 모델을 씁니다.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing({ id: null, v: { ...blank } })}>
          <Plus /> 추가
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="divide-y rounded-md border">
          {items.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {g.name} <span className="text-xs font-normal text-muted-foreground">v{g.version}</span>
                  <Badge variant="outline">{KIND[g.kind]}</Badge>
                  {!g.is_active && <Badge>사용 안 함</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{g.model ? `${g.provider}:${g.model}` : "기본 모델"} · 예시 {g.example_count}개</div>
              </div>
              <Button variant="ghost" size="icon" aria-label="복제(새 버전)" title="복제(새 버전)" onClick={() => setEditing({ id: null, v: { ...g, version: Number(g.version) + 1 } })}>
                <Copy />
              </Button>
              <Button variant="ghost" size="icon" aria-label="수정" onClick={() => setEditing({ id: g.id, v: { ...g } })}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="삭제"
                className="hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`'${g.name}' 생성기를 삭제할까요?`)) return;
                  start(async () => {
                    const r = await deleteGeneratorAction(g.id);
                    setError(r.ok ? null : r.error);
                  });
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>

        {editing && (
          <form
            className="flex flex-col gap-3 rounded-md border bg-background p-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveGeneratorAction(editing.id, editing.v);
                if (r.ok) setEditing(null);
                setError(r.ok ? null : r.error);
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-name">이름</Label>
                <Input id="g-name" value={editing.v.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-ver">버전</Label>
                <Input id="g-ver" type="number" min={1} className="num" value={String(editing.v.version)} onChange={(e) => set("version", Number(e.target.value))} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">종류</span>
              {(Object.keys(KIND) as GeneratorInput["kind"][]).map((k) => (
                <Chip key={k} selected={editing.v.kind === k} onClick={() => set("kind", k)}>
                  {KIND[k]}
                </Chip>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr_120px]">
              <div className="flex flex-col gap-1.5">
                <Label>AI 회사</Label>
                <NativeSelect value={editing.v.provider ?? ""} onChange={(e) => set("provider", (e.target.value || null) as GeneratorInput["provider"])}>
                  <option value="">기본 모델 사용</option>
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABEL[p]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-model">모델</Label>
                <Input
                  id="g-model"
                  disabled={!editing.v.provider}
                  placeholder={editing.v.provider ? "모델 이름" : "기본 모델 사용"}
                  value={editing.v.model ?? ""}
                  onChange={(e) => set("model", e.target.value || null)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-ex">보석함 예시 수</Label>
                <Input id="g-ex" type="number" min={0} max={5} className="num" value={String(editing.v.example_count)} onChange={(e) => set("example_count", Number(e.target.value))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-sys">시스템 프롬프트 (역할·규칙)</Label>
              <Textarea id="g-sys" rows={8} className="font-mono text-xs" value={editing.v.system_prompt} onChange={(e) => set("system_prompt", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-user">사용자 프롬프트 템플릿</Label>
              <Textarea id="g-user" rows={10} className="font-mono text-xs" value={editing.v.user_prompt_template} onChange={(e) => set("user_prompt_template", e.target.value)} />
              <p className="text-xs text-muted-foreground">쓸 수 있는 자리 표시: {VARS.join(" ")}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={editing.v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              사용
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                취소
              </Button>
              <Button type="submit" disabled={pending}>
                저장
              </Button>
            </div>
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

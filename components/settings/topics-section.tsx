"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatKst } from "@/lib/time";
import { bulkAddTopicsAction, deleteFormatAction, deleteTopicAction, saveFormatAction, saveTopicAction } from "@/app/(main)/settings/ai-actions";

export type TopicView = { id: string; category: string; topic: string; keywords: string[]; last_used_at: string | null };
export type FormatView = { id: string; name: string; instruction: string; is_active: boolean };

export function TopicsSection({ topics }: { topics: TopicView[] }) {
  const categories = useMemo(() => [...new Set(topics.map((t) => t.category))].sort(), [topics]);
  const [cat, setCat] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: string | null; category: string; topic: string; keywords: string } | null>(null);
  const [bulk, setBulk] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const shown = topics.filter((t) => !cat || t.category === cat);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "오류" });
      if (r.ok) after?.();
    });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>주제 풀</CardTitle>
          <CardDescription>AI가 주제를 정하지 않았을 때 최근에 쓰지 않은 주제 중에서 랜덤으로 고릅니다. 지금 {topics.length}개.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulk(bulk === null ? "" : null)}>
            여러 개 붙여넣기
          </Button>
          <Button variant="outline" size="sm" onClick={() => setForm({ id: null, category: cat ?? "", topic: "", keywords: "" })}>
            <Plus /> 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {bulk !== null && (
          <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">한 줄에 하나씩 「카테고리 | 주제 | 키워드1, 키워드2」 (키워드는 생략 가능)</p>
            <Textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"일상 | 비 오는 날 하는 일 | 비, 카페\n직장 | 월요병 이기는 법"} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setBulk(null)}>
                닫기
              </Button>
              <Button
                size="sm"
                disabled={pending || !bulk.trim()}
                onClick={() =>
                  start(async () => {
                    const r = await bulkAddTopicsAction(bulk);
                    setMsg(r.ok ? { ok: true, text: `${r.data.added}개 추가했습니다${r.data.skipped ? `(중복·형식 오류 ${r.data.skipped}개 제외)` : ""}.` } : { ok: false, text: r.error });
                    if (r.ok) setBulk(null);
                  })
                }
              >
                추가
              </Button>
            </div>
          </div>
        )}
        {form && (
          <form
            className="flex flex-wrap items-end gap-2 rounded-md border bg-background p-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  saveTopicAction(form.id, {
                    category: form.category,
                    topic: form.topic,
                    keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
                  }),
                "저장했습니다.",
                () => setForm(null),
              );
            }}
          >
            <Input className="w-32" placeholder="카테고리" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Input className="min-w-48 flex-1" placeholder="주제" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            <Input className="w-56" placeholder="키워드 (쉼표로 구분)" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
              취소
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              저장
            </Button>
          </form>
        )}
        <div className="flex flex-wrap gap-2">
          <Chip selected={cat === null} onClick={() => setCat(null)}>
            전체
          </Chip>
          {categories.map((c) => (
            <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>
              {c} <span className="num text-xs text-muted-foreground">{topics.filter((t) => t.category === c).length}</span>
            </Chip>
          ))}
        </div>
        <ul className="max-h-96 divide-y overflow-y-auto rounded-md border">
          {shown.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Badge variant="outline">{t.category}</Badge>
              <span className="min-w-0 flex-1 truncate">{t.topic}</span>
              {t.keywords.length > 0 && <span className="hidden truncate text-xs text-muted-foreground md:inline">{t.keywords.join(", ")}</span>}
              <span className="num w-20 shrink-0 text-right text-xs text-muted-foreground">{t.last_used_at ? formatKst(t.last_used_at, "M/d 사용") : "미사용"}</span>
              <Button variant="ghost" size="icon" aria-label="수정" onClick={() => setForm({ id: t.id, category: t.category, topic: t.topic, keywords: t.keywords.join(", ") })}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="삭제" className="hover:text-destructive" disabled={pending} onClick={() => run(() => deleteTopicAction(t.id), "삭제했습니다.")}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
          {!shown.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">주제가 없습니다.</li>}
        </ul>
        {msg && <p className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}

export function FormatsSection({ formats }: { formats: FormatView[] }) {
  const [form, setForm] = useState<(Omit<FormatView, "id"> & { id: string | null }) | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>글 형식</CardTitle>
          <CardDescription>AI가 글마다 사용 중인 형식 하나를 랜덤으로 골라 따릅니다.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setForm({ id: null, name: "", instruction: "", is_active: true })}>
          <Plus /> 추가
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {form && (
          <form
            className="flex flex-col gap-2 rounded-md border bg-background p-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveFormatAction(form.id, form);
                setMsg(r.ok ? { ok: true, text: "저장했습니다." } : { ok: false, text: r.error });
                if (r.ok) setForm(null);
              });
            }}
          >
            <Input placeholder="이름 (예: 질문형)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Textarea rows={2} placeholder="AI에게 줄 설명" value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              사용
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
                취소
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                저장
              </Button>
            </div>
          </form>
        )}
        <ul className="divide-y rounded-md border">
          {formats.map((f) => (
            <li key={f.id} className="flex items-start gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium">
                  {f.name} {!f.is_active && <Badge>사용 안 함</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{f.instruction}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="수정" onClick={() => setForm({ ...f })}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="삭제"
                className="hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`'${f.name}' 형식을 삭제할까요?`)) return;
                  start(async () => {
                    const r = await deleteFormatAction(f.id);
                    setMsg(r.ok ? { ok: true, text: "삭제했습니다." } : { ok: false, text: r.error });
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        {msg && <p className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}

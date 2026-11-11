"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteDisclosure, saveDisclosure, type DisclosureInput } from "@/app/(main)/settings/actions";

export type DisclosureView = {
  id: string;
  name: string;
  text: string;
  match_domains: string[];
  is_default: boolean;
  default_position: "body" | "link_reply" | "separate_reply";
};

const POS: Record<DisclosureView["default_position"], string> = { body: "본문 끝", link_reply: "링크 댓글", separate_reply: "별도 댓글" };
const empty: DisclosureInput = { name: "", text: "", match_domains: [], is_default: false, default_position: "link_reply" };

export function DisclosuresSection({ items }: { items: DisclosureView[] }) {
  const [editing, setEditing] = useState<{ id: string | null; v: DisclosureInput; domains: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const open = (d: DisclosureView | null) => {
    setError(null);
    setEditing(
      d
        ? { id: d.id, v: { ...d }, domains: d.match_domains.join(", ") }
        : { id: null, v: { ...empty }, domains: "" },
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>제휴 고지 문구</CardTitle>
          <CardDescription>링크 도메인이 &lsquo;자동 매칭 도메인&rsquo;과 맞으면 글 작성에서 자동으로 선택됩니다.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => open(null)}>
          <Plus /> 추가
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="divide-y rounded-md border">
          {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">등록된 문구가 없습니다.</li>}
          {items.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {d.name}
                  {d.is_default && <Badge variant="warning">기본값</Badge>}
                  <span className="text-xs font-normal text-muted-foreground">{POS[d.default_position]}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.text}</p>
                {d.match_domains.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">도메인: {d.match_domains.join(", ")}</p>}
              </div>
              <Button variant="ghost" size="icon" aria-label="수정" onClick={() => open(d)}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="삭제"
                className="hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`'${d.name}' 문구를 삭제할까요?`)) return;
                  start(async () => {
                    const r = await deleteDisclosure(d.id);
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
              const domains = editing.domains.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
              start(async () => {
                const r = await saveDisclosure(editing.id, { ...editing.v, match_domains: domains });
                if (r.ok) setEditing(null);
                setError(r.ok ? null : r.error);
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-name">이름</Label>
                <Input id="d-name" value={editing.v.name} onChange={(e) => setEditing({ ...editing, v: { ...editing.v, name: e.target.value } })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-domains">자동 매칭 도메인 (쉼표로 구분)</Label>
                <Input
                  id="d-domains"
                  placeholder="link.coupang.com, coupa.ng"
                  value={editing.domains}
                  onChange={(e) => setEditing({ ...editing, domains: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-text">문구</Label>
              <Textarea id="d-text" rows={2} value={editing.v.text} onChange={(e) => setEditing({ ...editing, v: { ...editing.v, text: e.target.value } })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">기본 위치</span>
              {(Object.keys(POS) as DisclosureView["default_position"][]).map((p) => (
                <Chip key={p} selected={editing.v.default_position === p} onClick={() => setEditing({ ...editing, v: { ...editing.v, default_position: p } })}>
                  {POS[p]}
                </Chip>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={editing.v.is_default}
                onChange={(e) => setEditing({ ...editing, v: { ...editing.v, is_default: e.target.checked } })}
              />
              기본값으로 사용
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

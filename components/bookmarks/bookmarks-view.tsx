"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ExternalLink, Eye, Gem, Heart, MessageCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatKst } from "@/lib/time";
import { cn } from "@/lib/utils";
import { addReferenceAction, deleteBookmarksAction, updateBookmarkAction } from "@/app/(main)/bookmarks/actions";
import { importBookmarksAction } from "@/app/(main)/pools/actions";

export type BookmarkView = {
  id: string;
  kind: "mine" | "reference";
  text: string;
  source_url: string | null;
  metrics: { views?: number; likes?: number; replies?: number } | null;
  tags: string[];
  created_at: string;
  username: string | null;
};

const splitTags = (s: string) => [...new Set(s.split(/[,#\s]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
const n = (v: number | undefined) => (v ?? 0).toLocaleString("ko-KR");

export function BookmarksView({
  tab,
  counts,
  items,
  pools,
  tags,
  filter,
}: {
  tab: "mine" | "reference";
  counts: { mine: number; reference: number };
  items: BookmarkView[];
  pools: { id: string; name: string }[];
  tags: string[];
  filter: { q: string | null; tag: string | null };
}) {
  const router = useRouter();
  const [q, setQ] = useState(filter.q ?? "");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [poolId, setPoolId] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const go = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    const next = { tab, q: filter.q, tag: filter.tag, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    setSel(new Set());
    router.push(`/bookmarks?${sp}`);
  };
  const ids = [...sel];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b">
        {(
          [
            ["mine", "나의 보석함"],
            ["reference", "참고 글"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => go({ tab: t === "mine" ? null : t, q: null, tag: null })}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm", tab === t ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {label} <span className="num">{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() || null });
          }}
        >
          <Input className="w-56" placeholder="내용 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="outline" size="icon" aria-label="검색">
            <Search />
          </Button>
        </form>
        {tab === "reference" && (
          <Button className="ml-auto" onClick={() => setAdding((v) => !v)}>
            <Plus /> 참고 글 추가
          </Button>
        )}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip selected={!filter.tag} onClick={() => go({ tag: null })} className="h-7 text-xs">
            모든 태그
          </Chip>
          {tags.map((t) => (
            <Chip key={t} selected={filter.tag === t} onClick={() => go({ tag: t })} className="h-7 text-xs">
              #{t}
            </Chip>
          ))}
        </div>
      )}

      {adding && <ReferenceForm onDone={() => { setAdding(false); router.refresh(); }} />}

      {/* 선택한 글 처리 */}
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
        <span>{sel.size ? `${sel.size}개 선택` : "글을 선택하면 창고로 옮기거나 삭제할 수 있습니다"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <NativeSelect className="w-44" value={poolId} onChange={(e) => setPoolId(e.target.value)} disabled={!pools.length}>
            <option value="">{pools.length ? "옮길 창고 선택" : "창고 없음"}</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={!sel.size || !poolId || pending}
            onClick={() =>
              start(async () => {
                const r = await importBookmarksAction(poolId, ids);
                setMsg(r.ok ? { ok: true, text: `${r.data.added}개를 창고에 넣었습니다(사용 가능).` } : { ok: false, text: r.error });
                if (r.ok) setSel(new Set());
              })
            }
          >
            <Archive /> 창고로 옮기기
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="hover:text-destructive"
            disabled={!sel.size || pending}
            onClick={() => {
              if (!confirm(`${sel.size}개를 보석함에서 삭제할까요?`)) return;
              start(async () => {
                const r = await deleteBookmarksAction(ids);
                setMsg(r.ok ? { ok: true, text: `${r.data.deleted}개를 삭제했습니다.` } : { ok: false, text: r.error });
                if (r.ok) {
                  setSel(new Set());
                  router.refresh();
                }
              });
            }}
          >
            <Trash2 /> 삭제
          </Button>
        </div>
      </div>
      {msg && <p className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Gem className="size-8" />
            {tab === "mine" ? (
              <>
                아직 저장한 글이 없습니다.{" "}
                <Link href="/published" className="text-primary underline">
                  내가 올린 글
                </Link>
                에서 ★를 눌러 저장하세요.
              </>
            ) : (
              "참고하고 싶은 문장을 직접 붙여 넣어 모아 두세요(자동 수집은 하지 않습니다)."
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((b) => (
            <li key={b.id}>
              <Card className={cn("h-full gap-2 py-4", sel.has(b.id) && "border-primary/60 bg-primary-soft/30")}>
                <CardContent className="flex h-full gap-3">
                  <input
                    type="checkbox"
                    aria-label="선택"
                    className="mt-1 size-4 accent-[var(--primary)]"
                    checked={sel.has(b.id)}
                    onChange={() => {
                      const s = new Set(sel);
                      if (s.has(b.id)) s.delete(b.id);
                      else s.add(b.id);
                      setSel(s);
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {editId === b.id ? (
                      <EditForm b={b} onDone={() => { setEditId(null); router.refresh(); }} />
                    ) : (
                      <>
                        <p className="line-clamp-6 text-sm whitespace-pre-wrap">{b.text}</p>
                        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {b.username && <span className="font-medium text-foreground">@{b.username}</span>}
                          {b.kind === "mine" && b.metrics && (
                            <span className="num inline-flex items-center gap-2">
                              <span className="inline-flex items-center gap-0.5">
                                <Eye className="size-3.5" /> {n(b.metrics.views)}
                              </span>
                              <span className="inline-flex items-center gap-0.5">
                                <Heart className="size-3.5" /> {n(b.metrics.likes)}
                              </span>
                              <span className="inline-flex items-center gap-0.5">
                                <MessageCircle className="size-3.5" /> {n(b.metrics.replies)}
                              </span>
                            </span>
                          )}
                          {b.tags.map((t) => (
                            <Badge key={t} variant="outline">
                              #{t}
                            </Badge>
                          ))}
                          <span className="num">{formatKst(b.created_at, "yyyy-MM-dd")}</span>
                          {b.source_url && (
                            <a href={b.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                              {b.kind === "mine" ? "Threads" : "출처"} <ExternalLink className="size-3" />
                            </a>
                          )}
                          <button type="button" onClick={() => setEditId(b.id)} className="ml-auto inline-flex items-center gap-0.5 hover:text-foreground">
                            <Pencil className="size-3.5" /> 수정
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReferenceForm({ onDone }: { onDone: () => void }) {
  const [v, setV] = useState({ text: "", source_url: "", tags: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-sm">참고 글 추가</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea rows={4} placeholder="참고하고 싶은 문장을 붙여 넣으세요" value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="출처 주소 (선택)" value={v.source_url} onChange={(e) => setV({ ...v, source_url: e.target.value })} />
          <Input placeholder="태그 (쉼표로 구분, 선택)" value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button
            disabled={pending || !v.text.trim()}
            onClick={() =>
              start(async () => {
                const r = await addReferenceAction({ text: v.text, source_url: v.source_url || null, tags: splitTags(v.tags) });
                if (r.ok) onDone();
                else setError(r.error);
              })
            }
          >
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditForm({ b, onDone }: { b: BookmarkView; onDone: () => void }) {
  const [text, setText] = useState(b.text);
  const [tags, setTags] = useState(b.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <Input placeholder="태그 (쉼표로 구분)" value={tags} onChange={(e) => setTags(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          취소
        </Button>
        <Button
          size="sm"
          disabled={pending || !text.trim()}
          onClick={() =>
            start(async () => {
              const r = await updateBookmarkAction(b.id, { text, tags: splitTags(tags) });
              if (r.ok) onDone();
              else setError(r.error);
            })
          }
        >
          저장
        </Button>
      </div>
    </div>
  );
}

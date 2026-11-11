"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageIcon, PenSquare, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/components/compose/media-picker";
import type { MediaItem } from "@/lib/compose/schema";
import { deleteBundleAction, saveBundleAction, setBundleAssetsAction, type BundleView } from "@/app/(main)/farm/actions";

export function Bundles({ bundles, categories, filter }: { bundles: BundleView[]; categories: string[]; filter: { q: string | null; category: string | null } }) {
  const router = useRouter();
  const [q, setQ] = useState(filter.q ?? "");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const go = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    const next = { q: filter.q, category: filter.category, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    router.push(`/assets?${sp}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() || null });
          }}
        >
          <Input className="w-56" placeholder="묶음 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="outline" size="icon" aria-label="검색">
            <Search />
          </Button>
        </form>
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <Plus /> 새 묶음
        </Button>
      </div>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip selected={!filter.category} onClick={() => go({ category: null })}>
            전체
          </Chip>
          {categories.map((c) => (
            <Chip key={c} selected={filter.category === c} onClick={() => go({ category: c })}>
              {c}
            </Chip>
          ))}
        </div>
      )}
      {creating && <BundleForm onDone={(id) => { setCreating(false); setOpenId(id); router.refresh(); }} onCancel={() => setCreating(false)} />}

      {bundles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <ImageIcon className="size-8" />
            묶음이 없습니다. &lsquo;새 묶음&rsquo;으로 상품 사진·영상을 모아 두세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bundles.map((b) =>
            openId === b.id ? (
              <BundleEditor key={b.id} bundle={b} onClose={() => setOpenId(null)} />
            ) : (
              <Card key={b.id} className="cursor-pointer gap-3 transition-shadow hover:shadow-md" onClick={() => setOpenId(b.id)}>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid aspect-[2/1] grid-cols-4 gap-1 overflow-hidden rounded-md bg-muted">
                    {b.media.slice(0, 4).map((m) =>
                      m.mediaType === "video" ? (
                        <video key={m.storagePath} src={m.publicUrl} className="size-full object-cover" muted preload="metadata" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={m.storagePath} src={m.publicUrl} alt="" className="size-full object-cover" />
                      ),
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{b.name}</span>
                    {b.category && <Badge variant="outline">{b.category}</Badge>}
                    <span className="num ml-auto text-xs text-muted-foreground">{b.media.length}개</span>
                  </div>
                  {b.memo && <p className="line-clamp-2 text-xs text-muted-foreground">{b.memo}</p>}
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function BundleForm({ initial, id, onDone, onCancel }: { initial?: { name: string; category: string | null; memo: string | null }; id?: string; onDone: (id: string) => void; onCancel: () => void }) {
  const [v, setV] = useState({ name: initial?.name ?? "", category: initial?.category ?? "", memo: initial?.memo ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-md border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveBundleAction(id ?? null, { name: v.name, category: v.category || null, memo: v.memo || null });
          if (r.ok) onDone(r.data.id);
          else setError(r.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="b-name">묶음 이름</Label>
          <Input id="b-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="예) 무선 청소기 상세컷" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="b-cat">카테고리</Label>
          <Input id="b-cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="예) 가전, 뷰티" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="b-memo">메모 (상품 특징 — 글로 만들 때 AI가 참고)</Label>
        <Textarea id="b-memo" rows={2} value={v.memo} onChange={(e) => setV({ ...v, memo: e.target.value })} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={pending || !v.name.trim()}>
          저장
        </Button>
      </div>
    </form>
  );
}

function BundleEditor({ bundle, onClose }: { bundle: BundleView; onClose: () => void }) {
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>(bundle.media);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const saveMedia = (next: MediaItem[]) => {
    setMedia(next);
    start(async () => {
      const r = await setBundleAssetsAction(bundle.id, next);
      setMsg(r.ok ? { ok: true, text: "저장됨" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <Card className="gap-3 md:col-span-2 xl:col-span-3">
      <CardHeader className="flex-row flex-wrap items-center gap-2">
        <CardTitle>{bundle.name}</CardTitle>
        {bundle.category && <Badge variant="outline">{bundle.category}</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          {msg && <span className={msg.ok ? "text-xs text-success" : "text-xs text-destructive"}>{pending ? "저장 중…" : msg.text}</span>}
          <Button size="sm" asChild disabled={!media.length}>
            <Link href={`/compose?bundle=${bundle.id}`}>
              <PenSquare /> 글로 만들기
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            정보 수정
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="묶음 삭제"
            className="hover:text-destructive"
            onClick={() => {
              if (!confirm(`「${bundle.name}」 묶음을 삭제할까요? 글에 쓰이지 않은 파일도 함께 지웁니다.`)) return;
              start(async () => {
                const r = await deleteBundleAction(bundle.id);
                if (r.ok) {
                  onClose();
                  router.refresh();
                } else setMsg({ ok: false, text: r.error });
              });
            }}
          >
            <Trash2 />
          </Button>
          <Button size="icon" variant="ghost" aria-label="닫기" onClick={onClose}>
            <X />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing && <BundleForm id={bundle.id} initial={bundle} onDone={() => { setEditing(false); router.refresh(); }} onCancel={() => setEditing(false)} />}
        {bundle.memo && !editing && <p className="text-sm text-muted-foreground">{bundle.memo}</p>}
        <MediaPicker folder="assets" max={200} value={media} onChange={saveMedia} />
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaItem } from "@/lib/compose/schema";
import { cn } from "@/lib/utils";
import { listBundlesAction, type BundleView } from "@/app/(main)/farm/actions";

/** 자료실에서 사진·영상 고르기 창 */
export function AssetPicker({ max, onClose, onPick }: { max: number; onClose: () => void; onPick: (items: MediaItem[]) => void }) {
  const [q, setQ] = useState("");
  const [bundles, setBundles] = useState<BundleView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<MediaItem[]>([]);

  const load = async (query?: string) => {
    setBundles(null);
    const r = await listBundlesAction(query);
    if (r.ok) setBundles(r.data);
    else setError(r.error);
  };
  useEffect(() => {
    void load();
  }, []);

  const toggle = (m: MediaItem) =>
    setSel((s) => (s.some((x) => x.storagePath === m.storagePath) ? s.filter((x) => x.storagePath !== m.storagePath) : s.length >= max ? s : [...s, m]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="자료실에서 고르기">
      <div className="flex max-h-[85dvh] w-full max-w-3xl flex-col rounded-lg border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="font-semibold">자료실에서 고르기</span>
          <span className="num text-sm text-muted-foreground">
            {sel.length} / {max}
          </span>
          <form
            className="ml-auto flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void load(q);
            }}
          >
            <Input className="h-8 w-44" placeholder="묶음 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" size="icon" variant="outline" className="size-8" aria-label="검색">
              <Search />
            </Button>
          </form>
          <Button size="icon" variant="ghost" aria-label="닫기" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!bundles && !error && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 불러오는 중…
            </p>
          )}
          {bundles?.length === 0 && <p className="text-sm text-muted-foreground">자료실이 비어 있습니다. 왼쪽 메뉴 &lsquo;자료실&rsquo;에서 묶음을 만들어 올리세요.</p>}
          <div className="flex flex-col gap-5">
            {bundles?.map((b) => (
              <section key={b.id}>
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="font-medium">{b.name}</span>
                  {b.category && <span className="text-xs text-muted-foreground">{b.category}</span>}
                  {b.media.length > 0 && (
                    <button
                      type="button"
                      className="ml-auto text-xs text-primary underline"
                      onClick={() => setSel((s) => [...s, ...b.media.filter((m) => !s.some((x) => x.storagePath === m.storagePath))].slice(0, max))}
                    >
                      이 묶음 전부
                    </button>
                  )}
                </div>
                {b.media.length === 0 ? (
                  <p className="text-xs text-muted-foreground">비어 있음</p>
                ) : (
                  <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {b.media.map((m) => {
                      const on = sel.some((x) => x.storagePath === m.storagePath);
                      return (
                        <li key={m.storagePath}>
                          <button
                            type="button"
                            onClick={() => toggle(m)}
                            className={cn("relative block aspect-square w-full overflow-hidden rounded-md border", on && "ring-2 ring-primary")}
                          >
                            {m.mediaType === "video" ? (
                              <div className="relative size-full bg-black">
                                <video src={m.publicUrl} className="size-full object-cover" muted preload="metadata" />
                                <Video className="absolute bottom-1 left-1 size-4 text-white" />
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.publicUrl} alt="" className="size-full object-cover" />
                            )}
                            {on && (
                              <span className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-white">
                                <Check className="size-3.5" />
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={!sel.length}
            onClick={() => {
              onPick(sel);
              onClose();
            }}
          >
            {sel.length}개 추가
          </Button>
        </div>
      </div>
    </div>
  );
}

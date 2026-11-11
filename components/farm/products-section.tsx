"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/components/compose/media-picker";
import { hostOf, matchDisclosure, type DisclosureLite } from "@/lib/compose/plan";
import type { MediaItem } from "@/lib/compose/schema";
import { deleteProductAction, saveProductAction } from "@/app/(main)/farm/actions";

export type ProductView = { id: string; name: string; affiliate_url: string; disclosure_id: string | null; media: MediaItem[]; memo: string | null; is_active: boolean };

const blank = { name: "", affiliate_url: "", disclosure_id: null as string | null, media: [] as MediaItem[], memo: "", is_active: true };

export function ProductsSection({ products, disclosures }: { products: ProductView[]; disclosures: (DisclosureLite & { is_default: boolean })[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; v: typeof blank } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof typeof blank>(k: K, val: (typeof blank)[K]) => editing && setEditing({ ...editing, v: { ...editing.v, [k]: val } });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>상품</CardTitle>
          <CardDescription>상품 사진(직접 올리기 또는 자료실), 상품명, 제휴 링크, 고지 문구. AI는 사진과 상품명·특징을 보고 글을 씁니다.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing({ id: null, v: { ...blank } })}>
          <Plus /> 상품 등록
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing && (
          <form
            className="flex flex-col gap-3 rounded-md border bg-background p-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveProductAction(editing.id, { ...editing.v, memo: editing.v.memo || null });
                if (!r.ok) return setError(r.error);
                setError(null);
                setEditing(null);
                router.refresh();
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-name">상품명</Label>
                <Input id="pr-name" value={editing.v.name} onChange={(e) => set("name", e.target.value)} placeholder="예) 초경량 무선 청소기" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-url">제휴 링크</Label>
                <Input
                  id="pr-url"
                  type="url"
                  placeholder="https://link.coupang.com/…"
                  value={editing.v.affiliate_url}
                  onChange={(e) => {
                    const url = e.target.value;
                    const m = matchDisclosure(url, disclosures);
                    setEditing({ ...editing, v: { ...editing.v, affiliate_url: url, disclosure_id: editing.v.disclosure_id ?? m?.id ?? null } });
                  }}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>고지 문구</Label>
                <NativeSelect value={editing.v.disclosure_id ?? ""} onChange={(e) => set("disclosure_id", e.target.value || null)}>
                  <option value="">기본 고지 문구</option>
                  {disclosures.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={editing.v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
                농장에서 사용
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pr-memo">특징 (AI 참고용)</Label>
              <Textarea id="pr-memo" rows={2} value={editing.v.memo} onChange={(e) => set("memo", e.target.value)} placeholder="예) 1.2kg, 40분 사용, 충전 2시간, 소음 적음" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>상품 사진·영상</Label>
              <MediaPicker folder="products" value={editing.v.media} onChange={(v) => set("media", v)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                취소
              </Button>
              <Button type="submit" disabled={pending || !editing.v.name.trim() || !editing.v.affiliate_url.trim()}>
                저장
              </Button>
            </div>
          </form>
        )}
        {products.length === 0 && !editing ? (
          <p className="py-6 text-center text-sm text-muted-foreground">등록된 상품이 없습니다.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.map((x) => (
              <li key={x.id} className="flex gap-3 rounded-md border bg-card p-3">
                {x.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.media[0].publicUrl} alt="" className="size-16 shrink-0 rounded-md border object-cover" />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Package className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{x.name}</span>
                    {!x.is_active && <Badge>사용 안 함</Badge>}
                  </div>
                  <a href={x.affiliate_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline">
                    {hostOf(x.affiliate_url)} <ExternalLink className="size-3" />
                  </a>
                  <div className="text-xs text-muted-foreground">사진 {x.media.length}개</div>
                </div>
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="수정"
                    onClick={() => setEditing({ id: x.id, v: { name: x.name, affiliate_url: x.affiliate_url, disclosure_id: x.disclosure_id, media: x.media, memo: x.memo ?? "", is_active: x.is_active } })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="삭제"
                    className="hover:text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`「${x.name}」 상품을 삭제할까요? (이미 예약된 글은 그대로 발행됩니다)`)) return;
                      start(async () => {
                        const r = await deleteProductAction(x.id);
                        if (r.ok) router.refresh();
                        else setError(r.error);
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

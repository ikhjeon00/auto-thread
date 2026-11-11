"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deletePoolAction } from "@/app/(main)/pools/actions";

/** 창고 카드의 ⋯ 메뉴: 설정 열기, 삭제 */
export function PoolCardMenu({ poolId, name }: { poolId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" aria-label={`${name} 메뉴`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-40 rounded-md border bg-popover p-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => router.push(`/pools/${poolId}`)}
          >
            <Settings2 className="size-4" /> 열기
          </button>
          <button
            type="button"
            disabled={pending}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-red-50"
            onClick={() => {
              if (!confirm(`「${name}」 창고와 안의 글을 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
              start(async () => {
                const r = await deletePoolAction(poolId);
                setOpen(false);
                if (r.ok) router.refresh();
                else alert(r.error);
              });
            }}
          >
            <Trash2 className="size-4" /> {pending ? "삭제 중…" : "삭제"}
          </button>
        </div>
      )}
    </div>
  );
}

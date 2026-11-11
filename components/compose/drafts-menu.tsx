"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKst } from "@/lib/time";
import { cn } from "@/lib/utils";
import { deleteDraftAction } from "@/app/(main)/compose/actions";

export type DraftItem = { id: string; text: string; updated_at: string; username: string | null };

export function DraftsMenu({ drafts, currentId }: { drafts: DraftItem[]; currentId: string | null }) {
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
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <FileText /> 임시 저장 글 <span className="num font-semibold text-primary">{drafts.length}</span>
        <ChevronDown className="size-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border bg-popover p-1 shadow-lg">
          {drafts.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">임시 저장한 글이 없습니다.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {drafts.map((d) => (
                <li key={d.id} className={cn("group flex items-start gap-2 rounded-md px-3 py-2 hover:bg-accent", d.id === currentId && "bg-primary-soft")}>
                  {/* 전체 새로 불러오기(상태 초기화)를 위해 <a> 사용 */}
                  <a href={`/compose?id=${d.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm">{d.text.trim() || "(내용 없음)"}</div>
                    <div className="num text-xs text-muted-foreground">
                      {d.username ? `@${d.username} · ` : ""}
                      {formatKst(d.updated_at, "M/d HH:mm")}
                    </div>
                  </a>
                  <button
                    type="button"
                    aria-label="삭제"
                    disabled={pending}
                    className="mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus:opacity-100"
                    onClick={() => {
                      if (!confirm("이 임시 저장 글을 삭제할까요?")) return;
                      start(async () => {
                        await deleteDraftAction(d.id);
                        if (d.id === currentId) window.location.href = "/compose";
                        else router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

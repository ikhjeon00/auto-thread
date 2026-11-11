"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { findNavItem } from "./nav";

/** 1024px(lg) 이상: 왼쪽 고정 사이드바 / 미만: 상단 바 + 서랍형 사이드바 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = findNavItem(pathname);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-sidebar px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="-ml-2 inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
        >
          <Menu className="size-5" />
        </button>
        <span className="font-semibold">{current?.label ?? "AUTO THREAD"}</span>
      </header>

      <div
        className={cn("fixed inset-0 z-40 bg-black/30 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar transition-transform lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="메뉴 닫기"
          className="absolute top-3.5 right-3 inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
        >
          <X className="size-5" />
        </button>
        <Sidebar onNavigate={() => setOpen(false)} />
      </aside>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

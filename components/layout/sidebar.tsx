"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/(auth)/login/actions";
import { NAV, isActive } from "./nav";

export function Sidebar({ onNavigate, badges = {} }: { onNavigate?: () => void; badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex h-16 items-center px-5 text-lg font-extrabold tracking-tight">
        AUTO <span className="ml-1 text-primary">THREAD</span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((section, i) => (
          <div key={i} className={cn("pt-4", i > 0 && !section.title && "mt-2 border-t")}>
            {section.title && (
              <div className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">{section.title}</div>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                        active
                          ? "bg-primary-soft font-semibold text-primary"
                          : "text-foreground/80 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                      {(badges[item.href] ?? 0) > 0 && (
                        <span className="num ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
                          {badges[item.href] > 99 ? "99+" : badges[item.href]}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <form action={logout} className="border-t p-3">
        <button
          type="submit"
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" />
          로그아웃
        </button>
      </form>
    </div>
  );
}

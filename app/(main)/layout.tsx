import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

/** 사이드바 배지: 읽지 않은 알림, 실패한 글 */
async function loadBadges(): Promise<Record<string, number>> {
  try {
    const [unread, failed] = await Promise.all([
      db().from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
      db().from("posts").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);
    return { "/activity": unread.count ?? 0, "/scheduled": failed.count ?? 0 };
  } catch {
    return {};
  }
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell badges={await loadBadges()}>{children}</AppShell>;
}

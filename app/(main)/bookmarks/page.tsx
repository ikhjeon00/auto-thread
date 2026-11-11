import { PageHeader } from "@/components/layout/page-header";
import { BookmarksView, type BookmarkView } from "@/components/bookmarks/bookmarks-view";
import { db } from "@/lib/db/admin";

export const metadata = { title: "보석함 · AUTO THREAD" };
export const dynamic = "force-dynamic";

export default async function BookmarksPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; tag?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "reference" ? "reference" : "mine";
  const q = sp.q?.trim().slice(0, 100) || null;
  const tag = sp.tag?.trim() || null;
  let query = db()
    .from("bookmarks")
    .select("id, kind, text, source_url, metrics, tags, created_at, threads_accounts(username)")
    .eq("kind", tab)
    .order("created_at", { ascending: false })
    .limit(500);
  if (q) query = query.ilike("text", `%${q.replace(/[%_]/g, "")}%`);
  if (tag) query = query.contains("tags", [tag]);
  const [res, poolRes, tagRes, countRes] = await Promise.all([
    query,
    db().from("content_pools").select("id, name").order("name"),
    db().from("bookmarks").select("tags").eq("kind", tab).limit(2000),
    db().from("bookmarks").select("kind").limit(5000),
  ]);
  const allTags = [...new Set(((tagRes.data ?? []) as { tags: string[] }[]).flatMap((b) => b.tags ?? []))].sort();
  const counts = { mine: 0, reference: 0 };
  for (const b of (countRes.data ?? []) as { kind: "mine" | "reference" }[]) counts[b.kind]++;

  return (
    <>
      <PageHeader title="보석함" description="반응 좋았던 내 글과 참고 문장을 모아 둡니다. AI가 글을 쓸 때 스타일 예시로 참고하고, 창고로 옮겨 다시 쓸 수 있습니다." />
      {res.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">불러오기 실패: {res.error.message}</p>}
      <BookmarksView
        tab={tab}
        counts={counts}
        items={((res.data ?? []) as unknown as (Omit<BookmarkView, "username"> & { threads_accounts: { username: string } | null })[]).map(({ threads_accounts, ...b }) => ({
          ...b,
          username: threads_accounts?.username ?? null,
        }))}
        pools={(poolRes.data ?? []) as { id: string; name: string }[]}
        tags={allTags}
        filter={{ q, tag }}
      />
    </>
  );
}

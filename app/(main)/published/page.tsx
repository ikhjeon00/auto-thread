import { PageHeader } from "@/components/layout/page-header";
import { PublishedList, type PublishedItem } from "@/components/published/published-list";
import { db } from "@/lib/db/admin";

export const metadata = { title: "내가 올린 글 · AUTO THREAD" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function PublishedPage({ searchParams }: { searchParams: Promise<{ account?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const accountId = sp.account && /^[0-9a-f-]{36}$/.test(sp.account) ? sp.account : null;

  let q = db()
    .from("posts")
    .select(
      "id, account_id, kind, text, permalink, published_at, threads_accounts(username, profile_picture_url), post_insights(views, likes, replies, reposts, updated_at), bookmarks(id), post_media(public_url, media_type, sort_order), post_replies(status)",
      { count: "exact" },
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (accountId) q = q.eq("account_id", accountId);

  const [res, accRes] = await Promise.all([q, db().from("threads_accounts").select("id, username").order("username")]);

  const items: PublishedItem[] = (res.data ?? []).map((p) => {
    const acc = p.threads_accounts as unknown as { username: string; profile_picture_url: string | null } | null;
    const insRaw = p.post_insights as unknown;
    const ins = (Array.isArray(insRaw) ? insRaw[0] : insRaw) as { views: number; likes: number; replies: number; reposts: number; updated_at: string } | null;
    const media = ((p.post_media ?? []) as { public_url: string; media_type: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: p.id as string,
      username: acc?.username ?? "알 수 없음",
      avatarUrl: acc?.profile_picture_url ?? null,
      kind: p.kind as string,
      text: p.text as string,
      permalink: p.permalink as string | null,
      publishedAt: p.published_at as string,
      insights: ins,
      bookmarked: ((p.bookmarks ?? []) as unknown[]).length > 0,
      thumb: media[0] ? { url: media[0].public_url, type: media[0].media_type } : null,
      mediaCount: media.length,
      repliesFailed: ((p.post_replies ?? []) as { status: string }[]).filter((r) => r.status === "failed").length,
    };
  });

  return (
    <>
      <PageHeader title="내가 올린 글" description="발행된 글과 성과를 확인하고, 반응 좋은 글은 ★로 보석함에 저장합니다." />
      {res.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">불러오기 실패: {res.error.message}</p>}
      <PublishedList
        items={items}
        accounts={(accRes.data ?? []) as { id: string; username: string }[]}
        accountId={accountId}
        page={page}
        pageCount={Math.max(1, Math.ceil((res.count ?? 0) / PAGE_SIZE))}
        total={res.count ?? 0}
      />
    </>
  );
}

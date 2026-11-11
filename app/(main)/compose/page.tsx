import { PageHeader } from "@/components/layout/page-header";
import { Composer, type ComposerAccount, type ComposerDisclosure } from "@/components/compose/composer";
import type { DraftItem } from "@/components/compose/drafts-menu";
import { composeSchema, emptyCompose, type Compose } from "@/lib/compose/schema";
import { db } from "@/lib/db/admin";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "글 작성 · AUTO THREAD" };
export const dynamic = "force-dynamic";

export default async function ComposePage({ searchParams }: { searchParams: Promise<{ id?: string; account?: string }> }) {
  const { id, account } = await searchParams;
  const [accRes, discRes, draftRes, settings, postRes] = await Promise.all([
    db().from("threads_accounts").select("id, username, profile_picture_url, status").neq("status", "disabled").order("created_at"),
    db().from("disclosures").select("id, name, text, match_domains, default_position, is_default").order("is_default", { ascending: false }).order("name"),
    db()
      .from("posts")
      .select("id, text, updated_at, compose, threads_accounts(username)")
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(50),
    getSettings(),
    id
      ? db().from("posts").select("id, status, compose, scheduled_at").eq("id", id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const accounts = (accRes.data ?? []) as ComposerAccount[];
  const drafts: DraftItem[] = (draftRes.data ?? []).map((d) => ({
    id: d.id as string,
    text: ((d.compose as { text?: string } | null)?.text ?? (d.text as string)) || "",
    updated_at: d.updated_at as string,
    username: (d.threads_accounts as unknown as { username: string } | null)?.username ?? null,
  }));

  let compose: Compose = emptyCompose(account && accounts.some((a) => a.id === account) ? account : "");
  let loadError: string | null = null;
  const post = postRes.data as { id: string; status: string; compose: unknown; scheduled_at: string | null } | null;
  if (id && !post) loadError = "글을 찾을 수 없습니다.";
  if (post) {
    const parsed = composeSchema.safeParse(post.compose);
    if (parsed.success) compose = parsed.data;
    else loadError = "저장된 작성 내용을 불러오지 못했습니다.";
    if (!["draft", "review", "scheduled", "failed", "cancelled"].includes(post.status)) {
      loadError = "이미 발행 중이거나 발행된 글은 수정할 수 없습니다.";
    }
  }
  const editable = post && !loadError;

  return (
    <>
      <PageHeader title="글 작성" description="설정 → 작성 → 발행 3단계로 글을 만들고 예약합니다." />
      {loadError && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">{loadError}</p>}
      <Composer
        key={editable ? post.id : "new"}
        accounts={accounts}
        disclosures={(discRes.data ?? []) as ComposerDisclosure[]}
        bannedWords={settings.bannedWords}
        drafts={drafts}
        initial={{
          postId: editable ? post.id : null,
          compose,
          status: editable ? post.status : null,
          scheduledAt: editable ? post.scheduled_at : null,
        }}
      />
    </>
  );
}

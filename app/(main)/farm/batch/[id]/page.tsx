import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BatchView, type BatchPost } from "@/components/farm/batch-view";
import { addDays } from "@/lib/calendar";
import { db } from "@/lib/db/admin";
import type { FarmConfig } from "@/lib/farm/types";

export const metadata = { title: "농장 · AUTO THREAD" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function BatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: camps } = await db()
    .from("campaigns")
    .select("id, kind, start_date, days, mode, status, config, job_id, active_start, active_end, threads_accounts(username)")
    .eq("batch_id", id);
  const campaigns = (camps ?? []) as unknown as {
    id: string;
    kind: string;
    start_date: string;
    days: number;
    mode: string;
    status: string;
    config: FarmConfig;
    job_id: string | null;
    active_start: string;
    active_end: string;
    threads_accounts: { username: string } | null;
  }[];
  if (!campaigns.length) notFound();
  const c0 = campaigns[0];
  const status = sp.status && ["review", "scheduled", "published", "failed", "cancelled", "draft"].includes(sp.status) ? sp.status : null;

  let q = db()
    .from("posts")
    .select("id, account_id, kind, status, text, scheduled_at, last_error, ai_meta, permalink, threads_accounts(username), post_media(id), post_replies(id)")
    .in("campaign_id", campaigns.map((c) => c.id))
    .order("scheduled_at")
    .limit(1000);
  if (status) q = q.eq("status", status);
  const [postRes, countRes] = await Promise.all([q, db().from("posts").select("status").in("campaign_id", campaigns.map((c) => c.id)).limit(50000)]);
  const counts: Record<string, number> = {};
  for (const p of (countRes.data ?? []) as { status: string }[]) counts[p.status] = (counts[p.status] ?? 0) + 1;

  const posts: BatchPost[] = ((postRes.data ?? []) as unknown as {
    id: string;
    kind: string;
    status: string;
    text: string;
    scheduled_at: string | null;
    last_error: string | null;
    ai_meta: { farm?: { pickAtPublish?: boolean; issues?: string[]; type?: string } } | null;
    permalink: string | null;
    threads_accounts: { username: string } | null;
    post_media: unknown[];
    post_replies: unknown[];
  }[]).map((p) => ({
    id: p.id,
    username: p.threads_accounts?.username ?? "",
    kind: p.kind,
    status: p.status,
    text: p.text,
    scheduledAt: p.scheduled_at,
    lastError: p.last_error,
    pickAtPublish: !!p.ai_meta?.farm?.pickAtPublish,
    issues: p.ai_meta?.farm?.issues ?? [],
    mediaCount: p.post_media?.length ?? 0,
    replyCount: p.post_replies?.length ?? 0,
    permalink: p.permalink,
  }));

  const back = c0.kind === "monetize" ? "/farm/monetize" : "/farm/growth";
  return (
    <>
      <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {c0.kind === "monetize" ? "수익화 농장" : "계정 키우기 농장"}
      </Link>
      <PageHeader
        title={`${c0.start_date} ~ ${addDays(c0.start_date, c0.days - 1)}`}
        description={`${campaigns.map((c) => `@${c.threads_accounts?.username}`).join(", ")} · ${c0.mode === "review" ? "검토 모드" : "자동 모드"} · ${c0.active_start.slice(0, 5)}~${c0.active_end.slice(0, 5)}`}
      />
      <BatchView
        batchId={id}
        jobId={c0.job_id}
        mode={c0.mode}
        cancelled={campaigns.every((c) => c.status === "cancelled")}
        skipped={campaigns.reduce((s, c) => s + (c.config.skipped ?? 0), 0)}
        counts={counts}
        posts={posts}
        status={status}
      />
    </>
  );
}

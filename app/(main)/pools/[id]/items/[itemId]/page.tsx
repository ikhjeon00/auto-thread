import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PoolItemEditor } from "@/components/pools/item-editor";
import type { ComposerDisclosure } from "@/components/compose/composer";
import { emptyCompose, poolItemToContent } from "@/lib/compose/schema";
import { db } from "@/lib/db/admin";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";

export const metadata = { title: "창고 글 편집 · AUTO THREAD" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/;
const LOCKED: Record<string, string> = { reserved: "예약됨", used: "사용 완료" };

export default async function PoolItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const isNew = itemId === "new";
  if (!UUID.test(id) || (!isNew && !UUID.test(itemId))) notFound();

  const [poolRes, itemRes, discRes, settings] = await Promise.all([
    db().from("content_pools").select("id, name").eq("id", id).maybeSingle(),
    isNew
      ? Promise.resolve({ data: null })
      : db().from("pool_items").select("id, text, first_reply, topic_tag, category, weight, status, compose").eq("id", itemId).eq("pool_id", id).maybeSingle(),
    db().from("disclosures").select("id, name, text, match_domains, default_position, is_default").order("is_default", { ascending: false }).order("name"),
    getSettings().catch(() => DEFAULT_SETTINGS),
  ]);
  if (!poolRes.data || (!isNew && !itemRes.data)) notFound();
  const item = itemRes.data as { text: string; first_reply: string | null; topic_tag: string | null; category: string | null; weight: number; status: string; compose: unknown } | null;
  const base = emptyCompose();
  const content = item
    ? poolItemToContent(item)
    : {
        kind: base.kind,
        text: "",
        media: [],
        replies: [],
        firstReplyMainMedia: false,
        linkUrl: null,
        linkPosition: base.linkPosition,
        topicTag: null,
        disclosureId: null,
        disclosurePosition: base.disclosurePosition,
        isAiLabel: false,
      };
  const status = item && ["pending", "available", "archived"].includes(item.status) ? (item.status as "pending" | "available" | "archived") : "available";

  return (
    <>
      <Link href={`/pools/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {poolRes.data.name as string}
      </Link>
      <PageHeader title={isNew ? "창고 글 쓰기" : "창고 글 편집"} description="사진·영상, 댓글, 링크, 고지 문구까지 글 작성과 똑같이 준비해 두면 꺼낼 때 그대로 들어갑니다." />
      <PoolItemEditor
        poolId={id}
        poolName={poolRes.data.name as string}
        itemId={isNew ? null : itemId}
        initial={content}
        meta={{ category: item?.category ?? null, weight: item?.weight ?? 1, status }}
        lockedStatus={item ? (LOCKED[item.status] ?? null) : null}
        disclosures={(discRes.data ?? []) as ComposerDisclosure[]}
        bannedWords={settings.bannedWords}
      />
    </>
  );
}

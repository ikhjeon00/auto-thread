import "server-only";
import { db } from "@/lib/db/admin";
import { generatePosts } from "@/lib/ai/generate";
import { notify } from "@/lib/notify";
import { registerJob } from "./index";

/** 창고 AI 일괄 생성: 1회 호출로 최대 20개 */
registerJob("pool_fill", async ({ job, progress }) => {
  const p = job.payload as { poolId: string; count: number; generatorId?: string | null; topic?: string | null; autoApprove?: boolean };
  const { data: pool } = await db().from("content_pools").select("id, name, persona_filter").eq("id", p.poolId).maybeSingle();
  if (!pool) throw new Error("창고가 삭제되었습니다.");
  const { data: existing } = await db().from("pool_items").select("text").eq("pool_id", p.poolId).neq("status", "archived").order("created_at", { ascending: false }).limit(40);
  const filter = (pool.persona_filter ?? {}) as { age_group?: string | null; gender?: string | null; job?: string | null };
  const count = Math.max(1, Math.min(20, p.count || 20));
  await progress(0, count);

  const r = await generatePosts({
    persona: { age_group: filter.age_group ?? null, gender: filter.gender ?? null, job: filter.job ?? null, tone: null },
    avoidTexts: ((existing ?? []) as { text: string }[]).map((e) => e.text),
    generatorId: p.generatorId ?? null,
    kind: "general",
    topic: p.topic ?? null,
    count,
    purpose: "pool",
    jobId: job.id,
  });

  // 검사를 통과한 글만 넣는다(문제가 남은 글은 버림)
  const good = r.posts.filter((x) => !x.issues.length);
  if (good.length) {
    const { error } = await db()
      .from("pool_items")
      .insert(
        good.map((x) => ({
          pool_id: p.poolId,
          text: x.text,
          first_reply: x.first_reply || null,
          topic_tag: x.topic_tag || null,
          category: x.category || null,
          status: p.autoApprove ? "available" : "pending",
          source: "ai",
        })),
      );
    if (error) throw new Error(error.message);
  }
  await progress(good.length, count);
  if (good.length < count) {
    await notify("warn", "ai_partial", `창고 「${pool.name}」: ${count}개 중 ${good.length}개만 검사를 통과해 넣었습니다.`, `/pools/${p.poolId}`);
  }
  return { added: good.length, dropped: r.posts.length - good.length, costUsd: r.meta.costUsd, model: `${r.meta.model.provider}:${r.meta.model.model}` };
});

// 농장 만들기(시간 배치 + 내용 채우기)
import "@/lib/farm/build";

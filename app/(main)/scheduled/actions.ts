"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { errorMessage } from "@/lib/errors";
import { db } from "@/lib/db/admin";
import { checkSchedule, type ScheduleCheck } from "@/lib/scheduler/check";
import { releasePoolItem } from "@/lib/pool/pick";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; conflict?: ScheduleCheck };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: errorMessage(e) });
const uuid = z.string().uuid();

function refresh() {
  revalidatePath("/scheduled");
  revalidatePath("/", "layout"); // 사이드바 배지
}

/** 예약 시간 변경. 다른 예약과 겹치면 force 없이는 conflict 를 돌려준다 */
export async function rescheduleAction(id: string, iso: string, force = false): Promise<Result> {
  try {
    await requireSession();
    const postId = uuid.parse(id);
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) throw new Error("시간이 올바르지 않습니다.");
    if (at.getTime() < Date.now() - 60_000) throw new Error("지난 시간으로는 바꿀 수 없습니다.");
    const { data: post } = await db().from("posts").select("account_id, status").eq("id", postId).single();
    if (!post) throw new Error("글을 찾을 수 없습니다.");
    if (post.status !== "scheduled") throw new Error("예약 상태인 글만 시간을 바꿀 수 있습니다.");
    if (!force) {
      const check = await checkSchedule(post.account_id as string, at, postId);
      if (check.conflicts.length) return { ok: false, error: "다른 예약과 너무 가깝습니다.", conflict: check };
    }
    const { data, error } = await db()
      .from("posts")
      .update({ scheduled_at: at.toISOString(), next_attempt_at: null })
      .eq("id", postId)
      .eq("status", "scheduled")
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("이미 발행이 시작된 글입니다.");
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** 예약 취소 (예약·실패 상태만. 발행 중인 글은 취소할 수 없다) */
export async function cancelAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const { data, error } = await db()
      .from("posts")
      .update({ status: "cancelled", next_attempt_at: null })
      .eq("id", uuid.parse(id))
      .in("status", ["scheduled", "failed"])
      .select("id, pool_item_id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("발행 중이거나 이미 처리된 글은 취소할 수 없습니다.");
    // 창고에서 가져온 글이면 다시 쓸 수 있게 돌려놓는다
    if (data[0].pool_item_id) await releasePoolItem(data[0].pool_item_id as string);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 실패 재시도.
 * - 본문 발행 실패(failed): 처음부터 다시(컨테이너 초기화). 원래 시간이 지났으면 지금 바로.
 * - 본문은 올라갔고 댓글만 실패: 남은 댓글만 다시.
 */
export async function retryAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const postId = uuid.parse(id);
    const { data: post } = await db()
      .from("posts")
      .select("status, scheduled_at, threads_media_id, account_id, threads_accounts(status, username)")
      .eq("id", postId)
      .single();
    if (!post) throw new Error("글을 찾을 수 없습니다.");
    const acc = post.threads_accounts as unknown as { status: string; username: string } | null;
    if (acc?.status !== "active") throw new Error(`@${acc?.username ?? "계정"} 계정을 먼저 다시 연결하세요(설정).`);

    if (post.status === "failed" && !post.threads_media_id) {
      const sched = post.scheduled_at && Date.parse(post.scheduled_at as string) > Date.now() ? post.scheduled_at : new Date().toISOString();
      await db().from("post_media").update({ container_id: null }).eq("post_id", postId);
      await db().from("post_replies").update({ container_id: null, status: "pending", attempt_count: 0, last_error: null }).eq("post_id", postId);
      const { error } = await db()
        .from("posts")
        .update({
          status: "scheduled",
          scheduled_at: sched,
          attempt_count: 0,
          next_attempt_at: null,
          last_error: null,
          container_id: null,
          container_created_at: null,
          locked_until: null,
        })
        .eq("id", postId)
        .eq("status", "failed");
      if (error) throw new Error(error.message);
    } else if (post.status === "published") {
      const { data: failed } = await db()
        .from("post_replies")
        .update({ status: "pending", container_id: null, attempt_count: 0, last_error: null })
        .eq("post_id", postId)
        .eq("status", "failed")
        .select("id");
      if (!failed?.length) throw new Error("다시 올릴 댓글이 없습니다.");
      await db().from("posts").update({ replies_pending: true, attempt_count: 0, next_attempt_at: null, last_error: null }).eq("id", postId);
    } else {
      throw new Error("실패한 글만 재시도할 수 있습니다.");
    }
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** 취소된 글 삭제 */
export async function deleteAction(id: string): Promise<Result> {
  try {
    await requireSession();
    const { data, error } = await db().from("posts").delete().eq("id", uuid.parse(id)).in("status", ["cancelled", "draft"]).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("취소된 글만 삭제할 수 있습니다.");
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

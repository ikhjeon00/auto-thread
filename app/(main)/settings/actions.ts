"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { db } from "@/lib/db/admin";
import { publishTextNow } from "@/lib/threads/accounts";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

const uuid = z.string().uuid();

const accountPatch = z.object({
  group_id: uuid.nullable().optional(),
  daily_post_limit: z.coerce.number().int().min(0).max(250).optional(),
});

export async function updateAccount(id: string, patch: z.input<typeof accountPatch>): Promise<ActionResult> {
  try {
    await requireSession();
    const data = accountPatch.parse(patch);
    const { error } = await db().from("threads_accounts").update(data).eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 연결 해제: 토큰을 지우고 비활성화. 예약된 글은 취소한다. 다시 연결하면 복구된다. */
export async function disconnectAccount(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const accountId = uuid.parse(id);
    const { error } = await db()
      .from("threads_accounts")
      .update({ status: "disabled", access_token_enc: null, token_expires_at: null })
      .eq("id", accountId);
    if (error) throw new Error(error.message);
    await db().from("posts").update({ status: "cancelled" }).eq("account_id", accountId).eq("status", "scheduled");
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function testPublish(id: string, text: string): Promise<ActionResult<{ permalink: string | null }>> {
  try {
    await requireSession();
    const res = await publishTextNow(uuid.parse(id), z.string().max(5000).parse(text));
    revalidatePath("/settings");
    return { ok: true, data: { permalink: res.permalink } };
  } catch (e) {
    return fail(e);
  }
}

const groupInput = z.object({
  name: z.string().trim().min(1, "그룹 이름을 입력하세요.").max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function createGroup(input: z.input<typeof groupInput>): Promise<ActionResult> {
  try {
    await requireSession();
    const { error } = await db().from("account_groups").insert(groupInput.parse(input));
    if (error) throw new Error(error.code === "23505" ? "같은 이름의 그룹이 있습니다." : error.message);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const { error } = await db().from("account_groups").delete().eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

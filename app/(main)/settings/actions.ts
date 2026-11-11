"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { errorMessage } from "@/lib/errors";
import { db } from "@/lib/db/admin";
import { publishTextNow } from "@/lib/threads/accounts";
import { saveSettings } from "@/lib/settings";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: errorMessage(e) };
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

// ---------------------------------------------------------------- 제휴 고지 문구

const disclosureInput = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(40),
  text: z.string().trim().min(1, "문구를 입력하세요.").max(300),
  match_domains: z
    .array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "도메인 형식이 올바르지 않습니다(예: link.coupang.com)."))
    .max(20),
  is_default: z.boolean(),
  default_position: z.enum(["body", "link_reply", "separate_reply"]),
});
export type DisclosureInput = z.input<typeof disclosureInput>;

export async function saveDisclosure(id: string | null, input: DisclosureInput): Promise<ActionResult> {
  try {
    await requireSession();
    const data = disclosureInput.parse(input);
    if (data.is_default) {
      // 기본값은 하나만
      await db().from("disclosures").update({ is_default: false }).eq("is_default", true);
    }
    const q = id ? db().from("disclosures").update(data).eq("id", uuid.parse(id)) : db().from("disclosures").insert(data);
    const { error } = await q;
    if (error) throw new Error(error.code === "23505" ? "같은 이름의 고지 문구가 있습니다." : error.message);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDisclosure(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const { error } = await db().from("disclosures").delete().eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 일반 설정

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식은 HH:MM 입니다.");
const generalInput = z
  .object({
    activeHours: z.object({ start: hm, end: hm }),
    bannedWords: z.array(z.string().trim().min(1).max(50)).max(200),
    globalDailyLimit: z.coerce.number().int().min(1).max(5000),
    defaultDailyPostLimit: z.coerce.number().int().min(0).max(250),
    minGapMinutes: z.coerce.number().int().min(0).max(240),
    sameAccountGapMinutes: z.coerce.number().int().min(0).max(1440),
    poolEmptyBehavior: z.enum(["skip", "ai_generate"]),
  })
  .refine((v) => v.activeHours.start < v.activeHours.end, { message: "활동 시작 시간이 끝 시간보다 빨라야 합니다." });
export type GeneralInput = z.input<typeof generalInput>;

export async function saveGeneralSettings(input: GeneralInput): Promise<ActionResult> {
  try {
    await requireSession();
    await saveSettings(generalInput.parse(input));
    revalidatePath("/settings");
    revalidatePath("/compose");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- 팔로워 구간별 권장 게시 수

const tierInput = z
  .array(
    z.object({
      min: z.coerce.number().int().min(0),
      max: z.coerce.number().int().min(0).nullable(),
      daily_posts: z.coerce.number().int().min(0).max(50),
    }),
  )
  .min(1, "구간을 하나 이상 넣으세요.")
  .max(20)
  .refine((t) => t.every((x) => x.max === null || x.max >= x.min), { message: "각 구간의 끝은 시작보다 커야 합니다." })
  .refine((t) => t.slice(1).every((x, i) => t[i].max !== null && x.min > (t[i].max as number)), { message: "구간이 겹치거나 순서가 맞지 않습니다(위에서부터 작은 수 → 큰 수, 마지막만 끝을 비울 수 있음)." });

export async function saveFollowerTiersAction(tiers: z.input<typeof tierInput>): Promise<ActionResult> {
  try {
    await requireSession();
    const value = tierInput.parse(tiers);
    const { error } = await db().from("app_settings").upsert({ key: "follower_tiers", value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    revalidatePath("/farm/growth");
    revalidatePath("/farm/monetize");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

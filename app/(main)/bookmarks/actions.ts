"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { errorMessage } from "@/lib/errors";
import { db } from "@/lib/db/admin";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: errorMessage(e) });
const uuid = z.string().uuid();

const tags = z.array(z.string().trim().min(1).max(20)).max(10);

const referenceInput = z.object({
  text: z.string().trim().min(1, "참고 문장을 입력하세요.").max(5000),
  source_url: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\//i.test(v), "출처 주소는 http(s):// 로 시작해야 합니다."),
  tags,
});

/** 참고 글은 직접 붙여 넣은 것만 저장한다(자동 수집 없음) */
export async function addReferenceAction(input: z.input<typeof referenceInput>): Promise<Result> {
  try {
    await requireSession();
    const v = referenceInput.parse(input);
    const { error } = await db().from("bookmarks").insert({ kind: "reference", ...v });
    if (error) throw new Error(error.message);
    revalidatePath("/bookmarks");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function updateBookmarkAction(id: string, input: { text: string; tags: string[] }): Promise<Result> {
  try {
    await requireSession();
    const v = z.object({ text: z.string().trim().min(1, "내용을 입력하세요.").max(5000), tags }).parse(input);
    const { error } = await db().from("bookmarks").update(v).eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    revalidatePath("/bookmarks");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBookmarksAction(ids: string[]): Promise<Result<{ deleted: number }>> {
  try {
    await requireSession();
    const { data, error } = await db().from("bookmarks").delete().in("id", z.array(uuid).min(1).max(500).parse(ids)).select("id");
    if (error) throw new Error(error.message);
    revalidatePath("/bookmarks");
    revalidatePath("/published");
    return { ok: true, data: { deleted: data?.length ?? 0 } };
  } catch (e) {
    return fail(e);
  }
}

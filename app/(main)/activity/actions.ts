"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { db } from "@/lib/db/admin";

export type Result = { ok: true } | { ok: false; error: string };

export async function markReadAction(ids: string[]): Promise<Result> {
  try {
    await requireSession();
    const list = z.array(z.string().uuid()).max(200).parse(ids);
    if (list.length) {
      const { error } = await db().from("notifications").update({ is_read: true }).in("id", list);
      if (error) throw new Error(error.message);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function markAllReadAction(): Promise<Result> {
  try {
    await requireSession();
    const { error } = await db().from("notifications").update({ is_read: true }).eq("is_read", false);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

import "server-only";
import { db } from "@/lib/db/admin";

export type NotificationLevel = "info" | "warn" | "error";

export async function notify(level: NotificationLevel, type: string, message: string, link?: string) {
  const { error } = await db().from("notifications").insert({ level, type, message, link: link ?? null });
  if (error) console.error("[notify] 저장 실패", error.message);
}

export type PostStatus = "draft" | "review" | "scheduled" | "processing" | "published" | "failed" | "cancelled";

export type ScheduledItem = {
  id: string;
  accountId: string;
  username: string;
  avatarUrl: string | null;
  status: PostStatus;
  kind: "general" | "product";
  scheduledAt: string | null;
  text: string;
  mediaCount: number;
  replyCount: number;
  repliesFailed: number;
  lastError: string | null;
  attemptCount: number;
  permalink: string | null;
  nextAttemptAt: string | null;
};

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "임시 저장",
  review: "검토 대기",
  scheduled: "예약",
  processing: "발행 중",
  published: "발행됨",
  failed: "실패",
  cancelled: "취소",
};

export const FILTER_STATUSES: PostStatus[] = ["scheduled", "processing", "failed", "cancelled", "published"];
export const DEFAULT_STATUSES: PostStatus[] = ["scheduled", "processing", "failed"];

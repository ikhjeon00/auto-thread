import { z } from "zod";

export const MAX_MEDIA = 20;
export const MAX_REPLIES = 10;

export const mediaItemSchema = z.object({
  storagePath: z.string().min(1),
  publicUrl: z.string().url(),
  mediaType: z.enum(["image", "video"]),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});
export type MediaItem = z.infer<typeof mediaItemSchema>;

/** 댓글: 글 + (선택) 사진·영상 1개. 예전 형식(문자열)도 받아들인다. */
export const replySchema = z.preprocess(
  (v) => (typeof v === "string" ? { text: v, media: null } : v),
  z.object({
    text: z.string().max(5000).default(""),
    media: mediaItemSchema.nullable().optional().transform((m) => m ?? null),
  }),
);
export type ReplyItem = z.output<typeof replySchema>;

export const LINK_POSITIONS = ["body", "first_reply"] as const;
export const DISCLOSURE_POSITIONS = ["body", "link_reply", "separate_reply"] as const;
export type LinkPosition = (typeof LINK_POSITIONS)[number];
export type DisclosurePosition = (typeof DISCLOSURE_POSITIONS)[number];

/** 작성 화면 상태. posts.compose 에 그대로 저장해 수정할 때 다시 불러온다. */
export const composeSchema = z.object({
  accountId: z.string().uuid(),
  kind: z.enum(["general", "product"]).default("general"),
  text: z.string().max(5000).default(""),
  media: z.array(mediaItemSchema).max(MAX_MEDIA).default([]),
  replies: z.array(replySchema).max(MAX_REPLIES).default([]),
  /** 첫 댓글에 본문 첫 사진을 붙인다(링크 미리보기 카드 없이 깔끔하게) */
  firstReplyMainMedia: z.boolean().default(false),
  linkUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "링크는 http(s):// 로 시작해야 합니다."),
  linkPosition: z.enum(LINK_POSITIONS).default("body"),
  topicTag: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/^#/, "") : null)),
  disclosureId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  disclosurePosition: z.enum(DISCLOSURE_POSITIONS).default("link_reply"),
  isAiLabel: z.boolean().default(false),
});
export type ComposeInput = z.input<typeof composeSchema>;
export type Compose = z.output<typeof composeSchema>;

export const emptyCompose = (accountId = ""): Compose => ({
  accountId,
  kind: "general",
  text: "",
  media: [],
  replies: [],
  firstReplyMainMedia: false,
  linkUrl: null,
  linkPosition: "body",
  topicTag: null,
  disclosureId: null,
  disclosurePosition: "link_reply",
  isAiLabel: false,
});

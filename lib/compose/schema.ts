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
  replies: z.array(z.string().max(5000)).max(MAX_REPLIES).default([]),
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
  linkUrl: null,
  linkPosition: "body",
  topicTag: null,
  disclosureId: null,
  disclosurePosition: "link_reply",
  isAiLabel: false,
});

import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require";
import { db } from "@/lib/db/admin";
import { env } from "@/lib/env";

/**
 * 브라우저가 Supabase Storage로 직접 올릴 수 있도록 signed upload URL을 발급한다.
 * (Vercel 함수 요청 크기 제한 때문에 파일 자체는 서버를 거치지 않는다)
 */
const ALLOWED: Record<string, { type: "image" | "video"; max: number }> = {
  "image/jpeg": { type: "image", max: 8 * 1024 * 1024 },
  "image/png": { type: "image", max: 8 * 1024 * 1024 },
  "video/mp4": { type: "video", max: 1024 * 1024 * 1024 },
  "video/quicktime": { type: "video", max: 1024 * 1024 * 1024 },
};

const bodySchema = z.object({
  folder: z.enum(["uploads", "assets", "products"]).default("uploads"),
  files: z
    .array(z.object({ name: z.string().min(1).max(200), contentType: z.string(), size: z.number().int().positive() }))
    .min(1)
    .max(20),
});

function safeName(name: string, contentType: string): string {
  const ext = { "image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4", "video/quicktime": "mov" }[contentType] ?? "bin";
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "file"}.${ext}`;
}

export async function POST(req: NextRequest) {
  await requireSession();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });

  const bucket = env().STORAGE_BUCKET;
  const out = [];
  for (const f of parsed.data.files) {
    const rule = ALLOWED[f.contentType];
    if (!rule) return NextResponse.json({ error: `지원하지 않는 형식입니다: ${f.contentType}` }, { status: 400 });
    if (f.size > rule.max) {
      return NextResponse.json({ error: `${f.name}: 파일이 너무 큽니다(최대 ${rule.max / 1024 / 1024}MB).` }, { status: 400 });
    }
    const path = `${parsed.data.folder}/${randomUUID()}/${safeName(f.name, f.contentType)}`;
    const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: `업로드 URL 발급 실패: ${error?.message}` }, { status: 500 });
    const { data: pub } = db().storage.from(bucket).getPublicUrl(path);
    out.push({ path, token: data.token, publicUrl: pub.publicUrl, mediaType: rule.type });
  }
  return NextResponse.json({ bucket, files: out });
}

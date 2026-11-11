"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/db/url";
import type { MediaItem } from "@/lib/compose/schema";
import type { Prepared } from "./prepare";

let client: SupabaseClient | null = null;
function browserClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Supabase 공개 환경변수가 설정되지 않았습니다.");
    client = createClient(normalizeSupabaseUrl(url), anon.trim(), { auth: { persistSession: false } });
  }
  return client;
}

type Signed = { path: string; token: string; publicUrl: string; mediaType: "image" | "video" };

/** 서버에서 signed upload URL을 받아 Supabase Storage에 직접 올린다 */
export async function uploadPrepared(files: Prepared[], folder: "uploads" | "assets" | "products" = "uploads"): Promise<MediaItem[]> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, files: files.map((f) => ({ name: f.name, contentType: f.contentType, size: f.blob.size })) }),
  });
  const json = (await res.json().catch(() => ({}))) as { bucket?: string; files?: Signed[]; error?: string };
  if (!res.ok || !json.files || !json.bucket) throw new Error(json.error ?? `업로드 준비 실패 (${res.status})`);

  const storage = browserClient().storage.from(json.bucket);
  return Promise.all(
    json.files.map(async (s, i) => {
      const f = files[i];
      const { error } = await storage.uploadToSignedUrl(s.path, s.token, f.blob, { contentType: f.contentType });
      if (error) throw new Error(`${f.name} 업로드 실패: ${error.message}`);
      return { storagePath: s.path, publicUrl: s.publicUrl, mediaType: s.mediaType, width: f.width ?? null, height: f.height ?? null };
    }),
  );
}

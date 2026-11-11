import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

/** service role 클라이언트. 서버 코드에서만 사용한다(RLS 우회). */
export function db(): SupabaseClient {
  if (client) return client;
  const e = env();
  client = createClient(normalizeSupabaseUrl(e.NEXT_PUBLIC_SUPABASE_URL), e.SUPABASE_SERVICE_ROLE_KEY.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * 프로젝트 주소만 남긴다. 사용자가 "https://xxx.supabase.co/rest/v1/" 처럼
 * 경로까지 붙여 넣으면 Supabase가 "Invalid path specified in request URL"을 돌려준다.
 */
export function normalizeSupabaseUrl(raw: string): string {
  const u = new URL(raw.trim());
  return `${u.protocol}//${u.host}`;
}

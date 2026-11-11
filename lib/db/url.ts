/**
 * 프로젝트 주소만 남긴다. "https://xxx.supabase.co/rest/v1/" 처럼 경로까지 붙여 넣으면
 * Supabase가 "Invalid path specified in request URL"을 돌려준다.
 */
export function normalizeSupabaseUrl(raw: string): string {
  const u = new URL(raw.trim());
  return `${u.protocol}//${u.host}`;
}

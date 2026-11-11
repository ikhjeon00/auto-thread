import "server-only";
import { z } from "zod";

/** 서버 전용 환경변수. 필요한 시점에 lazily 검증한다. */
const serverSchema = z.object({
  APP_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().default("media"),
  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),
  THREADS_REDIRECT_URI: z.string().url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  CRON_SECRET: z.string().min(16),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_TEXT: z.string().optional(),
  AI_MODEL_VISION: z.string().optional(),
  APP_TIMEZONE: z.string().default("Asia/Seoul"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`환경변수 설정 오류: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}

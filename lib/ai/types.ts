/** AI 공통 타입. 회사(OpenAI/Gemini)를 바꿔도 앱 코드는 이 형태만 쓴다. */
export const PROVIDERS = ["openai", "gemini"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABEL: Record<Provider, string> = { openai: "OpenAI (GPT)", gemini: "Google Gemini" };

export type ModelRef = { provider: Provider; model: string };

export type JsonSchema = Record<string, unknown>;

export type JsonRequest = {
  model: string;
  system: string;
  prompt: string;
  /** 사진 이해용 이미지(공개 URL) */
  images?: { url: string; mimeType?: string }[];
  schemaName: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
};

export type Usage = { input: number; output: number; cached: number; reasoning: number };

export type JsonResponse = { text: string; usage: Usage; model: string };

export interface AiProvider {
  readonly name: Provider;
  generateJson(req: JsonRequest): Promise<JsonResponse>;
  listModels(): Promise<string[]>;
  /** 아주 짧은 시험 호출로 이 키로 그 모델을 실제로 쓸 수 있는지 확인. 안 되면 AiError */
  checkModel(model: string): Promise<void>;
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly kind: "no_key" | "no_model" | "api" | "invalid_output" | "rate_limit",
  ) {
    super(message);
    this.name = "AiError";
  }
}

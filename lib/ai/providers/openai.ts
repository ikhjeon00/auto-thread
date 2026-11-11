import "server-only";
import OpenAI from "openai";
import { AiError, type AiProvider, type JsonRequest, type JsonResponse } from "../types";

/** OpenAI Responses API + JSON 스키마 강제 출력 */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
  }

  async generateJson(req: JsonRequest): Promise<JsonResponse> {
    try {
      const res = await this.client.responses.create({
        model: req.model,
        instructions: req.system,
        input: [
          {
            role: "user",
            content: [
              ...(req.images ?? []).map((img) => ({ type: "input_image" as const, image_url: img.url, detail: "auto" as const })),
              { type: "input_text" as const, text: req.prompt },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: req.schemaName, schema: req.schema, strict: true } },
        max_output_tokens: req.maxOutputTokens ?? 16_000,
      });
      const u = res.usage;
      return {
        text: res.output_text,
        model: res.model ?? req.model,
        usage: {
          input: u?.input_tokens ?? 0,
          output: u?.output_tokens ?? 0,
          cached: u?.input_tokens_details?.cached_tokens ?? 0,
          reasoning: u?.output_tokens_details?.reasoning_tokens ?? 0,
        },
      };
    } catch (e) {
      throw toAiError(e);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const out: string[] = [];
      for await (const m of this.client.models.list()) out.push(m.id);
      return out.sort();
    } catch (e) {
      throw toAiError(e);
    }
  }

  async checkModel(model: string): Promise<void> {
    try {
      await this.client.responses.create({ model, input: "ping", max_output_tokens: 16 });
    } catch (e) {
      throw toAiError(e);
    }
  }
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof OpenAI.APIError) {
    if (e.status === 401) return new AiError("OpenAI 키가 올바르지 않습니다.", "no_key");
    if (e.status === 429) return new AiError("OpenAI 사용 한도 초과 또는 잔액 부족입니다(429).", "rate_limit");
    if (e.status === 404) return new AiError(`OpenAI 모델을 찾을 수 없습니다: ${e.message}`, "no_model");
    return new AiError(`OpenAI 오류(${e.status ?? "?"}): ${e.message}`, "api");
  }
  return new AiError(`OpenAI 호출 실패: ${e instanceof Error ? e.message : String(e)}`, "api");
}

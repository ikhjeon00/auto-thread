import "server-only";
import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { AiError, type AiProvider, type JsonRequest, type JsonResponse } from "../types";

/** Google Gemini (AI Studio 키) + JSON 스키마 강제 출력 */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJson(req: JsonRequest): Promise<JsonResponse> {
    try {
      // 이미지는 서버에서 내려받아 inline 으로 보낸다(외부 URL 직접 참조 대신)
      const imageParts: Part[] = await Promise.all(
        (req.images ?? []).map(async (img) => {
          const r = await fetch(img.url, { signal: AbortSignal.timeout(20_000) });
          if (!r.ok) throw new AiError(`이미지를 내려받지 못했습니다(${r.status}): ${img.url}`, "api");
          const buf = Buffer.from(await r.arrayBuffer());
          return { inlineData: { data: buf.toString("base64"), mimeType: img.mimeType ?? r.headers.get("content-type") ?? "image/jpeg" } };
        }),
      );
      const res = await this.ai.models.generateContent({
        model: req.model,
        contents: [{ role: "user", parts: [...imageParts, { text: req.prompt }] }],
        config: {
          systemInstruction: req.system,
          responseMimeType: "application/json",
          responseJsonSchema: stripAdditionalProperties(req.schema),
          maxOutputTokens: req.maxOutputTokens ?? 16_000,
        },
      });
      const u = res.usageMetadata;
      return {
        text: res.text ?? "",
        model: res.modelVersion ?? req.model,
        usage: {
          input: u?.promptTokenCount ?? 0,
          // 생각(thinking) 토큰도 출력 단가로 과금된다
          output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
          cached: u?.cachedContentTokenCount ?? 0,
          reasoning: u?.thoughtsTokenCount ?? 0,
        },
      };
    } catch (e) {
      throw toAiError(e);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const out: string[] = [];
      const pager = await this.ai.models.list({ config: { pageSize: 100 } });
      for await (const m of pager) {
        if (m.name && (m.supportedActions ?? ["generateContent"]).includes("generateContent")) out.push(m.name.replace(/^models\//, ""));
      }
      return out.sort();
    } catch (e) {
      throw toAiError(e);
    }
  }
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof ApiError) {
    if (e.status === 400 && /API key/i.test(e.message)) return new AiError("Gemini 키가 올바르지 않습니다.", "no_key");
    if (e.status === 403) return new AiError("Gemini 키 권한이 없습니다(403).", "no_key");
    if (e.status === 429) return new AiError("Gemini 사용 한도 초과입니다(429). 잠시 뒤 다시 시도하세요.", "rate_limit");
    if (e.status === 404) return new AiError(`Gemini 모델을 찾을 수 없습니다: ${e.message}`, "no_model");
    return new AiError(`Gemini 오류(${e.status}): ${e.message}`, "api");
  }
  return new AiError(`Gemini 호출 실패: ${e instanceof Error ? e.message : String(e)}`, "api");
}

/** Gemini 는 JSON 스키마 일부만 받는다. OpenAI strict 모드용 additionalProperties 는 뺀다 */
function stripAdditionalProperties(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripAdditionalProperties);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => k !== "additionalProperties")
        .map(([k, x]) => [k, stripAdditionalProperties(x)]),
    );
  }
  return v;
}

/**
 * ScannedConnection → LlmConnectionPayload 변환
 *
 * _treatAs → LLMAdapter 매핑:
 *   chat_openai, llm_openai          → openai
 *   chat_solar, chat_vllm            → openai (OpenAI-compatible)
 *   openai_image_generations         → openai
 *   chat_vertexai_gemini             → google-vertex-ai
 *   llm_hancom, chat_hyperclova,
 *   chat_gauss                       → 미지원 (skip)
 */

import type {
  LangfuseAdapter,
  LlmConnectionPayload,
  ScannedConnection,
} from "./types";

const ADAPTER_MAP: Record<string, LangfuseAdapter> = {
  chat_openai: "openai",
  llm_openai: "openai",
  chat_solar: "openai",
  chat_vllm: "openai",
  openai_image_generations: "openai",
  chat_vertexai_gemini: "google-vertex-ai",
};

const UNSUPPORTED_ADAPTERS = new Set([
  "llm_hancom",
  "chat_hyperclova",
  "chat_gauss",
]);

/**
 * OpenAI SDK는 baseURL에 `/chat/completions`를 이어 붙이므로,
 * vLLM 등 OpenAI-compatible 서버는 `/v1`이 포함된 URL이 필요합니다.
 *
 * 예: http://10.10.230.56:9984/ → http://10.10.230.56:9984/v1
 *     https://api.openai.com/   → https://api.openai.com/v1 (이미 /v1 경로가 있으면 유지)
 */
function normalizeOpenAIBaseURL(url: string, adapter: string): string {
  if (adapter !== "openai") return url;

  // 이미 /v1으로 끝나면 그대로
  if (url.replace(/\/+$/, "").endsWith("/v1")) return url;

  // api.openai.com은 /v1 자동 추가
  // 사내 서버(IP 기반)나 기타 OpenAI-compatible 서버도 /v1 추가
  const trimmed = url.replace(/\/+$/, "");
  return `${trimmed}/v1`;
}

function getDisplaySecretKey(secretKey: string): string {
  if (!secretKey || secretKey.startsWith("$")) {
    return secretKey || "(empty)";
  }
  return "..." + secretKey.slice(-4);
}

export function transformConnections(scanned: ScannedConnection[]): {
  payloads: LlmConnectionPayload[];
  skipped: Array<{ modelId: string; reason: string }>;
} {
  const payloads: LlmConnectionPayload[] = [];
  const skipped: Array<{ modelId: string; reason: string }> = [];

  for (const { modelId, source } of scanned) {
    const treatAs = source._treatAs;

    // 미지원 adapter
    if (UNSUPPORTED_ADAPTERS.has(treatAs)) {
      skipped.push({
        modelId,
        reason: `미지원 adapter: ${treatAs} (litellm 등 외부 router 필요)`,
      });
      continue;
    }

    const adapter = ADAPTER_MAP[treatAs];
    if (!adapter) {
      skipped.push({ modelId, reason: `알 수 없는 _treatAs: ${treatAs}` });
      continue;
    }

    const { llmConfig } = source;

    // Vertex AI: config에 projectId, location 포함
    let config: Record<string, unknown> | null = null;
    if (adapter === "google-vertex-ai") {
      config = {
        projectId: llmConfig.projectId ?? "",
        region: llmConfig.location ?? "global",
      };
    }

    // secretKey 결정
    let secretKey = llmConfig.apiToken ?? "";

    // Vertex AI with serviceAccountJson
    if (adapter === "google-vertex-ai" && llmConfig.serviceAccountJson) {
      secretKey = llmConfig.serviceAccountJson;
    }

    payloads.push({
      provider: modelId,
      adapter,
      secretKey,
      displaySecretKey: getDisplaySecretKey(secretKey),
      baseURL: llmConfig.baseUrl
        ? normalizeOpenAIBaseURL(llmConfig.baseUrl, adapter)
        : null,
      customModels: [llmConfig.model],
      withDefaultModels: false,
      config,
    });
  }

  return { payloads, skipped };
}

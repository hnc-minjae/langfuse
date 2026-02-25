import { prisma } from "@langfuse/shared/src/db";
import { LLMAdapter, type ModelParams } from "@langfuse/shared/src/server";
import type { ModelOptions } from "../types";

interface ResolvedModelConnection {
  modelParams: ModelParams;
  llmConnection: {
    secretKey: string;
    extraHeaders?: string | null;
    baseURL?: string | null;
    config?: Record<string, string> | null;
  };
  timeout?: number | null;
}

/**
 * Resolves a ManagedModel's own connection fields (baseUrl, modelName, apiToken)
 * into the format expected by fetchLLMCompletion.
 *
 * Unlike the previous approach that looked up LlmApiKeys by brand,
 * this now reads connection info directly from the ManagedModel itself.
 *
 * - adapter: defaults to OpenAI (litellm unification planned)
 * - secretKey: ManagedModel.apiToken (already stored encrypted)
 * - baseURL: ManagedModel.baseUrl
 * - model: ManagedModel.modelName (actual API model name), falls back to modelId
 */
export async function resolveModelConnection(params: {
  managedModelId: string;
  projectId: string;
  modelOptions?: ModelOptions;
}): Promise<ResolvedModelConnection> {
  const { managedModelId, projectId, modelOptions } = params;

  // 1. Find the ManagedModel by modelId within the project
  const managedModel = await prisma.managedModel.findFirst({
    where: { projectId, modelId: managedModelId },
  });

  if (!managedModel) {
    throw new Error(
      `Managed model "${managedModelId}" not found in project "${projectId}"`,
    );
  }

  // 2. Build ModelParams
  // Use OpenAI adapter as default — most custom/self-hosted endpoints
  // expose OpenAI-compatible APIs. Will be replaced by litellm later.
  const modelParams: ModelParams = {
    provider: managedModel.brand,
    adapter: LLMAdapter.OpenAI,
    model: managedModel.modelName ?? managedModel.modelId,
    ...(modelOptions?.temperature !== undefined && {
      temperature: modelOptions.temperature,
    }),
    ...(modelOptions?.max_tokens !== undefined && {
      max_tokens: modelOptions.max_tokens,
    }),
    ...(modelOptions?.top_p !== undefined && { top_p: modelOptions.top_p }),
    ...(modelOptions?.maxReasoningTokens !== undefined && {
      maxReasoningTokens: modelOptions.maxReasoningTokens,
    }),
  };

  // 3. Build LLM connection info
  // apiToken is stored encrypted in DB — fetchLLMCompletion calls decrypt() internally
  const llmConnection = {
    secretKey: managedModel.apiToken ?? "",
    extraHeaders: null,
    baseURL: managedModel.baseUrl ?? null,
    config: null,
  };

  return {
    modelParams,
    llmConnection,
    timeout: managedModel.timeout,
  };
}

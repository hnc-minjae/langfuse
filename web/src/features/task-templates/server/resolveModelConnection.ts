import { prisma } from "@langfuse/shared/src/db";
import { LLMApiKeySchema } from "@langfuse/shared";
import { type LLMAdapter, type ModelParams } from "@langfuse/shared/src/server";
import type { ModelOptions } from "../types";

interface ResolvedModelConnection {
  modelParams: ModelParams;
  llmConnection: {
    secretKey: string;
    extraHeaders?: string | null;
    baseURL?: string | null;
    config?: Record<string, string> | null;
  };
}

/**
 * Resolves model connection by looking up LlmApiKeys via ManagedModel.brand.
 *
 * Flow:
 *   ManagedModel(modelId, brand) → LlmApiKeys(provider = brand)
 *   → adapter, secretKey, baseURL from LlmApiKeys
 *   → model name from ManagedModel.modelId
 */
export async function resolveModelConnection(params: {
  managedModelId: string;
  projectId: string;
  modelOptions?: ModelOptions;
}): Promise<ResolvedModelConnection> {
  const { managedModelId, projectId, modelOptions } = params;

  // 1. Find the ManagedModel
  const managedModel = await prisma.managedModel.findFirst({
    where: { projectId, modelId: managedModelId },
  });

  if (!managedModel) {
    throw new Error(
      `Managed model "${managedModelId}" not found in project "${projectId}"`,
    );
  }

  // 2. Find LlmApiKeys by brand → provider
  const llmApiKey = await prisma.llmApiKeys.findFirst({
    where: { projectId, provider: managedModel.brand },
  });

  if (!llmApiKey) {
    throw new Error(
      `No LLM API key found for provider "${managedModel.brand}" in project "${projectId}". ` +
        `Please add one in Project Settings > LLM API Keys.`,
    );
  }

  // 3. Parse and validate the API key
  const parsedKey = LLMApiKeySchema.safeParse(llmApiKey);
  if (!parsedKey.success) {
    throw new Error(
      `Invalid LLM API key configuration for "${managedModel.brand}": ${parsedKey.error.message}`,
    );
  }

  // 4. Build ModelParams — adapter comes from LlmApiKeys
  const modelParams: ModelParams = {
    provider: managedModel.brand,
    adapter: parsedKey.data.adapter as LLMAdapter,
    model: managedModel.modelId,
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

  // 5. Build LLM connection from LlmApiKeys
  const llmConnection = {
    secretKey: parsedKey.data.secretKey,
    extraHeaders: parsedKey.data.extraHeaders ?? null,
    baseURL: parsedKey.data.baseURL ?? null,
    config: (parsedKey.data.config as Record<string, string> | null) ?? null,
  };

  return { modelParams, llmConnection };
}

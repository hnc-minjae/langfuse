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
 * Resolves model connection by looking up LlmApiKeys via ManagedModel.modelId.
 *
 * provider:model = 1:1 매핑 방식:
 *   ManagedModel(modelId) → LlmApiKeys(provider = modelId)
 *   → adapter, secretKey, baseURL from LlmApiKeys
 *   → model name from LlmApiKeys.customModels[0] or ManagedModel.modelId
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

  // 2. Find LlmApiKeys by modelId → provider (1:1 mapping)
  const llmApiKey = await prisma.llmApiKeys.findFirst({
    where: { projectId, provider: managedModel.modelId },
  });

  if (!llmApiKey) {
    throw new Error(
      `No LLM API key found for provider "${managedModel.modelId}" in project "${projectId}". ` +
        `Please add an LLM Connection with provider="${managedModel.modelId}" in Project Settings > LLM API Keys.`,
    );
  }

  // 3. Parse and validate the API key
  const parsedKey = LLMApiKeySchema.safeParse(llmApiKey);
  if (!parsedKey.success) {
    throw new Error(
      `Invalid LLM API key configuration for "${managedModel.modelId}": ${parsedKey.error.message}`,
    );
  }

  // 4. Build ModelParams — adapter comes from LlmApiKeys
  //    model name: customModels[0] if set, otherwise modelId
  const modelName =
    parsedKey.data.customModels.length > 0
      ? parsedKey.data.customModels[0]
      : managedModel.modelId;

  const modelParams: ModelParams = {
    provider: managedModel.modelId,
    adapter: parsedKey.data.adapter as LLMAdapter,
    model: modelName,
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

import { prisma } from "@langfuse/shared/src/db";
import { LLMApiKeySchema } from "@langfuse/shared";
import { LLMAdapter, type ModelParams } from "@langfuse/shared/src/server";
import type { ModelOptions } from "../types";

const BRAND_TO_ADAPTER: Record<string, LLMAdapter> = {
  openai: LLMAdapter.OpenAI,
  anthropic: LLMAdapter.Anthropic,
  google: LLMAdapter.GoogleAIStudio,
  "google-ai-studio": LLMAdapter.GoogleAIStudio,
  "google-vertex-ai": LLMAdapter.VertexAI,
  azure: LLMAdapter.Azure,
  bedrock: LLMAdapter.Bedrock,
};

interface ResolvedModelConnection {
  modelParams: ModelParams;
  llmConnection: {
    secretKey: string;
    extraHeaders?: string | null;
    baseURL?: string | null;
    config?: Record<string, string> | null;
  };
}

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

  // 2. Determine adapter from capabilities or brand
  const capabilities = managedModel.capabilities as Record<
    string,
    unknown
  > | null;
  let adapter: LLMAdapter;

  if (
    capabilities?.preferredAdapter &&
    typeof capabilities.preferredAdapter === "string"
  ) {
    const preferredAdapter = capabilities.preferredAdapter as string;
    if (Object.values(LLMAdapter).includes(preferredAdapter as LLMAdapter)) {
      adapter = preferredAdapter as LLMAdapter;
    } else {
      throw new Error(
        `Unknown preferred adapter "${preferredAdapter}" in managed model capabilities`,
      );
    }
  } else {
    const brand = managedModel.brand.toLowerCase();
    adapter = BRAND_TO_ADAPTER[brand] ?? LLMAdapter.OpenAI;
  }

  // 3. Find matching LLM API key
  // Map adapter back to provider name for lookup
  const providerName = adapter === LLMAdapter.OpenAI ? "openai" : adapter;

  const llmApiKey = await prisma.llmApiKeys.findFirst({
    where: {
      projectId,
      OR: [
        { provider: managedModel.brand },
        { provider: managedModel.brand.toLowerCase() },
        { adapter: adapter },
        { provider: providerName },
      ],
    },
  });

  if (!llmApiKey) {
    throw new Error(
      `No LLM API key found for provider "${managedModel.brand}" in project "${projectId}". ` +
        `Please configure an API key for this provider.`,
    );
  }

  // 4. Parse and validate the API key
  const parsedKey = LLMApiKeySchema.safeParse(llmApiKey);
  if (!parsedKey.success) {
    throw new Error(
      `Invalid LLM API key configuration: ${parsedKey.error.message}`,
    );
  }

  // 5. Build ModelParams
  const modelParams: ModelParams = {
    provider: parsedKey.data.provider,
    adapter: parsedKey.data.adapter,
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

  // 6. Build LLM connection info
  const llmConnection = {
    secretKey: parsedKey.data.secretKey,
    extraHeaders: parsedKey.data.extraHeaders,
    baseURL: parsedKey.data.baseURL,
    config: parsedKey.data.config as Record<string, string> | null,
  };

  return { modelParams, llmConnection };
}

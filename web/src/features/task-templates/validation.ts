import { z } from "zod/v4";

// ── Prompt Config Schemas ─────────────────────────────────

export const FewShotExampleSchema = z.object({
  input: z.string(),
  output: z.string(),
});

export const ChatPromptConfigSchema = z.object({
  systemMessage: z.string(),
  userMessage: z.string().min(1, "User message is required"),
  inputVariables: z.array(z.string()),
});

export const GeneralPromptConfigSchema = z.object({
  instruction: z.string().min(1, "Instruction is required"),
  context: z.string().optional(),
  inputVariables: z.array(z.string()),
  examples: z.array(FewShotExampleSchema).optional(),
});

export const PromptConfigSchema = z.union([
  ChatPromptConfigSchema,
  GeneralPromptConfigSchema,
]);

// ── Model Options Schema ──────────────────────────────────

export const ModelOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  maxReasoningTokens: z.number().int().positive().optional(),
});

// ── Task Template Type Schema ─────────────────────────────

export const TaskTemplateTypeSchema = z.enum(["chat", "general"]);

// ── tRPC Input Schemas ────────────────────────────────────

export const CreateTaskTemplateInput = z.object({
  projectId: z.string(),
  name: z.string().min(1, "Name is required"),
  type: TaskTemplateTypeSchema.default("chat"),
  managedModelId: z.string().min(1, "Managed model ID is required"),
  modelOptions: ModelOptionsSchema.optional(),
  promptConfig: z.record(z.string(), z.unknown()),
  inputForms: z.record(z.string(), z.unknown()).optional(),
  outputKey: z.string().default("text"),
  labels: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  commitMessage: z.string().optional(),
});

export const UpdateTaskTemplateInput = z.object({
  id: z.string(),
  projectId: z.string(),
  managedModelId: z.string().min(1, "Managed model ID is required"),
  modelOptions: ModelOptionsSchema.optional(),
  promptConfig: z.record(z.string(), z.unknown()),
  inputForms: z.record(z.string(), z.unknown()).optional(),
  outputKey: z.string().optional(),
  labels: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  commitMessage: z.string().optional(),
});

export const DeleteTaskTemplateInput = z.object({
  id: z.string(),
  projectId: z.string(),
});

export const GetAllTaskTemplatesInput = z.object({
  projectId: z.string(),
  page: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
  searchQuery: z.string().optional(),
  typeFilter: z.string().optional(),
  nameFilter: z.string().optional(),
});

export const ExecuteTaskTemplateInput = z.object({
  id: z.string(),
  projectId: z.string(),
  inputs: z.record(z.string(), z.string()),
});

// ── Prompt Config Validation Helper ────────────────────────

export function validatePromptConfig(params: {
  type: string;
  promptConfig: Record<string, unknown>;
}): { success: true } | { success: false; error: string } {
  const { type, promptConfig } = params;

  if (type === "chat") {
    const result = ChatPromptConfigSchema.safeParse(promptConfig);
    if (!result.success) {
      return {
        success: false,
        error: `Invalid chat prompt config: ${result.error.message}`,
      };
    }
  } else if (type === "general") {
    const result = GeneralPromptConfigSchema.safeParse(promptConfig);
    if (!result.success) {
      return {
        success: false,
        error: `Invalid general prompt config: ${result.error.message}`,
      };
    }
  } else {
    return { success: false, error: `Unknown template type: ${type}` };
  }

  return { success: true };
}

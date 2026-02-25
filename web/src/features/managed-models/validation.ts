import { z } from "zod/v4";

export const ManagedModelInput = z.object({
  modelId: z.string().min(1, "Model ID is required"),
  displayName: z.string().min(1, "Display name is required"),
  brand: z.string().min(1, "Brand is required"),
  brandDisplayName: z.string().min(1, "Brand display name is required"),
  maxInputTokenSize: z.number().int().positive().nullish(),
  maxOutputTokenSize: z.number().int().positive().nullish(),
  contextWindowSize: z.number().int().positive().nullish(),
  isSupported: z.boolean(),
  sortOrder: z.number().int(),
  capabilities: z.record(z.string(), z.unknown()).nullish(),
  baseUrl: z.string().nullish(),
  modelName: z.string().nullish(),
  apiToken: z.string().nullish(),
  timeout: z.number().int().positive().nullish(),
});

export const CreateManagedModelInput = ManagedModelInput.extend({
  projectId: z.string(),
});

export const UpdateManagedModelInput = ManagedModelInput.extend({
  id: z.string(),
  projectId: z.string(),
});

export const DeleteManagedModelInput = z.object({
  id: z.string(),
  projectId: z.string(),
});

export const GetAllManagedModelsInput = z.object({
  projectId: z.string(),
  page: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
  searchQuery: z.string().optional(),
  brandFilter: z.string().optional(),
});

export const BulkUpsertManagedModelsInput = z.object({
  projectId: z.string(),
  models: z.array(ManagedModelInput),
});

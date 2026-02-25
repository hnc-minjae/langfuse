import { z } from "zod/v4";
import {
  publicApiPaginationZod,
  paginationMetaResponseZod,
} from "@langfuse/shared";

// ── Objects ──────────────────────────────────────────────────

const APIManagedModel = z.object({
  id: z.string(),
  projectId: z.string(),
  modelId: z.string(),
  displayName: z.string(),
  brand: z.string(),
  brandDisplayName: z.string(),
  maxInputTokenSize: z.number().int().nullable(),
  maxOutputTokenSize: z.number().int().nullable(),
  contextWindowSize: z.number().int().nullable(),
  isSupported: z.boolean(),
  sortOrder: z.number().int(),
  capabilities: z.any().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ── GET /managed-models ─────────────────────────────────────

export const GetManagedModelsQuery = z.object({
  ...publicApiPaginationZod,
  searchQuery: z.string().optional(),
  brandFilter: z.string().optional(),
});

export const GetManagedModelsResponse = z
  .object({
    data: z.array(APIManagedModel),
    meta: paginationMetaResponseZod,
  })
  .strict();

// ── POST /managed-models ────────────────────────────────────

export const PostManagedModelBody = z
  .object({
    modelId: z.string().min(1),
    displayName: z.string().min(1),
    brand: z.string().min(1),
    brandDisplayName: z.string().min(1),
    maxInputTokenSize: z.number().int().positive().nullish(),
    maxOutputTokenSize: z.number().int().positive().nullish(),
    contextWindowSize: z.number().int().positive().nullish(),
    isSupported: z.boolean(),
    sortOrder: z.number().int(),
    capabilities: z.record(z.string(), z.unknown()).nullish(),
  })
  .strict();

export const PostManagedModelResponse = APIManagedModel.strict();

// ── GET /managed-models/[id] ────────────────────────────────

export const GetManagedModelByIdQuery = z.object({
  id: z.string(),
});

export const GetManagedModelByIdResponse = APIManagedModel.strict();

// ── PUT /managed-models/[id] ────────────────────────────────

export const PutManagedModelQuery = z.object({
  id: z.string(),
});

export const PutManagedModelBody = PostManagedModelBody;

export const PutManagedModelResponse = APIManagedModel.strict();

// ── DELETE /managed-models/[id] ─────────────────────────────

export const DeleteManagedModelQuery = z.object({
  id: z.string(),
});

export const DeleteManagedModelResponse = z
  .object({
    message: z.literal("Managed model successfully deleted"),
  })
  .strict();

// ── POST /managed-models/bulk ───────────────────────────────

export const PostBulkManagedModelsBody = z
  .object({
    models: z.array(
      z.object({
        modelId: z.string().min(1),
        displayName: z.string().min(1),
        brand: z.string().min(1),
        brandDisplayName: z.string().min(1),
        maxInputTokenSize: z.number().int().positive().nullish(),
        maxOutputTokenSize: z.number().int().positive().nullish(),
        contextWindowSize: z.number().int().positive().nullish(),
        isSupported: z.boolean(),
        sortOrder: z.number().int(),
        capabilities: z.record(z.string(), z.unknown()).nullish(),
      }),
    ),
  })
  .strict();

export const PostBulkManagedModelsResponse = z
  .object({
    count: z.number().int().nonnegative(),
  })
  .strict();

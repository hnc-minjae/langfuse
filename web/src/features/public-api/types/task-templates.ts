import { z } from "zod/v4";
import {
  publicApiPaginationZod,
  paginationMetaResponseZod,
} from "@langfuse/shared";

// ── Objects ──────────────────────────────────────────────────

const APITaskTemplate = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  version: z.number().int(),
  type: z.string(),
  managedModelId: z.string(),
  modelOptions: z.any().nullable(),
  promptConfig: z.any(),
  inputForms: z.any().nullable(),
  tasks: z.any().nullable(),
  interval: z.number().int().nullable(),
  outputKey: z.string(),
  labels: z.array(z.string()),
  tags: z.array(z.string()),
  commitMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ── GET /task-templates ─────────────────────────────────────

export const GetTaskTemplatesQuery = z.object({
  ...publicApiPaginationZod,
  searchQuery: z.string().optional(),
  typeFilter: z.string().optional(),
  nameFilter: z.string().optional(),
});

export const GetTaskTemplatesResponse = z
  .object({
    data: z.array(APITaskTemplate),
    meta: paginationMetaResponseZod,
  })
  .strict();

// ── POST /task-templates ────────────────────────────────────

export const PostTaskTemplateBody = z
  .object({
    name: z.string().min(1),
    type: z.enum(["chat", "general", "sequential", "multiple"]).default("chat"),
    managedModelId: z.string().min(1),
    modelOptions: z
      .object({
        temperature: z.number().min(0).max(2).optional(),
        max_tokens: z.number().int().positive().optional(),
        top_p: z.number().min(0).max(1).optional(),
        maxReasoningTokens: z.number().int().positive().optional(),
      })
      .optional(),
    promptConfig: z.record(z.string(), z.unknown()),
    inputForms: z.record(z.string(), z.unknown()).optional(),
    tasks: z.array(z.record(z.string(), z.unknown())).optional(),
    interval: z.number().int().min(0).optional(),
    outputKey: z.string().default("text"),
    labels: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    commitMessage: z.string().optional(),
  })
  .strict();

export const PostTaskTemplateResponse = APITaskTemplate.strict();

// ── GET /task-templates/[id] ────────────────────────────────

export const GetTaskTemplateByIdQuery = z.object({
  id: z.string(),
});

export const GetTaskTemplateByIdResponse = APITaskTemplate.strict();

// ── PUT /task-templates/[id] ────────────────────────────────

export const PutTaskTemplateQuery = z.object({
  id: z.string(),
});

export const PutTaskTemplateBody = z
  .object({
    managedModelId: z.string().min(1),
    modelOptions: z
      .object({
        temperature: z.number().min(0).max(2).optional(),
        max_tokens: z.number().int().positive().optional(),
        top_p: z.number().min(0).max(1).optional(),
        maxReasoningTokens: z.number().int().positive().optional(),
      })
      .optional(),
    promptConfig: z.record(z.string(), z.unknown()),
    inputForms: z.record(z.string(), z.unknown()).optional(),
    tasks: z.array(z.record(z.string(), z.unknown())).optional(),
    interval: z.number().int().min(0).optional(),
    outputKey: z.string().optional(),
    labels: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    commitMessage: z.string().optional(),
  })
  .strict();

export const PutTaskTemplateResponse = APITaskTemplate.strict();

// ── DELETE /task-templates/[id] ─────────────────────────────

export const DeleteTaskTemplateQuery = z.object({
  id: z.string(),
});

export const DeleteTaskTemplateResponse = z
  .object({
    message: z.literal("Task template successfully deleted"),
  })
  .strict();

// ── POST /task-templates/[id]/execute ───────────────────────

export const ExecuteTaskTemplateQuery = z.object({
  id: z.string(),
});

export const ExecuteTaskTemplateBody = z
  .object({
    inputs: z.record(z.string(), z.string()),
  })
  .strict();

export const ExecuteTaskTemplateResponse = z
  .object({
    success: z.boolean(),
    text: z.string().optional(),
    latencyMs: z.number(),
  })
  .passthrough();

// ── POST /task-templates/[id]/stream ────────────────────────

export const StreamTaskTemplateQuery = z.object({
  id: z.string(),
});

export const StreamTaskTemplateBody = z
  .object({
    inputs: z.record(z.string(), z.string()),
  })
  .strict();

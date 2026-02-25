import { z } from "zod/v4";
import {
  publicApiPaginationZod,
  paginationMetaResponseZod,
} from "@langfuse/shared";

// ── Objects ──────────────────────────────────────────────────

const APIMenuTemplate = z.object({
  id: z.string(),
  orgId: z.string(),
  product: z.string(),
  version: z.number().int(),
  content: z.any(),
  labels: z.array(z.string()),
  commitMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const APIMenuTemplateProduct = z
  .object({
    product: z.string(),
    latestVersion: z.number().int(),
    versionCount: z.number().int(),
    labels: z.array(z.string()),
  })
  .strict();

const APIMenuTemplateVersion = z
  .object({
    id: z.string(),
    version: z.number().int(),
    labels: z.array(z.string()),
    commitMessage: z.string().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .strict();

// ── GET /menu-templates/products ────────────────────────────

export const GetMenuTemplateProductsResponse = z
  .object({
    data: z.array(APIMenuTemplateProduct),
  })
  .strict();

// ── GET /menu-templates/products/[product]/versions ─────────

export const GetMenuTemplateVersionsQuery = z.object({
  product: z.string(),
  ...publicApiPaginationZod,
});

export const GetMenuTemplateVersionsResponse = z
  .object({
    data: z.array(APIMenuTemplateVersion),
    meta: paginationMetaResponseZod,
  })
  .strict();

// ── GET /menu-templates/[id] ────────────────────────────────

export const GetMenuTemplateByIdQuery = z.object({
  id: z.string(),
});

export const GetMenuTemplateByIdResponse = APIMenuTemplate.strict();

// ── POST /menu-templates ────────────────────────────────────

export const PostMenuTemplateBody = z
  .object({
    product: z.string().min(1),
    content: z.record(z.string(), z.unknown()),
    labels: z.array(z.string()).optional(),
    commitMessage: z.string().optional(),
  })
  .strict();

export const PostMenuTemplateResponse = APIMenuTemplate.strict();

// ── PATCH /menu-templates/[id]/labels ───────────────────────

export const PatchMenuTemplateLabelsQuery = z.object({
  id: z.string(),
});

export const PatchMenuTemplateLabelsBody = z
  .object({
    labels: z.array(z.string()),
  })
  .strict();

export const PatchMenuTemplateLabelsResponse = APIMenuTemplate.strict();

// ── DELETE /menu-templates/[id] ─────────────────────────────

export const DeleteMenuTemplateQuery = z.object({
  id: z.string(),
});

export const DeleteMenuTemplateResponse = z
  .object({
    message: z.literal("Menu template successfully deleted"),
  })
  .strict();

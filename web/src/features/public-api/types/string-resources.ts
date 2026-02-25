import { z } from "zod/v4";
import {
  publicApiPaginationZod,
  paginationMetaResponseZod,
} from "@langfuse/shared";

// ── Objects ──────────────────────────────────────────────────

const APIStringResource = z
  .object({
    id: z.string(),
    orgId: z.string(),
    category: z.string(),
    key: z.string(),
    locale: z.string(),
    value: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .strict();

// ── GET /string-resources ───────────────────────────────────

export const GetStringResourcesQuery = z.object({
  ...publicApiPaginationZod,
  searchQuery: z.string().optional(),
  categoryFilter: z.string().optional(),
  localeFilter: z.string().optional(),
});

export const GetStringResourcesResponse = z
  .object({
    data: z.array(APIStringResource),
    meta: paginationMetaResponseZod,
  })
  .strict();

// ── GET /string-resources/categories ────────────────────────

export const GetStringResourceCategoriesResponse = z
  .object({
    data: z.array(z.string()),
  })
  .strict();

// ── GET /string-resources/locales ───────────────────────────

export const GetStringResourceLocalesResponse = z
  .object({
    data: z.array(z.string()),
  })
  .strict();

// ── POST /string-resources ──────────────────────────────────

export const PostStringResourceBody = z
  .object({
    category: z.string().min(1),
    key: z.string().min(1),
    locale: z.string().min(1),
    value: z.string(),
  })
  .strict();

export const PostStringResourceResponse = APIStringResource.strict();

// ── GET /string-resources/[id] ──────────────────────────────

export const GetStringResourceByIdQuery = z.object({
  id: z.string(),
});

export const GetStringResourceByIdResponse = APIStringResource.strict();

// ── PUT /string-resources/[id] ──────────────────────────────

export const PutStringResourceQuery = z.object({
  id: z.string(),
});

export const PutStringResourceBody = z
  .object({
    value: z.string(),
  })
  .strict();

export const PutStringResourceResponse = APIStringResource.strict();

// ── DELETE /string-resources/[id] ───────────────────────────

export const DeleteStringResourceQuery = z.object({
  id: z.string(),
});

export const DeleteStringResourceResponse = z
  .object({
    message: z.literal("String resource successfully deleted"),
  })
  .strict();

// ── POST /string-resources/bulk ─────────────────────────────

export const PostBulkStringResourcesBody = z
  .object({
    resources: z.array(
      z.object({
        category: z.string().min(1),
        key: z.string().min(1),
        locale: z.string().min(1),
        value: z.string(),
      }),
    ),
  })
  .strict();

export const PostBulkStringResourcesResponse = z
  .object({
    count: z.number().int().nonnegative(),
  })
  .strict();

import { z } from "zod/v4";
import {
  publicApiPaginationZod,
  paginationMetaResponseZod,
} from "@langfuse/shared";

// ── Objects ──────────────────────────────────────────────────

const APIDrawableResourceMeta = z
  .object({
    id: z.string(),
    orgId: z.string(),
    filename: z.string(),
    locale: z.string(),
    contentType: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .strict();

const APIDrawableResource = APIDrawableResourceMeta.extend({
  content: z.string(),
}).strict();

// ── GET /drawable-resources ─────────────────────────────────

export const GetDrawableResourcesQuery = z.object({
  ...publicApiPaginationZod,
  localeFilter: z.string().optional(),
});

export const GetDrawableResourcesResponse = z
  .object({
    data: z.array(APIDrawableResourceMeta),
    meta: paginationMetaResponseZod,
  })
  .strict();

// ── GET /drawable-resources/locales ─────────────────────────

export const GetDrawableResourceLocalesResponse = z
  .object({
    data: z.array(z.string()),
  })
  .strict();

// ── GET /drawable-resources/[id] ────────────────────────────

export const GetDrawableResourceByIdQuery = z.object({
  id: z.string(),
});

export const GetDrawableResourceByIdResponse = APIDrawableResource.strict();

// ── POST /drawable-resources ────────────────────────────────

export const PostDrawableResourceBody = z
  .object({
    filename: z.string().min(1),
    locale: z.string().min(1),
    contentType: z.string().min(1),
    content: z.string().min(1),
  })
  .strict();

export const PostDrawableResourceResponse = APIDrawableResource.strict();

// ── PUT /drawable-resources/[id] ────────────────────────────

export const PutDrawableResourceQuery = z.object({
  id: z.string(),
});

export const PutDrawableResourceBody = z
  .object({
    contentType: z.string().min(1),
    content: z.string().min(1),
  })
  .strict();

export const PutDrawableResourceResponse = APIDrawableResource.strict();

// ── DELETE /drawable-resources/[id] ─────────────────────────

export const DeleteDrawableResourceQuery = z.object({
  id: z.string(),
});

export const DeleteDrawableResourceResponse = z
  .object({
    message: z.literal("Drawable resource successfully deleted"),
  })
  .strict();

// ── POST /drawable-resources/bulk ───────────────────────────

export const PostBulkDrawableResourcesBody = z
  .object({
    resources: z.array(
      z.object({
        filename: z.string().min(1),
        locale: z.string().min(1),
        contentType: z.string().min(1),
        content: z.string().min(1),
      }),
    ),
  })
  .strict();

export const PostBulkDrawableResourcesResponse = z
  .object({
    count: z.number().int().nonnegative(),
  })
  .strict();

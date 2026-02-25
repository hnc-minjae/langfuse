import { z } from "zod/v4";

// ── MenuTemplate ──────────────────────────────────────────────

export const GetAllMenuTemplateProductsInput = z.object({
  orgId: z.string(),
});

export const GetMenuTemplateVersionsInput = z.object({
  orgId: z.string(),
  product: z.string(),
  page: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
});

export const GetMenuTemplateByIdInput = z.object({
  orgId: z.string(),
  id: z.string(),
});

export const CreateMenuTemplateInput = z.object({
  orgId: z.string(),
  product: z.string().min(1, "Product is required"),
  content: z.record(z.string(), z.unknown()),
  labels: z.array(z.string()).optional(),
  commitMessage: z.string().optional(),
});

export const UpdateMenuTemplateLabelsInput = z.object({
  orgId: z.string(),
  id: z.string(),
  labels: z.array(z.string()),
});

export const DeleteMenuTemplateInput = z.object({
  orgId: z.string(),
  id: z.string(),
});

// ── StringResource ────────────────────────────────────────────

export const GetAllStringResourcesInput = z.object({
  orgId: z.string(),
  page: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
  searchQuery: z.string().optional(),
  categoryFilter: z.string().optional(),
  localeFilter: z.string().optional(),
});

export const GetStringResourceCategoriesInput = z.object({
  orgId: z.string(),
});

export const GetStringResourceLocalesInput = z.object({
  orgId: z.string(),
});

export const CreateStringResourceInput = z.object({
  orgId: z.string(),
  category: z.string().min(1, "Category is required"),
  key: z.string().min(1, "Key is required"),
  locale: z.string().min(1, "Locale is required"),
  value: z.string(),
});

export const UpdateStringResourceInput = z.object({
  orgId: z.string(),
  id: z.string(),
  value: z.string(),
});

export const DeleteStringResourceInput = z.object({
  orgId: z.string(),
  id: z.string(),
});

export const BulkUpsertStringResourcesInput = z.object({
  orgId: z.string(),
  resources: z.array(
    z.object({
      category: z.string().min(1),
      key: z.string().min(1),
      locale: z.string().min(1),
      value: z.string(),
    }),
  ),
});

// ── DrawableResource ──────────────────────────────────────────

export const GetAllDrawableResourcesInput = z.object({
  orgId: z.string(),
  page: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
  localeFilter: z.string().optional(),
});

export const GetDrawableResourceByIdInput = z.object({
  orgId: z.string(),
  id: z.string(),
});

export const GetDrawableResourceLocalesInput = z.object({
  orgId: z.string(),
});

export const CreateDrawableResourceInput = z.object({
  orgId: z.string(),
  filename: z.string().min(1, "Filename is required"),
  locale: z.string().min(1, "Locale is required"),
  contentType: z.string().min(1, "Content type is required"),
  content: z.string().min(1, "Content is required"),
});

export const UpdateDrawableResourceInput = z.object({
  orgId: z.string(),
  id: z.string(),
  contentType: z.string().min(1),
  content: z.string().min(1),
});

export const DeleteDrawableResourceInput = z.object({
  orgId: z.string(),
  id: z.string(),
});

export const BulkUpsertDrawableResourcesInput = z.object({
  orgId: z.string(),
  resources: z.array(
    z.object({
      filename: z.string().min(1),
      locale: z.string().min(1),
      contentType: z.string().min(1),
      content: z.string().min(1),
    }),
  ),
});

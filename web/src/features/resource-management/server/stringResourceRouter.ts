import { type Prisma } from "@langfuse/shared";
import {
  createTRPCRouter,
  protectedOrganizationProcedure,
} from "@/src/server/api/trpc";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { TRPCError } from "@trpc/server";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import { logger } from "@langfuse/shared/src/server";
import {
  GetAllStringResourcesInput,
  GetStringResourceCategoriesInput,
  GetStringResourceLocalesInput,
  CreateStringResourceInput,
  UpdateStringResourceInput,
  DeleteStringResourceInput,
  BulkUpsertStringResourcesInput,
} from "../validation";

export const stringResourceRouter = createTRPCRouter({
  getAll: protectedOrganizationProcedure
    .input(GetAllStringResourcesInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        const where: Prisma.StringResourceWhereInput = {
          orgId: input.orgId,
          ...(input.searchQuery
            ? {
                OR: [
                  {
                    key: {
                      contains: input.searchQuery,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    value: {
                      contains: input.searchQuery,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
          ...(input.categoryFilter ? { category: input.categoryFilter } : {}),
          ...(input.localeFilter ? { locale: input.localeFilter } : {}),
        };

        const [resources, totalCount] = await Promise.all([
          ctx.prisma.stringResource.findMany({
            where,
            orderBy: [{ category: "asc" }, { key: "asc" }, { locale: "asc" }],
            skip: input.page * input.limit,
            take: input.limit,
          }),
          ctx.prisma.stringResource.count({ where }),
        ]);

        return { resources, totalCount };
      } catch (error) {
        logger.error("Failed to get string resources", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching string resources failed",
        });
      }
    }),

  getCategories: protectedOrganizationProcedure
    .input(GetStringResourceCategoriesInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        const result = await ctx.prisma.stringResource.findMany({
          where: { orgId: input.orgId },
          select: { category: true },
          distinct: ["category"],
          orderBy: { category: "asc" },
        });

        return result.map((r) => r.category);
      } catch (error) {
        logger.error("Failed to get string resource categories", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching categories failed",
        });
      }
    }),

  getLocales: protectedOrganizationProcedure
    .input(GetStringResourceLocalesInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        const result = await ctx.prisma.stringResource.findMany({
          where: { orgId: input.orgId },
          select: { locale: true },
          distinct: ["locale"],
          orderBy: { locale: "asc" },
        });

        return result.map((r) => r.locale);
      } catch (error) {
        logger.error("Failed to get string resource locales", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching locales failed",
        });
      }
    }),

  create: protectedOrganizationProcedure
    .input(CreateStringResourceInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const existing = await ctx.prisma.stringResource.findUnique({
          where: {
            orgId_category_key_locale: {
              orgId: input.orgId,
              category: input.category,
              key: input.key,
              locale: input.locale,
            },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `String resource with key "${input.key}" already exists for category "${input.category}" and locale "${input.locale}"`,
          });
        }

        const resource = await ctx.prisma.stringResource.create({
          data: {
            orgId: input.orgId,
            category: input.category,
            key: input.key,
            locale: input.locale,
            value: input.value,
          },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "stringResource",
          resourceId: resource.id,
          action: "create",
          after: resource,
        });

        return resource;
      } catch (error) {
        logger.error("Failed to create string resource", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Creating string resource failed",
        });
      }
    }),

  update: protectedOrganizationProcedure
    .input(UpdateStringResourceInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const existing = await ctx.prisma.stringResource.findUnique({
          where: { id: input.id, orgId: input.orgId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "String resource not found",
          });
        }

        const updated = await ctx.prisma.stringResource.update({
          where: { id: input.id, orgId: input.orgId },
          data: { value: input.value },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "stringResource",
          resourceId: updated.id,
          action: "update",
          before: existing,
          after: updated,
        });

        return updated;
      } catch (error) {
        logger.error("Failed to update string resource", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Updating string resource failed",
        });
      }
    }),

  delete: protectedOrganizationProcedure
    .input(DeleteStringResourceInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const existing = await ctx.prisma.stringResource.findUnique({
          where: { id: input.id, orgId: input.orgId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "String resource not found",
          });
        }

        await ctx.prisma.stringResource.delete({
          where: { id: input.id, orgId: input.orgId },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "stringResource",
          resourceId: input.id,
          action: "delete",
          before: existing,
        });

        return { success: true };
      } catch (error) {
        logger.error("Failed to delete string resource", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Deleting string resource failed",
        });
      }
    }),

  bulkUpsert: protectedOrganizationProcedure
    .input(BulkUpsertStringResourcesInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        // Process in batches of 500
        const batchSize = 500;
        let totalCount = 0;

        for (let i = 0; i < input.resources.length; i += batchSize) {
          const batch = input.resources.slice(i, i + batchSize);
          const results = await ctx.prisma.$transaction(
            batch.map((resource) =>
              ctx.prisma.stringResource.upsert({
                where: {
                  orgId_category_key_locale: {
                    orgId: input.orgId,
                    category: resource.category,
                    key: resource.key,
                    locale: resource.locale,
                  },
                },
                create: {
                  orgId: input.orgId,
                  category: resource.category,
                  key: resource.key,
                  locale: resource.locale,
                  value: resource.value,
                },
                update: {
                  value: resource.value,
                },
              }),
            ),
          );
          totalCount += results.length;
        }

        await auditLog({
          session: ctx.session,
          resourceType: "stringResource",
          resourceId: "bulk",
          action: "create",
          after: { count: totalCount },
        });

        return { count: totalCount };
      } catch (error) {
        logger.error("Failed to bulk upsert string resources", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Bulk upserting string resources failed",
        });
      }
    }),
});

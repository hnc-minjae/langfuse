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
  GetAllDrawableResourcesInput,
  GetDrawableResourceByIdInput,
  GetDrawableResourceLocalesInput,
  CreateDrawableResourceInput,
  UpdateDrawableResourceInput,
  DeleteDrawableResourceInput,
  BulkUpsertDrawableResourcesInput,
} from "../validation";

export const drawableResourceRouter = createTRPCRouter({
  getAll: protectedOrganizationProcedure
    .input(GetAllDrawableResourcesInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        const where: Prisma.DrawableResourceWhereInput = {
          orgId: input.orgId,
          ...(input.localeFilter ? { locale: input.localeFilter } : {}),
        };

        const [resources, totalCount] = await Promise.all([
          ctx.prisma.drawableResource.findMany({
            where,
            select: {
              id: true,
              filename: true,
              locale: true,
              contentType: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: [{ locale: "asc" }, { filename: "asc" }],
            skip: input.page * input.limit,
            take: input.limit,
          }),
          ctx.prisma.drawableResource.count({ where }),
        ]);

        return { resources, totalCount };
      } catch (error) {
        logger.error("Failed to get drawable resources", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching drawable resources failed",
        });
      }
    }),

  getById: protectedOrganizationProcedure
    .input(GetDrawableResourceByIdInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        const resource = await ctx.prisma.drawableResource.findUnique({
          where: { id: input.id, orgId: input.orgId },
        });

        if (!resource) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Drawable resource not found",
          });
        }

        return resource;
      } catch (error) {
        logger.error("Failed to get drawable resource", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching drawable resource failed",
        });
      }
    }),

  getLocales: protectedOrganizationProcedure
    .input(GetDrawableResourceLocalesInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        const result = await ctx.prisma.drawableResource.findMany({
          where: { orgId: input.orgId },
          select: { locale: true },
          distinct: ["locale"],
          orderBy: { locale: "asc" },
        });

        return result.map((r) => r.locale);
      } catch (error) {
        logger.error("Failed to get drawable resource locales", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching drawable locales failed",
        });
      }
    }),

  create: protectedOrganizationProcedure
    .input(CreateDrawableResourceInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const existing = await ctx.prisma.drawableResource.findUnique({
          where: {
            orgId_filename_locale: {
              orgId: input.orgId,
              filename: input.filename,
              locale: input.locale,
            },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Drawable resource "${input.filename}" already exists for locale "${input.locale}"`,
          });
        }

        const resource = await ctx.prisma.drawableResource.create({
          data: {
            orgId: input.orgId,
            filename: input.filename,
            locale: input.locale,
            contentType: input.contentType,
            content: input.content,
          },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "drawableResource",
          resourceId: resource.id,
          action: "create",
          after: { id: resource.id, filename: resource.filename },
        });

        return resource;
      } catch (error) {
        logger.error("Failed to create drawable resource", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Creating drawable resource failed",
        });
      }
    }),

  update: protectedOrganizationProcedure
    .input(UpdateDrawableResourceInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const existing = await ctx.prisma.drawableResource.findUnique({
          where: { id: input.id, orgId: input.orgId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Drawable resource not found",
          });
        }

        const updated = await ctx.prisma.drawableResource.update({
          where: { id: input.id, orgId: input.orgId },
          data: {
            contentType: input.contentType,
            content: input.content,
          },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "drawableResource",
          resourceId: updated.id,
          action: "update",
          before: { id: existing.id, filename: existing.filename },
          after: { id: updated.id, filename: updated.filename },
        });

        return updated;
      } catch (error) {
        logger.error("Failed to update drawable resource", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Updating drawable resource failed",
        });
      }
    }),

  delete: protectedOrganizationProcedure
    .input(DeleteDrawableResourceInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const existing = await ctx.prisma.drawableResource.findUnique({
          where: { id: input.id, orgId: input.orgId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Drawable resource not found",
          });
        }

        await ctx.prisma.drawableResource.delete({
          where: { id: input.id, orgId: input.orgId },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "drawableResource",
          resourceId: input.id,
          action: "delete",
          before: { id: existing.id, filename: existing.filename },
        });

        return { success: true };
      } catch (error) {
        logger.error("Failed to delete drawable resource", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Deleting drawable resource failed",
        });
      }
    }),

  bulkUpsert: protectedOrganizationProcedure
    .input(BulkUpsertDrawableResourcesInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const results = await ctx.prisma.$transaction(
          input.resources.map((resource) =>
            ctx.prisma.drawableResource.upsert({
              where: {
                orgId_filename_locale: {
                  orgId: input.orgId,
                  filename: resource.filename,
                  locale: resource.locale,
                },
              },
              create: {
                orgId: input.orgId,
                filename: resource.filename,
                locale: resource.locale,
                contentType: resource.contentType,
                content: resource.content,
              },
              update: {
                contentType: resource.contentType,
                content: resource.content,
              },
            }),
          ),
        );

        await auditLog({
          session: ctx.session,
          resourceType: "drawableResource",
          resourceId: "bulk",
          action: "create",
          after: { count: results.length },
        });

        return { count: results.length };
      } catch (error) {
        logger.error("Failed to bulk upsert drawable resources", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Bulk upserting drawable resources failed",
        });
      }
    }),
});

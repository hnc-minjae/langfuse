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
  GetAllMenuTemplateProductsInput,
  GetMenuTemplateVersionsInput,
  GetMenuTemplateByIdInput,
  CreateMenuTemplateInput,
  UpdateMenuTemplateLabelsInput,
  DeleteMenuTemplateInput,
} from "../validation";

export const menuTemplateRouter = createTRPCRouter({
  allProducts: protectedOrganizationProcedure
    .input(GetAllMenuTemplateProductsInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        // Get latest version info per product
        const products = await ctx.prisma.$queryRaw<
          Array<{
            product: string;
            latestVersion: number;
            versionCount: bigint;
            labels: string[];
          }>
        >`
          SELECT
            product,
            MAX(version) as "latestVersion",
            COUNT(*)::bigint as "versionCount",
            ARRAY(
              SELECT DISTINCT unnest(labels)
              FROM menu_templates mt2
              WHERE mt2.org_id = mt1.org_id AND mt2.product = mt1.product
            ) as labels
          FROM menu_templates mt1
          WHERE org_id = ${input.orgId}
          GROUP BY org_id, product
          ORDER BY product
        `;

        return products.map((p) => ({
          ...p,
          versionCount: Number(p.versionCount),
        }));
      } catch (error) {
        logger.error("Failed to get menu template products", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching menu template products failed",
        });
      }
    }),

  getVersions: protectedOrganizationProcedure
    .input(GetMenuTemplateVersionsInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        const where = {
          orgId: input.orgId,
          product: input.product,
        };

        const [versions, totalCount] = await Promise.all([
          ctx.prisma.menuTemplate.findMany({
            where,
            select: {
              id: true,
              version: true,
              labels: true,
              commitMessage: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { version: "desc" },
            skip: input.page * input.limit,
            take: input.limit,
          }),
          ctx.prisma.menuTemplate.count({ where }),
        ]);

        return { versions, totalCount };
      } catch (error) {
        logger.error("Failed to get menu template versions", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching menu template versions failed",
        });
      }
    }),

  getById: protectedOrganizationProcedure
    .input(GetMenuTemplateByIdInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:read",
        });

        const template = await ctx.prisma.menuTemplate.findUnique({
          where: { id: input.id, orgId: input.orgId },
        });

        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Menu template not found",
          });
        }

        return template;
      } catch (error) {
        logger.error("Failed to get menu template", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching menu template failed",
        });
      }
    }),

  create: protectedOrganizationProcedure
    .input(CreateMenuTemplateInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        // Auto-increment version
        const maxVersion = await ctx.prisma.menuTemplate.aggregate({
          where: {
            orgId: input.orgId,
            product: input.product,
          },
          _max: { version: true },
        });

        const nextVersion = (maxVersion._max.version ?? 0) + 1;

        const template = await ctx.prisma.menuTemplate.create({
          data: {
            orgId: input.orgId,
            product: input.product,
            version: nextVersion,
            content: input.content as Prisma.InputJsonValue,
            labels: input.labels ?? [],
            commitMessage: input.commitMessage,
          },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "menuTemplate",
          resourceId: template.id,
          action: "create",
          after: template,
        });

        return template;
      } catch (error) {
        logger.error("Failed to create menu template", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Creating menu template failed",
        });
      }
    }),

  updateLabels: protectedOrganizationProcedure
    .input(UpdateMenuTemplateLabelsInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const existing = await ctx.prisma.menuTemplate.findUnique({
          where: { id: input.id, orgId: input.orgId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Menu template not found",
          });
        }

        const updated = await ctx.prisma.menuTemplate.update({
          where: { id: input.id, orgId: input.orgId },
          data: { labels: input.labels },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "menuTemplate",
          resourceId: updated.id,
          action: "update",
          before: existing,
          after: updated,
        });

        return updated;
      } catch (error) {
        logger.error("Failed to update menu template labels", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Updating menu template labels failed",
        });
      }
    }),

  delete: protectedOrganizationProcedure
    .input(DeleteMenuTemplateInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoOrganizationAccess({
          session: ctx.session,
          organizationId: input.orgId,
          scope: "resources:CUD",
        });

        const existing = await ctx.prisma.menuTemplate.findUnique({
          where: { id: input.id, orgId: input.orgId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Menu template not found",
          });
        }

        await ctx.prisma.menuTemplate.delete({
          where: { id: input.id, orgId: input.orgId },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "menuTemplate",
          resourceId: input.id,
          action: "delete",
          before: existing,
        });

        return { success: true };
      } catch (error) {
        logger.error("Failed to delete menu template", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Deleting menu template failed",
        });
      }
    }),
});

import { type Prisma } from "@langfuse/shared";
import { z } from "zod/v4";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { TRPCError } from "@trpc/server";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import { logger } from "@langfuse/shared/src/server";
import { encrypt } from "@langfuse/shared/encryption";
import {
  CreateManagedModelInput,
  UpdateManagedModelInput,
  DeleteManagedModelInput,
  GetAllManagedModelsInput,
  BulkUpsertManagedModelsInput,
} from "../validation";
import { toApiManagedModel } from "../utils";

export const managedModelRouter = createTRPCRouter({
  getAll: protectedProjectProcedure
    .input(GetAllManagedModelsInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "managedModels:read",
        });

        const where: Prisma.ManagedModelWhereInput = {
          projectId: input.projectId,
          ...(input.searchQuery
            ? {
                OR: [
                  {
                    displayName: {
                      contains: input.searchQuery,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    modelId: {
                      contains: input.searchQuery,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    brand: {
                      contains: input.searchQuery,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
          ...(input.brandFilter ? { brand: input.brandFilter } : {}),
        };

        const [models, totalCount] = await Promise.all([
          ctx.prisma.managedModel.findMany({
            where,
            orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
            skip: input.page * input.limit,
            take: input.limit,
          }),
          ctx.prisma.managedModel.count({ where }),
        ]);

        return { models: models.map(toApiManagedModel), totalCount };
      } catch (error) {
        logger.error("Failed to get managed models", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching managed models failed",
        });
      }
    }),

  getById: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "managedModels:read",
        });

        const model = await ctx.prisma.managedModel.findUnique({
          where: { id: input.id, projectId: input.projectId },
        });

        if (!model) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Managed model not found",
          });
        }

        return toApiManagedModel(model);
      } catch (error) {
        logger.error("Failed to get managed model", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching managed model failed",
        });
      }
    }),

  create: protectedProjectProcedure
    .input(CreateManagedModelInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "managedModels:CUD",
        });

        const existing = await ctx.prisma.managedModel.findUnique({
          where: {
            projectId_modelId: {
              projectId: input.projectId,
              modelId: input.modelId,
            },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A managed model with modelId "${input.modelId}" already exists in this project`,
          });
        }

        const model = await ctx.prisma.managedModel.create({
          data: {
            projectId: input.projectId,
            modelId: input.modelId,
            displayName: input.displayName,
            brand: input.brand,
            brandDisplayName: input.brandDisplayName,
            maxInputTokenSize: input.maxInputTokenSize ?? null,
            maxOutputTokenSize: input.maxOutputTokenSize ?? null,
            contextWindowSize: input.contextWindowSize ?? null,
            isSupported: input.isSupported,
            sortOrder: input.sortOrder,
            capabilities:
              (input.capabilities as Prisma.InputJsonValue) ?? undefined,
            baseUrl: input.baseUrl ?? null,
            modelName: input.modelName ?? null,
            apiToken:
              input.apiToken !== null && input.apiToken !== undefined
                ? input.apiToken === ""
                  ? ""
                  : encrypt(input.apiToken)
                : null,
            timeout: input.timeout ?? null,
          },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "managedModel",
          resourceId: model.id,
          action: "create",
          after: model,
        });

        return toApiManagedModel(model);
      } catch (error) {
        logger.error("Failed to create managed model", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Creating managed model failed",
        });
      }
    }),

  update: protectedProjectProcedure
    .input(UpdateManagedModelInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "managedModels:CUD",
        });

        const existing = await ctx.prisma.managedModel.findUnique({
          where: { id: input.id, projectId: input.projectId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Managed model not found",
          });
        }

        const duplicate = await ctx.prisma.managedModel.findFirst({
          where: {
            projectId: input.projectId,
            modelId: input.modelId,
            id: { not: input.id },
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Another managed model with modelId "${input.modelId}" already exists`,
          });
        }

        const updated = await ctx.prisma.managedModel.update({
          where: { id: input.id, projectId: input.projectId },
          data: {
            modelId: input.modelId,
            displayName: input.displayName,
            brand: input.brand,
            brandDisplayName: input.brandDisplayName,
            maxInputTokenSize: input.maxInputTokenSize ?? null,
            maxOutputTokenSize: input.maxOutputTokenSize ?? null,
            contextWindowSize: input.contextWindowSize ?? null,
            isSupported: input.isSupported,
            sortOrder: input.sortOrder,
            capabilities:
              (input.capabilities as Prisma.InputJsonValue) ?? undefined,
            baseUrl: input.baseUrl ?? null,
            modelName: input.modelName ?? null,
            // undefined = keep existing, null = clear, "" = empty, string = encrypt
            ...(input.apiToken !== undefined && {
              apiToken:
                input.apiToken === null
                  ? null
                  : input.apiToken === ""
                    ? ""
                    : encrypt(input.apiToken),
            }),
            timeout: input.timeout ?? null,
          },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "managedModel",
          resourceId: updated.id,
          action: "update",
          before: existing,
          after: updated,
        });

        return toApiManagedModel(updated);
      } catch (error) {
        logger.error("Failed to update managed model", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Updating managed model failed",
        });
      }
    }),

  delete: protectedProjectProcedure
    .input(DeleteManagedModelInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "managedModels:CUD",
        });

        const existing = await ctx.prisma.managedModel.findUnique({
          where: { id: input.id, projectId: input.projectId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Managed model not found",
          });
        }

        await ctx.prisma.managedModel.delete({
          where: { id: input.id, projectId: input.projectId },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "managedModel",
          resourceId: input.id,
          action: "delete",
          before: existing,
        });

        return { success: true };
      } catch (error) {
        logger.error("Failed to delete managed model", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Deleting managed model failed",
        });
      }
    }),

  bulkUpsert: protectedProjectProcedure
    .input(BulkUpsertManagedModelsInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "managedModels:CUD",
        });

        const results = await ctx.prisma.$transaction(
          input.models.map((model) => {
            const encryptedApiToken =
              model.apiToken !== null && model.apiToken !== undefined
                ? model.apiToken === ""
                  ? ""
                  : encrypt(model.apiToken)
                : null;

            return ctx.prisma.managedModel.upsert({
              where: {
                projectId_modelId: {
                  projectId: input.projectId,
                  modelId: model.modelId,
                },
              },
              create: {
                projectId: input.projectId,
                modelId: model.modelId,
                displayName: model.displayName,
                brand: model.brand,
                brandDisplayName: model.brandDisplayName,
                maxInputTokenSize: model.maxInputTokenSize ?? null,
                maxOutputTokenSize: model.maxOutputTokenSize ?? null,
                contextWindowSize: model.contextWindowSize ?? null,
                isSupported: model.isSupported,
                sortOrder: model.sortOrder,
                capabilities:
                  (model.capabilities as Prisma.InputJsonValue) ?? undefined,
                baseUrl: model.baseUrl ?? null,
                modelName: model.modelName ?? null,
                apiToken: encryptedApiToken,
                timeout: model.timeout ?? null,
              },
              update: {
                displayName: model.displayName,
                brand: model.brand,
                brandDisplayName: model.brandDisplayName,
                maxInputTokenSize: model.maxInputTokenSize ?? null,
                maxOutputTokenSize: model.maxOutputTokenSize ?? null,
                contextWindowSize: model.contextWindowSize ?? null,
                isSupported: model.isSupported,
                sortOrder: model.sortOrder,
                capabilities:
                  (model.capabilities as Prisma.InputJsonValue) ?? undefined,
                baseUrl: model.baseUrl ?? null,
                modelName: model.modelName ?? null,
                apiToken: encryptedApiToken,
                timeout: model.timeout ?? null,
              },
            });
          }),
        );

        await auditLog({
          session: ctx.session,
          resourceType: "managedModel",
          resourceId: "bulk",
          action: "create",
          after: { count: results.length },
        });

        return { count: results.length };
      } catch (error) {
        logger.error("Failed to bulk upsert managed models", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Bulk upserting managed models failed",
        });
      }
    }),
});

import { type Prisma } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import {
  GetManagedModelsQuery,
  GetManagedModelsResponse,
  PostManagedModelBody,
  PostManagedModelResponse,
} from "@/src/features/public-api/types/managed-models";
import { InvalidRequestError } from "@langfuse/shared";

export default withMiddlewares({
  GET: createAuthedProjectAPIRoute({
    name: "Get managed models",
    querySchema: GetManagedModelsQuery,
    responseSchema: GetManagedModelsResponse,
    fn: async ({ query, auth }) => {
      const where: Prisma.ManagedModelWhereInput = {
        projectId: auth.scope.projectId,
        ...(query.searchQuery
          ? {
              OR: [
                {
                  displayName: {
                    contains: query.searchQuery,
                    mode: "insensitive" as const,
                  },
                },
                {
                  modelId: {
                    contains: query.searchQuery,
                    mode: "insensitive" as const,
                  },
                },
                {
                  brand: {
                    contains: query.searchQuery,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
        ...(query.brandFilter ? { brand: query.brandFilter } : {}),
      };

      const [models, totalItems] = await Promise.all([
        prisma.managedModel.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.managedModel.count({ where }),
      ]);

      return {
        data: models,
        meta: {
          page: query.page,
          limit: query.limit,
          totalItems,
          totalPages: Math.ceil(totalItems / query.limit),
        },
      };
    },
  }),

  POST: createAuthedProjectAPIRoute({
    name: "Create managed model",
    bodySchema: PostManagedModelBody,
    responseSchema: PostManagedModelResponse,
    successStatusCode: 201,
    fn: async ({ body, auth, res }) => {
      const existing = await prisma.managedModel.findUnique({
        where: {
          projectId_modelId: {
            projectId: auth.scope.projectId,
            modelId: body.modelId,
          },
        },
      });

      if (existing) {
        throw new InvalidRequestError(
          `A managed model with modelId "${body.modelId}" already exists in this project`,
        );
      }

      const model = await prisma.managedModel.create({
        data: {
          projectId: auth.scope.projectId,
          modelId: body.modelId,
          displayName: body.displayName,
          brand: body.brand,
          brandDisplayName: body.brandDisplayName,
          maxInputTokenSize: body.maxInputTokenSize ?? null,
          maxOutputTokenSize: body.maxOutputTokenSize ?? null,
          contextWindowSize: body.contextWindowSize ?? null,
          isSupported: body.isSupported,
          sortOrder: body.sortOrder,
          capabilities:
            (body.capabilities as Prisma.InputJsonValue) ?? undefined,
        },
      });

      res.status(201);
      return model;
    },
  }),
});

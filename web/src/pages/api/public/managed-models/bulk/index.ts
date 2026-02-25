import { type Prisma } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import {
  PostBulkManagedModelsBody,
  PostBulkManagedModelsResponse,
} from "@/src/features/public-api/types/managed-models";
import { encrypt } from "@langfuse/shared/encryption";

export default withMiddlewares({
  POST: createAuthedProjectAPIRoute({
    name: "Bulk upsert managed models",
    bodySchema: PostBulkManagedModelsBody,
    responseSchema: PostBulkManagedModelsResponse,
    successStatusCode: 201,
    fn: async ({ body, auth, res }) => {
      const results = await prisma.$transaction(
        body.models.map((model) => {
          const encryptedApiToken =
            model.apiToken !== null && model.apiToken !== undefined
              ? model.apiToken === ""
                ? ""
                : encrypt(model.apiToken)
              : null;

          return prisma.managedModel.upsert({
            where: {
              projectId_modelId: {
                projectId: auth.scope.projectId,
                modelId: model.modelId,
              },
            },
            create: {
              projectId: auth.scope.projectId,
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

      res.status(201);
      return { count: results.length };
    },
  }),
});

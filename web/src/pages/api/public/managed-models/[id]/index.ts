import { type Prisma } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import {
  GetManagedModelByIdQuery,
  GetManagedModelByIdResponse,
  PutManagedModelQuery,
  PutManagedModelBody,
  PutManagedModelResponse,
  DeleteManagedModelQuery,
  DeleteManagedModelResponse,
} from "@/src/features/public-api/types/managed-models";
import { InvalidRequestError, LangfuseNotFoundError } from "@langfuse/shared";

export default withMiddlewares({
  GET: createAuthedProjectAPIRoute({
    name: "Get managed model by ID",
    querySchema: GetManagedModelByIdQuery,
    responseSchema: GetManagedModelByIdResponse,
    fn: async ({ query, auth }) => {
      const model = await prisma.managedModel.findUnique({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      if (!model) {
        throw new LangfuseNotFoundError("Managed model not found");
      }

      return model;
    },
  }),

  PUT: createAuthedProjectAPIRoute({
    name: "Update managed model",
    querySchema: PutManagedModelQuery,
    bodySchema: PutManagedModelBody,
    responseSchema: PutManagedModelResponse,
    fn: async ({ query, body, auth }) => {
      const existing = await prisma.managedModel.findUnique({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("Managed model not found");
      }

      const duplicate = await prisma.managedModel.findFirst({
        where: {
          projectId: auth.scope.projectId,
          modelId: body.modelId,
          id: { not: query.id },
        },
      });

      if (duplicate) {
        throw new InvalidRequestError(
          `Another managed model with modelId "${body.modelId}" already exists`,
        );
      }

      const updated = await prisma.managedModel.update({
        where: { id: query.id, projectId: auth.scope.projectId },
        data: {
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

      return updated;
    },
  }),

  DELETE: createAuthedProjectAPIRoute({
    name: "Delete managed model",
    querySchema: DeleteManagedModelQuery,
    responseSchema: DeleteManagedModelResponse,
    fn: async ({ query, auth }) => {
      const existing = await prisma.managedModel.findUnique({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("Managed model not found");
      }

      await prisma.managedModel.delete({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      return { message: "Managed model successfully deleted" as const };
    },
  }),
});

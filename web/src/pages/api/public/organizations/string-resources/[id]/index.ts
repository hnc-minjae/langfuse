import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  GetStringResourceByIdQuery,
  GetStringResourceByIdResponse,
  PutStringResourceQuery,
  PutStringResourceBody,
  PutStringResourceResponse,
  DeleteStringResourceQuery,
  DeleteStringResourceResponse,
} from "@/src/features/public-api/types/string-resources";
import { LangfuseNotFoundError } from "@langfuse/shared";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get string resource by ID",
    querySchema: GetStringResourceByIdQuery,
    responseSchema: GetStringResourceByIdResponse,
    fn: async ({ query, auth }) => {
      const resource = await prisma.stringResource.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!resource) {
        throw new LangfuseNotFoundError("String resource not found");
      }

      return resource;
    },
  }),

  PUT: createAuthedOrgAPIRoute({
    name: "Update string resource",
    querySchema: PutStringResourceQuery,
    bodySchema: PutStringResourceBody,
    responseSchema: PutStringResourceResponse,
    fn: async ({ query, body, auth }) => {
      const existing = await prisma.stringResource.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("String resource not found");
      }

      const updated = await prisma.stringResource.update({
        where: { id: query.id, orgId: auth.scope.orgId },
        data: { value: body.value },
      });

      return updated;
    },
  }),

  DELETE: createAuthedOrgAPIRoute({
    name: "Delete string resource",
    querySchema: DeleteStringResourceQuery,
    responseSchema: DeleteStringResourceResponse,
    fn: async ({ query, auth }) => {
      const existing = await prisma.stringResource.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("String resource not found");
      }

      await prisma.stringResource.delete({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      return { message: "String resource successfully deleted" as const };
    },
  }),
});

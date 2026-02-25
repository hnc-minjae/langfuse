import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  GetDrawableResourceByIdQuery,
  GetDrawableResourceByIdResponse,
  PutDrawableResourceQuery,
  PutDrawableResourceBody,
  PutDrawableResourceResponse,
  DeleteDrawableResourceQuery,
  DeleteDrawableResourceResponse,
} from "@/src/features/public-api/types/drawable-resources";
import { LangfuseNotFoundError } from "@langfuse/shared";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get drawable resource by ID",
    querySchema: GetDrawableResourceByIdQuery,
    responseSchema: GetDrawableResourceByIdResponse,
    fn: async ({ query, auth }) => {
      const resource = await prisma.drawableResource.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!resource) {
        throw new LangfuseNotFoundError("Drawable resource not found");
      }

      return resource;
    },
  }),

  PUT: createAuthedOrgAPIRoute({
    name: "Update drawable resource",
    querySchema: PutDrawableResourceQuery,
    bodySchema: PutDrawableResourceBody,
    responseSchema: PutDrawableResourceResponse,
    fn: async ({ query, body, auth }) => {
      const existing = await prisma.drawableResource.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("Drawable resource not found");
      }

      const updated = await prisma.drawableResource.update({
        where: { id: query.id, orgId: auth.scope.orgId },
        data: {
          contentType: body.contentType,
          content: body.content,
        },
      });

      return updated;
    },
  }),

  DELETE: createAuthedOrgAPIRoute({
    name: "Delete drawable resource",
    querySchema: DeleteDrawableResourceQuery,
    responseSchema: DeleteDrawableResourceResponse,
    fn: async ({ query, auth }) => {
      const existing = await prisma.drawableResource.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("Drawable resource not found");
      }

      await prisma.drawableResource.delete({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      return { message: "Drawable resource successfully deleted" as const };
    },
  }),
});

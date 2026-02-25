import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  GetMenuTemplateByIdQuery,
  GetMenuTemplateByIdResponse,
  DeleteMenuTemplateQuery,
  DeleteMenuTemplateResponse,
} from "@/src/features/public-api/types/menu-templates";
import { LangfuseNotFoundError } from "@langfuse/shared";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get menu template by ID",
    querySchema: GetMenuTemplateByIdQuery,
    responseSchema: GetMenuTemplateByIdResponse,
    fn: async ({ query, auth }) => {
      const template = await prisma.menuTemplate.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!template) {
        throw new LangfuseNotFoundError("Menu template not found");
      }

      return template;
    },
  }),

  DELETE: createAuthedOrgAPIRoute({
    name: "Delete menu template",
    querySchema: DeleteMenuTemplateQuery,
    responseSchema: DeleteMenuTemplateResponse,
    fn: async ({ query, auth }) => {
      const existing = await prisma.menuTemplate.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("Menu template not found");
      }

      await prisma.menuTemplate.delete({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      return { message: "Menu template successfully deleted" as const };
    },
  }),
});

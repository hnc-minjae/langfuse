import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  PatchMenuTemplateLabelsQuery,
  PatchMenuTemplateLabelsBody,
  PatchMenuTemplateLabelsResponse,
} from "@/src/features/public-api/types/menu-templates";
import { LangfuseNotFoundError } from "@langfuse/shared";

export default withMiddlewares({
  PATCH: createAuthedOrgAPIRoute({
    name: "Update menu template labels",
    querySchema: PatchMenuTemplateLabelsQuery,
    bodySchema: PatchMenuTemplateLabelsBody,
    responseSchema: PatchMenuTemplateLabelsResponse,
    fn: async ({ query, body, auth }) => {
      const existing = await prisma.menuTemplate.findUnique({
        where: { id: query.id, orgId: auth.scope.orgId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("Menu template not found");
      }

      const updated = await prisma.menuTemplate.update({
        where: { id: query.id, orgId: auth.scope.orgId },
        data: { labels: body.labels },
      });

      return updated;
    },
  }),
});

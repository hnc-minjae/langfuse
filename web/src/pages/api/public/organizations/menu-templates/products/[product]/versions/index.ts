import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  GetMenuTemplateVersionsQuery,
  GetMenuTemplateVersionsResponse,
} from "@/src/features/public-api/types/menu-templates";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get menu template versions",
    querySchema: GetMenuTemplateVersionsQuery,
    responseSchema: GetMenuTemplateVersionsResponse,
    fn: async ({ query, auth }) => {
      const where = {
        orgId: auth.scope.orgId,
        product: query.product,
      };

      const [versions, totalItems] = await Promise.all([
        prisma.menuTemplate.findMany({
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
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.menuTemplate.count({ where }),
      ]);

      return {
        data: versions,
        meta: {
          page: query.page,
          limit: query.limit,
          totalItems,
          totalPages: Math.ceil(totalItems / query.limit),
        },
      };
    },
  }),
});

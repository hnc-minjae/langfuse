import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import { GetStringResourceCategoriesResponse } from "@/src/features/public-api/types/string-resources";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get string resource categories",
    responseSchema: GetStringResourceCategoriesResponse,
    fn: async ({ auth }) => {
      const result = await prisma.stringResource.findMany({
        where: { orgId: auth.scope.orgId },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      });

      return { data: result.map((r) => r.category) };
    },
  }),
});

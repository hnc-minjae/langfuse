import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import { GetMenuTemplateProductsResponse } from "@/src/features/public-api/types/menu-templates";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get menu template products",
    responseSchema: GetMenuTemplateProductsResponse,
    fn: async ({ auth }) => {
      const products = await prisma.$queryRaw<
        Array<{
          product: string;
          latestVersion: number;
          versionCount: bigint;
          labels: string[];
        }>
      >`
        SELECT
          product,
          MAX(version) as "latestVersion",
          COUNT(*)::bigint as "versionCount",
          ARRAY(
            SELECT DISTINCT unnest(labels)
            FROM menu_templates mt2
            WHERE mt2.org_id = mt1.org_id AND mt2.product = mt1.product
          ) as labels
        FROM menu_templates mt1
        WHERE org_id = ${auth.scope.orgId}
        GROUP BY org_id, product
        ORDER BY product
      `;

      return {
        data: products.map((p) => ({
          ...p,
          versionCount: Number(p.versionCount),
        })),
      };
    },
  }),
});

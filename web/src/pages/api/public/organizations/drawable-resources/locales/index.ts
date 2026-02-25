import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import { GetDrawableResourceLocalesResponse } from "@/src/features/public-api/types/drawable-resources";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get drawable resource locales",
    responseSchema: GetDrawableResourceLocalesResponse,
    fn: async ({ auth }) => {
      const result = await prisma.drawableResource.findMany({
        where: { orgId: auth.scope.orgId },
        select: { locale: true },
        distinct: ["locale"],
        orderBy: { locale: "asc" },
      });

      return { data: result.map((r) => r.locale) };
    },
  }),
});

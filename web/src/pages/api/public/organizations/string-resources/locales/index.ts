import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import { GetStringResourceLocalesResponse } from "@/src/features/public-api/types/string-resources";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get string resource locales",
    responseSchema: GetStringResourceLocalesResponse,
    fn: async ({ auth }) => {
      const result = await prisma.stringResource.findMany({
        where: { orgId: auth.scope.orgId },
        select: { locale: true },
        distinct: ["locale"],
        orderBy: { locale: "asc" },
      });

      return { data: result.map((r) => r.locale) };
    },
  }),
});

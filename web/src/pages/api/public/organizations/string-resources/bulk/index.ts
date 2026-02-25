import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  PostBulkStringResourcesBody,
  PostBulkStringResourcesResponse,
} from "@/src/features/public-api/types/string-resources";

export default withMiddlewares({
  POST: createAuthedOrgAPIRoute({
    name: "Bulk upsert string resources",
    bodySchema: PostBulkStringResourcesBody,
    responseSchema: PostBulkStringResourcesResponse,
    successStatusCode: 201,
    fn: async ({ body, auth, res }) => {
      const batchSize = 500;
      let totalCount = 0;

      for (let i = 0; i < body.resources.length; i += batchSize) {
        const batch = body.resources.slice(i, i + batchSize);
        const results = await prisma.$transaction(
          batch.map((resource) =>
            prisma.stringResource.upsert({
              where: {
                orgId_category_key_locale: {
                  orgId: auth.scope.orgId,
                  category: resource.category,
                  key: resource.key,
                  locale: resource.locale,
                },
              },
              create: {
                orgId: auth.scope.orgId,
                category: resource.category,
                key: resource.key,
                locale: resource.locale,
                value: resource.value,
              },
              update: {
                value: resource.value,
              },
            }),
          ),
        );
        totalCount += results.length;
      }

      res.status(201);
      return { count: totalCount };
    },
  }),
});

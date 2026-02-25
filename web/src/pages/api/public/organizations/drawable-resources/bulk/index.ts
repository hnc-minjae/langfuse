import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  PostBulkDrawableResourcesBody,
  PostBulkDrawableResourcesResponse,
} from "@/src/features/public-api/types/drawable-resources";

export default withMiddlewares({
  POST: createAuthedOrgAPIRoute({
    name: "Bulk upsert drawable resources",
    bodySchema: PostBulkDrawableResourcesBody,
    responseSchema: PostBulkDrawableResourcesResponse,
    successStatusCode: 201,
    fn: async ({ body, auth, res }) => {
      const results = await prisma.$transaction(
        body.resources.map((resource) =>
          prisma.drawableResource.upsert({
            where: {
              orgId_filename_locale: {
                orgId: auth.scope.orgId,
                filename: resource.filename,
                locale: resource.locale,
              },
            },
            create: {
              orgId: auth.scope.orgId,
              filename: resource.filename,
              locale: resource.locale,
              contentType: resource.contentType,
              content: resource.content,
            },
            update: {
              contentType: resource.contentType,
              content: resource.content,
            },
          }),
        ),
      );

      res.status(201);
      return { count: results.length };
    },
  }),
});

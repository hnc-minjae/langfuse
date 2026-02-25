import { type Prisma } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  PostMenuTemplateBody,
  PostMenuTemplateResponse,
} from "@/src/features/public-api/types/menu-templates";

export default withMiddlewares({
  POST: createAuthedOrgAPIRoute({
    name: "Create menu template",
    bodySchema: PostMenuTemplateBody,
    responseSchema: PostMenuTemplateResponse,
    successStatusCode: 201,
    fn: async ({ body, auth, res }) => {
      const maxVersion = await prisma.menuTemplate.aggregate({
        where: {
          orgId: auth.scope.orgId,
          product: body.product,
        },
        _max: { version: true },
      });

      const nextVersion = (maxVersion._max.version ?? 0) + 1;

      const template = await prisma.menuTemplate.create({
        data: {
          orgId: auth.scope.orgId,
          product: body.product,
          version: nextVersion,
          content: body.content as Prisma.InputJsonValue,
          labels: body.labels ?? [],
          commitMessage: body.commitMessage,
        },
      });

      res.status(201);
      return template;
    },
  }),
});

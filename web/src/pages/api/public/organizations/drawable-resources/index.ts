import { type Prisma } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  GetDrawableResourcesQuery,
  GetDrawableResourcesResponse,
  PostDrawableResourceBody,
  PostDrawableResourceResponse,
} from "@/src/features/public-api/types/drawable-resources";
import { InvalidRequestError } from "@langfuse/shared";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get drawable resources",
    querySchema: GetDrawableResourcesQuery,
    responseSchema: GetDrawableResourcesResponse,
    fn: async ({ query, auth }) => {
      const where: Prisma.DrawableResourceWhereInput = {
        orgId: auth.scope.orgId,
        ...(query.localeFilter ? { locale: query.localeFilter } : {}),
      };

      const [resources, totalItems] = await Promise.all([
        prisma.drawableResource.findMany({
          where,
          select: {
            id: true,
            orgId: true,
            filename: true,
            locale: true,
            contentType: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ locale: "asc" }, { filename: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.drawableResource.count({ where }),
      ]);

      return {
        data: resources,
        meta: {
          page: query.page,
          limit: query.limit,
          totalItems,
          totalPages: Math.ceil(totalItems / query.limit),
        },
      };
    },
  }),

  POST: createAuthedOrgAPIRoute({
    name: "Create drawable resource",
    bodySchema: PostDrawableResourceBody,
    responseSchema: PostDrawableResourceResponse,
    successStatusCode: 201,
    fn: async ({ body, auth, res }) => {
      const existing = await prisma.drawableResource.findUnique({
        where: {
          orgId_filename_locale: {
            orgId: auth.scope.orgId,
            filename: body.filename,
            locale: body.locale,
          },
        },
      });

      if (existing) {
        throw new InvalidRequestError(
          `Drawable resource "${body.filename}" already exists for locale "${body.locale}"`,
        );
      }

      const resource = await prisma.drawableResource.create({
        data: {
          orgId: auth.scope.orgId,
          filename: body.filename,
          locale: body.locale,
          contentType: body.contentType,
          content: body.content,
        },
      });

      res.status(201);
      return resource;
    },
  }),
});

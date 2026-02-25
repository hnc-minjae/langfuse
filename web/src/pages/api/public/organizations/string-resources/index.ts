import { type Prisma } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedOrgAPIRoute } from "@/src/features/public-api/server/createAuthedOrgAPIRoute";
import {
  GetStringResourcesQuery,
  GetStringResourcesResponse,
  PostStringResourceBody,
  PostStringResourceResponse,
} from "@/src/features/public-api/types/string-resources";
import { InvalidRequestError } from "@langfuse/shared";

export default withMiddlewares({
  GET: createAuthedOrgAPIRoute({
    name: "Get string resources",
    querySchema: GetStringResourcesQuery,
    responseSchema: GetStringResourcesResponse,
    fn: async ({ query, auth }) => {
      const where: Prisma.StringResourceWhereInput = {
        orgId: auth.scope.orgId,
        ...(query.searchQuery
          ? {
              OR: [
                {
                  key: {
                    contains: query.searchQuery,
                    mode: "insensitive" as const,
                  },
                },
                {
                  value: {
                    contains: query.searchQuery,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
        ...(query.categoryFilter ? { category: query.categoryFilter } : {}),
        ...(query.localeFilter ? { locale: query.localeFilter } : {}),
      };

      const [resources, totalItems] = await Promise.all([
        prisma.stringResource.findMany({
          where,
          orderBy: [{ category: "asc" }, { key: "asc" }, { locale: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.stringResource.count({ where }),
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
    name: "Create string resource",
    bodySchema: PostStringResourceBody,
    responseSchema: PostStringResourceResponse,
    successStatusCode: 201,
    fn: async ({ body, auth, res }) => {
      const existing = await prisma.stringResource.findUnique({
        where: {
          orgId_category_key_locale: {
            orgId: auth.scope.orgId,
            category: body.category,
            key: body.key,
            locale: body.locale,
          },
        },
      });

      if (existing) {
        throw new InvalidRequestError(
          `String resource with key "${body.key}" already exists for category "${body.category}" and locale "${body.locale}"`,
        );
      }

      const resource = await prisma.stringResource.create({
        data: {
          orgId: auth.scope.orgId,
          category: body.category,
          key: body.key,
          locale: body.locale,
          value: body.value,
        },
      });

      res.status(201);
      return resource;
    },
  }),
});

import { type Prisma } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import {
  GetTaskTemplatesQuery,
  GetTaskTemplatesResponse,
  PostTaskTemplateBody,
  PostTaskTemplateResponse,
} from "@/src/features/public-api/types/task-templates";
import { InvalidRequestError } from "@langfuse/shared";
import { validatePromptConfig } from "@/src/features/task-templates/validation";

export default withMiddlewares({
  GET: createAuthedProjectAPIRoute({
    name: "Get task templates",
    querySchema: GetTaskTemplatesQuery,
    responseSchema: GetTaskTemplatesResponse,
    fn: async ({ query, auth }) => {
      const where: Prisma.TaskTemplateWhereInput = {
        projectId: auth.scope.projectId,
        ...(query.searchQuery
          ? {
              OR: [
                {
                  name: {
                    contains: query.searchQuery,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
        ...(query.typeFilter ? { type: query.typeFilter } : {}),
        ...(query.nameFilter ? { name: query.nameFilter } : {}),
      };

      const [templates, totalItems] = await Promise.all([
        prisma.taskTemplate.findMany({
          where,
          orderBy: [{ name: "asc" }, { version: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.taskTemplate.count({ where }),
      ]);

      return {
        data: templates,
        meta: {
          page: query.page,
          limit: query.limit,
          totalItems,
          totalPages: Math.ceil(totalItems / query.limit),
        },
      };
    },
  }),

  POST: createAuthedProjectAPIRoute({
    name: "Create task template",
    bodySchema: PostTaskTemplateBody,
    responseSchema: PostTaskTemplateResponse,
    successStatusCode: 201,
    fn: async ({ body, auth, res }) => {
      // Validate promptConfig against type
      const configValidation = validatePromptConfig({
        type: body.type,
        promptConfig: body.promptConfig,
      });
      if (!configValidation.success) {
        throw new InvalidRequestError(configValidation.error);
      }

      // Auto-increment version
      const latestTemplate = await prisma.taskTemplate.findFirst({
        where: { projectId: auth.scope.projectId, name: body.name },
        orderBy: [{ version: "desc" }],
      });
      const newVersion = latestTemplate ? latestTemplate.version + 1 : 1;

      const template = await prisma.taskTemplate.create({
        data: {
          projectId: auth.scope.projectId,
          name: body.name,
          version: newVersion,
          type: body.type,
          managedModelId: body.managedModelId,
          modelOptions:
            (body.modelOptions as Prisma.InputJsonValue) ?? undefined,
          promptConfig: body.promptConfig as Prisma.InputJsonValue,
          inputForms: (body.inputForms as Prisma.InputJsonValue) ?? undefined,
          outputKey: body.outputKey,
          labels: body.labels,
          tags: body.tags,
          commitMessage: body.commitMessage,
        },
      });

      res.status(201);
      return template;
    },
  }),
});

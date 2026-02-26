import { type Prisma } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import {
  GetTaskTemplateByIdQuery,
  GetTaskTemplateByIdResponse,
  PutTaskTemplateQuery,
  PutTaskTemplateBody,
  PutTaskTemplateResponse,
  DeleteTaskTemplateQuery,
  DeleteTaskTemplateResponse,
} from "@/src/features/public-api/types/task-templates";
import { InvalidRequestError, LangfuseNotFoundError } from "@langfuse/shared";
import { validatePromptConfig } from "@/src/features/task-templates/validation";

export default withMiddlewares({
  GET: createAuthedProjectAPIRoute({
    name: "Get task template by ID",
    querySchema: GetTaskTemplateByIdQuery,
    responseSchema: GetTaskTemplateByIdResponse,
    fn: async ({ query, auth }) => {
      const template = await prisma.taskTemplate.findUnique({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      if (!template) {
        throw new LangfuseNotFoundError("Task template not found");
      }

      return template;
    },
  }),

  PUT: createAuthedProjectAPIRoute({
    name: "Update task template",
    querySchema: PutTaskTemplateQuery,
    bodySchema: PutTaskTemplateBody,
    responseSchema: PutTaskTemplateResponse,
    fn: async ({ query, body, auth }) => {
      const existing = await prisma.taskTemplate.findUnique({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("Task template not found");
      }

      // Validate promptConfig against existing type
      const configValidation = validatePromptConfig({
        type: existing.type,
        promptConfig: body.promptConfig,
        tasks: body.tasks,
      });
      if (!configValidation.success) {
        throw new InvalidRequestError(configValidation.error);
      }

      const updated = await prisma.taskTemplate.update({
        where: { id: query.id, projectId: auth.scope.projectId },
        data: {
          managedModelId: body.managedModelId,
          modelOptions:
            (body.modelOptions as Prisma.InputJsonValue) ?? undefined,
          promptConfig: body.promptConfig as Prisma.InputJsonValue,
          inputForms: (body.inputForms as Prisma.InputJsonValue) ?? undefined,
          ...(body.tasks !== undefined && {
            tasks: body.tasks as unknown as Prisma.InputJsonValue,
          }),
          ...(body.interval !== undefined && { interval: body.interval }),
          ...(body.outputKey !== undefined && { outputKey: body.outputKey }),
          ...(body.labels !== undefined && { labels: body.labels }),
          ...(body.tags !== undefined && { tags: body.tags }),
          ...(body.commitMessage !== undefined && {
            commitMessage: body.commitMessage,
          }),
        },
      });

      return updated;
    },
  }),

  DELETE: createAuthedProjectAPIRoute({
    name: "Delete task template",
    querySchema: DeleteTaskTemplateQuery,
    responseSchema: DeleteTaskTemplateResponse,
    fn: async ({ query, auth }) => {
      const existing = await prisma.taskTemplate.findUnique({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      if (!existing) {
        throw new LangfuseNotFoundError("Task template not found");
      }

      await prisma.taskTemplate.delete({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      return { message: "Task template successfully deleted" as const };
    },
  }),
});

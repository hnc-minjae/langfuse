import { type Prisma } from "@langfuse/shared";
import { z } from "zod/v4";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { TRPCError } from "@trpc/server";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import { logger } from "@langfuse/shared/src/server";
import {
  CreateTaskTemplateInput,
  UpdateTaskTemplateInput,
  DeleteTaskTemplateInput,
  GetAllTaskTemplatesInput,
  ExecuteTaskTemplateInput,
  validatePromptConfig,
} from "../validation";
import { resolveModelConnection } from "./resolveModelConnection";
import { buildMessages, validateInputs } from "./promptBuilder";
import { executeSequential, executeMultiple } from "./executionEngine";
import { fetchLLMCompletion } from "@langfuse/shared/src/server";
import type { TaskDefinition } from "../types";

export const taskTemplateRouter = createTRPCRouter({
  getAll: protectedProjectProcedure
    .input(GetAllTaskTemplatesInput)
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "taskTemplates:read",
        });

        const where: Prisma.TaskTemplateWhereInput = {
          projectId: input.projectId,
          ...(input.searchQuery
            ? {
                OR: [
                  {
                    name: {
                      contains: input.searchQuery,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
          ...(input.typeFilter ? { type: input.typeFilter } : {}),
          ...(input.nameFilter ? { name: input.nameFilter } : {}),
        };

        const [templates, totalCount] = await Promise.all([
          ctx.prisma.taskTemplate.findMany({
            where,
            orderBy: [{ name: "asc" }, { version: "desc" }],
            skip: input.page * input.limit,
            take: input.limit,
          }),
          ctx.prisma.taskTemplate.count({ where }),
        ]);

        return { templates, totalCount };
      } catch (error) {
        logger.error("Failed to get task templates", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching task templates failed",
        });
      }
    }),

  getById: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "taskTemplates:read",
        });

        const template = await ctx.prisma.taskTemplate.findUnique({
          where: { id: input.id, projectId: input.projectId },
        });

        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task template not found",
          });
        }

        return template;
      } catch (error) {
        logger.error("Failed to get task template", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fetching task template failed",
        });
      }
    }),

  create: protectedProjectProcedure
    .input(CreateTaskTemplateInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "taskTemplates:CUD",
        });

        // Validate promptConfig against type
        const configValidation = validatePromptConfig({
          type: input.type,
          promptConfig: input.promptConfig,
          tasks: input.tasks,
        });
        if (!configValidation.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: configValidation.error,
          });
        }

        // Auto-increment version
        const latestTemplate = await ctx.prisma.taskTemplate.findFirst({
          where: { projectId: input.projectId, name: input.name },
          orderBy: [{ version: "desc" }],
        });
        const newVersion = latestTemplate ? latestTemplate.version + 1 : 1;

        const template = await ctx.prisma.taskTemplate.create({
          data: {
            projectId: input.projectId,
            name: input.name,
            version: newVersion,
            type: input.type,
            managedModelId: input.managedModelId,
            modelOptions:
              (input.modelOptions as Prisma.InputJsonValue) ?? undefined,
            promptConfig: input.promptConfig as Prisma.InputJsonValue,
            inputForms:
              (input.inputForms as Prisma.InputJsonValue) ?? undefined,
            tasks: input.tasks
              ? (input.tasks as unknown as Prisma.InputJsonValue)
              : undefined,
            interval: input.interval ?? undefined,
            outputKey: input.outputKey,
            labels: input.labels,
            tags: input.tags,
            commitMessage: input.commitMessage,
          },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "taskTemplate",
          resourceId: template.id,
          action: "create",
          after: template,
        });

        return template;
      } catch (error) {
        logger.error("Failed to create task template", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Creating task template failed",
        });
      }
    }),

  update: protectedProjectProcedure
    .input(UpdateTaskTemplateInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "taskTemplates:CUD",
        });

        const existing = await ctx.prisma.taskTemplate.findUnique({
          where: { id: input.id, projectId: input.projectId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task template not found",
          });
        }

        // Validate promptConfig against existing type
        const configValidation = validatePromptConfig({
          type: existing.type,
          promptConfig: input.promptConfig,
          tasks: input.tasks,
        });
        if (!configValidation.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: configValidation.error,
          });
        }

        const updated = await ctx.prisma.taskTemplate.update({
          where: { id: input.id, projectId: input.projectId },
          data: {
            managedModelId: input.managedModelId,
            modelOptions:
              (input.modelOptions as Prisma.InputJsonValue) ?? undefined,
            promptConfig: input.promptConfig as Prisma.InputJsonValue,
            inputForms:
              (input.inputForms as Prisma.InputJsonValue) ?? undefined,
            ...(input.tasks !== undefined && {
              tasks: input.tasks as unknown as Prisma.InputJsonValue,
            }),
            ...(input.interval !== undefined && {
              interval: input.interval,
            }),
            ...(input.outputKey !== undefined && {
              outputKey: input.outputKey,
            }),
            ...(input.labels !== undefined && { labels: input.labels }),
            ...(input.tags !== undefined && { tags: input.tags }),
            ...(input.commitMessage !== undefined && {
              commitMessage: input.commitMessage,
            }),
          },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "taskTemplate",
          resourceId: updated.id,
          action: "update",
          before: existing,
          after: updated,
        });

        return updated;
      } catch (error) {
        logger.error("Failed to update task template", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Updating task template failed",
        });
      }
    }),

  delete: protectedProjectProcedure
    .input(DeleteTaskTemplateInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "taskTemplates:CUD",
        });

        const existing = await ctx.prisma.taskTemplate.findUnique({
          where: { id: input.id, projectId: input.projectId },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task template not found",
          });
        }

        await ctx.prisma.taskTemplate.delete({
          where: { id: input.id, projectId: input.projectId },
        });

        await auditLog({
          session: ctx.session,
          resourceType: "taskTemplate",
          resourceId: input.id,
          action: "delete",
          before: existing,
        });

        return { success: true };
      } catch (error) {
        logger.error("Failed to delete task template", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Deleting task template failed",
        });
      }
    }),

  execute: protectedProjectProcedure
    .input(ExecuteTaskTemplateInput)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "taskTemplates:execute",
        });

        const template = await ctx.prisma.taskTemplate.findUnique({
          where: { id: input.id, projectId: input.projectId },
        });

        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task template not found",
          });
        }

        // Sequential / Multiple execution
        if (template.type === "sequential" || template.type === "multiple") {
          const tasks = template.tasks as unknown as TaskDefinition[];
          if (!tasks || tasks.length === 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `${template.type} template has no tasks defined`,
            });
          }

          const executeFn =
            template.type === "sequential"
              ? executeSequential
              : executeMultiple;

          const result = await executeFn({
            tasks,
            inputs: input.inputs,
            projectId: input.projectId,
            outputKey: template.outputKey,
            ...(template.type === "sequential" && {
              interval: template.interval ?? undefined,
            }),
          });

          return {
            success: result.success,
            [template.outputKey]: result.output,
            context: result.context,
            latencyMs: result.latencyMs,
          };
        }

        // Chat / General single-task execution
        const promptConfig = template.promptConfig as Record<string, unknown>;
        const inputVariables = (promptConfig.inputVariables as string[]) ?? [];
        const { missing } = validateInputs({
          inputVariables,
          inputs: input.inputs,
        });

        if (missing.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Missing required input variables: ${missing.join(", ")}`,
          });
        }

        // Resolve model connection
        const { modelParams, llmConnection } = await resolveModelConnection({
          managedModelId: template.managedModelId,
          projectId: input.projectId,
          modelOptions:
            (template.modelOptions as import("../types").ModelOptions) ??
            undefined,
        });

        // Build messages
        const messages = buildMessages({
          type: template.type,
          promptConfig,
          inputs: input.inputs,
        });

        // Execute LLM call
        const startTime = Date.now();
        const completion = await fetchLLMCompletion({
          messages,
          modelParams,
          llmConnection,
          streaming: false,
        });
        const latencyMs = Date.now() - startTime;

        return {
          success: true,
          [template.outputKey]: completion,
          latencyMs,
        };
      } catch (error) {
        logger.error("Failed to execute task template", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Execution failed: ${error.message}`
              : "Executing task template failed",
        });
      }
    }),
});

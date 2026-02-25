import { prisma } from "@langfuse/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import {
  ExecuteTaskTemplateQuery,
  ExecuteTaskTemplateBody,
  ExecuteTaskTemplateResponse,
} from "@/src/features/public-api/types/task-templates";
import { LangfuseNotFoundError, InvalidRequestError } from "@langfuse/shared";
import { resolveModelConnection } from "@/src/features/task-templates/server/resolveModelConnection";
import {
  buildMessages,
  validateInputs,
} from "@/src/features/task-templates/server/promptBuilder";
import { fetchLLMCompletion } from "@langfuse/shared/src/server";
import type { ModelOptions } from "@/src/features/task-templates/types";

export default withMiddlewares({
  POST: createAuthedProjectAPIRoute({
    name: "Execute task template",
    querySchema: ExecuteTaskTemplateQuery,
    bodySchema: ExecuteTaskTemplateBody,
    responseSchema: ExecuteTaskTemplateResponse,
    fn: async ({ query, body, auth }) => {
      const template = await prisma.taskTemplate.findUnique({
        where: { id: query.id, projectId: auth.scope.projectId },
      });

      if (!template) {
        throw new LangfuseNotFoundError("Task template not found");
      }

      // Validate inputs against declared inputVariables
      const promptConfig = template.promptConfig as Record<string, unknown>;
      const inputVariables = (promptConfig.inputVariables as string[]) ?? [];
      const { missing } = validateInputs({
        inputVariables,
        inputs: body.inputs,
      });

      if (missing.length > 0) {
        throw new InvalidRequestError(
          `Missing required input variables: ${missing.join(", ")}`,
        );
      }

      // Resolve model connection
      const { modelParams, llmConnection } = await resolveModelConnection({
        managedModelId: template.managedModelId,
        projectId: auth.scope.projectId,
        modelOptions: (template.modelOptions as ModelOptions) ?? undefined,
      });

      // Build messages
      const messages = buildMessages({
        type: template.type,
        promptConfig,
        inputs: body.inputs,
      });

      // Execute LLM call (non-streaming)
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
    },
  }),
});

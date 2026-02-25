import { type NextApiRequest, type NextApiResponse } from "next";
import { prisma } from "@langfuse/shared/src/db";
import { redis, logger } from "@langfuse/shared/src/server";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { resolveModelConnection } from "@/src/features/task-templates/server/resolveModelConnection";
import {
  buildMessages,
  validateInputs,
} from "@/src/features/task-templates/server/promptBuilder";
import { fetchLLMCompletion } from "@langfuse/shared/src/server";
import { StreamTaskTemplateBody } from "@/src/features/public-api/types/task-templates";
import type { ModelOptions } from "@/src/features/task-templates/types";

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Authenticate
    const authResult = await new ApiAuthService(
      prisma,
      redis,
    ).verifyAuthHeaderAndReturnScope(req.headers.authorization);

    if (!authResult.validKey) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    if (authResult.scope.accessLevel !== "project") {
      res.status(401).json({
        error: "Access denied - need to use basic auth with secret key",
      });
      return;
    }

    const projectId = authResult.scope.projectId;
    if (!projectId) {
      res.status(401).json({ error: "Project ID not found for API token" });
      return;
    }

    // Parse and validate body
    const bodyResult = StreamTaskTemplateBody.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: bodyResult.error.message });
      return;
    }

    const { inputs } = bodyResult.data;
    const templateId = req.query.id as string;

    // Load template
    const template = await prisma.taskTemplate.findUnique({
      where: { id: templateId, projectId },
    });

    if (!template) {
      res.status(404).json({ error: "Task template not found" });
      return;
    }

    // Validate inputs
    const promptConfig = template.promptConfig as Record<string, unknown>;
    const inputVariables = (promptConfig.inputVariables as string[]) ?? [];
    const { missing } = validateInputs({ inputVariables, inputs });

    if (missing.length > 0) {
      res.status(400).json({
        error: `Missing required input variables: ${missing.join(", ")}`,
      });
      return;
    }

    // Resolve model connection
    const { modelParams, llmConnection } = await resolveModelConnection({
      managedModelId: template.managedModelId,
      projectId,
      modelOptions: (template.modelOptions as ModelOptions) ?? undefined,
    });

    // Build messages
    const messages = buildMessages({
      type: template.type,
      promptConfig,
      inputs,
    });

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Execute LLM call with streaming
    const stream = await fetchLLMCompletion({
      messages,
      modelParams,
      llmConnection,
      streaming: true,
    });

    const decoder = new TextDecoder();

    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // Send done event
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    logger.error("Failed to stream task template execution", error);

    // If headers already sent, end the stream with error
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Stream failed" })}\n\n`,
      );
      res.end();
    } else {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}

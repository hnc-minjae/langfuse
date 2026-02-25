/** @jest-environment node */

import {
  makeZodVerifiedAPICall,
  makeAPICall,
} from "@/src/__tests__/test-utils";
import { prisma } from "@langfuse/shared/src/db";
import { randomUUID } from "crypto";
import { createOrgProjectAndApiKey } from "@langfuse/shared/src/server";

import {
  GetTaskTemplatesResponse,
  PostTaskTemplateResponse,
  GetTaskTemplateByIdResponse,
  PutTaskTemplateResponse,
  DeleteTaskTemplateResponse,
} from "@/src/features/public-api/types/task-templates";

const makeChatTemplateBody = (overrides = {}) => ({
  name: `template-${randomUUID().slice(0, 8)}`,
  type: "chat" as const,
  managedModelId: "gpt-4o",
  promptConfig: {
    systemMessage: "You are a helpful assistant.",
    userMessage: "Tell me about {{topic}}",
    inputVariables: ["topic"],
  },
  outputKey: "text",
  labels: [],
  tags: [],
  ...overrides,
});

const makeGeneralTemplateBody = (overrides = {}) => ({
  name: `general-${randomUUID().slice(0, 8)}`,
  type: "general" as const,
  managedModelId: "gpt-4o",
  promptConfig: {
    instruction: "Translate the following to French.",
    inputVariables: ["text"],
    examples: [{ input: "Hello", output: "Bonjour" }],
  },
  outputKey: "translation",
  ...overrides,
});

describe("Task Templates Public API", () => {
  describe("POST /api/public/task-templates", () => {
    it("should create a chat task template with auto-versioning", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();
      const body = makeChatTemplateBody();

      const response = await makeZodVerifiedAPICall(
        PostTaskTemplateResponse,
        "POST",
        "/api/public/task-templates",
        body,
        auth,
        201,
      );

      expect(response.body.name).toBe(body.name);
      expect(response.body.version).toBe(1);
      expect(response.body.type).toBe("chat");
      expect(response.body.projectId).toBe(projectId);
      expect(response.body.managedModelId).toBe("gpt-4o");
    });

    it("should auto-increment version for same name", async () => {
      const { auth } = await createOrgProjectAndApiKey();
      const name = `versioned-${randomUUID().slice(0, 8)}`;

      const v1 = await makeZodVerifiedAPICall(
        PostTaskTemplateResponse,
        "POST",
        "/api/public/task-templates",
        makeChatTemplateBody({ name }),
        auth,
        201,
      );
      expect(v1.body.version).toBe(1);

      const v2 = await makeZodVerifiedAPICall(
        PostTaskTemplateResponse,
        "POST",
        "/api/public/task-templates",
        makeChatTemplateBody({ name }),
        auth,
        201,
      );
      expect(v2.body.version).toBe(2);

      const v3 = await makeZodVerifiedAPICall(
        PostTaskTemplateResponse,
        "POST",
        "/api/public/task-templates",
        makeChatTemplateBody({ name }),
        auth,
        201,
      );
      expect(v3.body.version).toBe(3);
    });

    it("should create a general type template", async () => {
      const { auth } = await createOrgProjectAndApiKey();
      const body = makeGeneralTemplateBody();

      const response = await makeZodVerifiedAPICall(
        PostTaskTemplateResponse,
        "POST",
        "/api/public/task-templates",
        body,
        auth,
        201,
      );

      expect(response.body.type).toBe("general");
      expect(response.body.outputKey).toBe("translation");
    });

    it("should return 401 without auth", async () => {
      const res = await makeAPICall(
        "POST",
        "/api/public/task-templates",
        makeChatTemplateBody(),
        "Basic invalid",
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/public/task-templates", () => {
    it("should list task templates with pagination", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      for (let i = 0; i < 3; i++) {
        await prisma.taskTemplate.create({
          data: {
            projectId,
            name: `list-tmpl-${i}`,
            version: 1,
            type: "chat",
            managedModelId: "gpt-4o",
            promptConfig: {
              systemMessage: "System",
              userMessage: "Hello",
              inputVariables: [],
            },
          },
        });
      }

      const response = await makeZodVerifiedAPICall(
        GetTaskTemplatesResponse,
        "GET",
        "/api/public/task-templates?page=1&limit=2",
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.totalItems).toBe(3);
      expect(response.body.meta.totalPages).toBe(2);
    });

    it("should filter by type", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      await prisma.taskTemplate.create({
        data: {
          projectId,
          name: "chat-tmpl",
          version: 1,
          type: "chat",
          managedModelId: "gpt-4o",
          promptConfig: {
            systemMessage: "S",
            userMessage: "U",
            inputVariables: [],
          },
        },
      });
      await prisma.taskTemplate.create({
        data: {
          projectId,
          name: "general-tmpl",
          version: 1,
          type: "general",
          managedModelId: "gpt-4o",
          promptConfig: {
            instruction: "Do something.",
            inputVariables: [],
          },
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetTaskTemplatesResponse,
        "GET",
        "/api/public/task-templates?typeFilter=general",
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe("general");
    });

    it("should search by name", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();
      const uniqueName = `search-${randomUUID().slice(0, 8)}`;

      await prisma.taskTemplate.create({
        data: {
          projectId,
          name: uniqueName,
          version: 1,
          type: "chat",
          managedModelId: "gpt-4o",
          promptConfig: {
            systemMessage: "S",
            userMessage: "U",
            inputVariables: [],
          },
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetTaskTemplatesResponse,
        "GET",
        `/api/public/task-templates?searchQuery=${uniqueName}`,
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe(uniqueName);
    });
  });

  describe("GET /api/public/task-templates/[id]", () => {
    it("should get a task template by ID", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      const template = await prisma.taskTemplate.create({
        data: {
          projectId,
          name: "get-by-id",
          version: 1,
          type: "chat",
          managedModelId: "gpt-4o",
          promptConfig: {
            systemMessage: "System prompt",
            userMessage: "Hello {{name}}",
            inputVariables: ["name"],
          },
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetTaskTemplateByIdResponse,
        "GET",
        `/api/public/task-templates/${template.id}`,
        undefined,
        auth,
      );

      expect(response.body.id).toBe(template.id);
      expect(response.body.name).toBe("get-by-id");
    });

    it("should return 404 for non-existent template", async () => {
      const { auth } = await createOrgProjectAndApiKey();

      const res = await makeAPICall(
        "GET",
        `/api/public/task-templates/non-existent-id`,
        undefined,
        auth,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/public/task-templates/[id]", () => {
    it("should update a task template", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      const template = await prisma.taskTemplate.create({
        data: {
          projectId,
          name: "update-test",
          version: 1,
          type: "chat",
          managedModelId: "gpt-4o",
          promptConfig: {
            systemMessage: "Old system",
            userMessage: "Old user",
            inputVariables: [],
          },
          labels: ["draft"],
        },
      });

      const response = await makeZodVerifiedAPICall(
        PutTaskTemplateResponse,
        "PUT",
        `/api/public/task-templates/${template.id}`,
        {
          managedModelId: "gpt-4o-mini",
          promptConfig: {
            systemMessage: "New system",
            userMessage: "New user",
            inputVariables: [],
          },
          labels: ["production"],
        },
        auth,
      );

      expect(response.body.managedModelId).toBe("gpt-4o-mini");
      expect(response.body.labels).toEqual(["production"]);
    });

    it("should return 404 for updating non-existent template", async () => {
      const { auth } = await createOrgProjectAndApiKey();

      const res = await makeAPICall(
        "PUT",
        `/api/public/task-templates/non-existent`,
        {
          managedModelId: "gpt-4o",
          promptConfig: {
            systemMessage: "S",
            userMessage: "U",
            inputVariables: [],
          },
        },
        auth,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/public/task-templates/[id]", () => {
    it("should delete a task template", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      const template = await prisma.taskTemplate.create({
        data: {
          projectId,
          name: "delete-test",
          version: 1,
          type: "chat",
          managedModelId: "gpt-4o",
          promptConfig: {
            systemMessage: "S",
            userMessage: "U",
            inputVariables: [],
          },
        },
      });

      const response = await makeZodVerifiedAPICall(
        DeleteTaskTemplateResponse,
        "DELETE",
        `/api/public/task-templates/${template.id}`,
        undefined,
        auth,
      );

      expect(response.body.message).toBe("Task template successfully deleted");

      // Verify it's actually deleted
      const deleted = await prisma.taskTemplate.findUnique({
        where: { id: template.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 for deleting non-existent template", async () => {
      const { auth } = await createOrgProjectAndApiKey();

      const res = await makeAPICall(
        "DELETE",
        `/api/public/task-templates/non-existent`,
        undefined,
        auth,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Tenant isolation", () => {
    it("should not allow accessing templates from another project", async () => {
      const project1 = await createOrgProjectAndApiKey();
      const project2 = await createOrgProjectAndApiKey();

      const template = await prisma.taskTemplate.create({
        data: {
          projectId: project1.projectId,
          name: "isolated",
          version: 1,
          type: "chat",
          managedModelId: "gpt-4o",
          promptConfig: {
            systemMessage: "S",
            userMessage: "U",
            inputVariables: [],
          },
        },
      });

      // Project 2 should not see project 1's template
      const res = await makeAPICall(
        "GET",
        `/api/public/task-templates/${template.id}`,
        undefined,
        project2.auth,
      );
      expect(res.status).toBe(404);
    });

    it("should not list templates from another project", async () => {
      const project1 = await createOrgProjectAndApiKey();
      const project2 = await createOrgProjectAndApiKey();

      await prisma.taskTemplate.create({
        data: {
          projectId: project1.projectId,
          name: "project1-only",
          version: 1,
          type: "chat",
          managedModelId: "gpt-4o",
          promptConfig: {
            systemMessage: "S",
            userMessage: "U",
            inputVariables: [],
          },
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetTaskTemplatesResponse,
        "GET",
        "/api/public/task-templates",
        undefined,
        project2.auth,
      );

      expect(response.body.data).toHaveLength(0);
    });
  });
});

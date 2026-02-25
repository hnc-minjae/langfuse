/** @jest-environment node */

import {
  makeZodVerifiedAPICall,
  makeAPICall,
} from "@/src/__tests__/test-utils";
import { prisma } from "@langfuse/shared/src/db";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import {
  createOrgProjectAndApiKey,
  createBasicAuthHeader,
} from "@langfuse/shared/src/server";

import {
  GetManagedModelsResponse,
  PostManagedModelResponse,
  GetManagedModelByIdResponse,
  PutManagedModelResponse,
  DeleteManagedModelResponse,
  PostBulkManagedModelsResponse,
} from "@/src/features/public-api/types/managed-models";

const makeModelBody = (overrides = {}) => ({
  modelId: `model-${randomUUID().slice(0, 8)}`,
  displayName: "Test Model",
  brand: "TestBrand",
  brandDisplayName: "Test Brand",
  maxInputTokenSize: 4096,
  maxOutputTokenSize: 2048,
  contextWindowSize: 8192,
  isSupported: true,
  sortOrder: 1,
  ...overrides,
});

describe("Managed Models Public API", () => {
  describe("POST /api/public/managed-models", () => {
    it("should create a managed model", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();
      const body = makeModelBody();

      const response = await makeZodVerifiedAPICall(
        PostManagedModelResponse,
        "POST",
        "/api/public/managed-models",
        body,
        auth,
        201,
      );

      expect(response.body.modelId).toBe(body.modelId);
      expect(response.body.projectId).toBe(projectId);
      expect(response.body.displayName).toBe("Test Model");
    });

    it("should return 400 for duplicate modelId", async () => {
      const { auth } = await createOrgProjectAndApiKey();
      const body = makeModelBody();

      await makeZodVerifiedAPICall(
        PostManagedModelResponse,
        "POST",
        "/api/public/managed-models",
        body,
        auth,
        201,
      );

      const res = await makeAPICall(
        "POST",
        "/api/public/managed-models",
        body,
        auth,
      );
      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const res = await makeAPICall(
        "POST",
        "/api/public/managed-models",
        makeModelBody(),
        "Basic invalid",
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/public/managed-models", () => {
    it("should list managed models with pagination", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      for (let i = 0; i < 3; i++) {
        await prisma.managedModel.create({
          data: {
            projectId,
            modelId: `list-model-${randomUUID().slice(0, 8)}`,
            displayName: `Model ${i}`,
            brand: "TestBrand",
            brandDisplayName: "Test Brand",
            isSupported: true,
            sortOrder: i,
          },
        });
      }

      const response = await makeZodVerifiedAPICall(
        GetManagedModelsResponse,
        "GET",
        "/api/public/managed-models?page=1&limit=2",
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.totalItems).toBe(3);
      expect(response.body.meta.totalPages).toBe(2);
      expect(response.body.meta.page).toBe(1);
    });

    it("should filter by search query", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();
      const unique = randomUUID().slice(0, 8);

      await prisma.managedModel.create({
        data: {
          projectId,
          modelId: `searchable-${unique}`,
          displayName: `Searchable ${unique}`,
          brand: "BrandA",
          brandDisplayName: "Brand A",
          isSupported: true,
          sortOrder: 0,
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetManagedModelsResponse,
        "GET",
        `/api/public/managed-models?searchQuery=${unique}`,
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].modelId).toContain(unique);
    });

    it("should filter by brand", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();
      const uniqueBrand = `Brand-${randomUUID().slice(0, 8)}`;

      await prisma.managedModel.create({
        data: {
          projectId,
          modelId: `brand-model-${randomUUID().slice(0, 8)}`,
          displayName: "Brand Model",
          brand: uniqueBrand,
          brandDisplayName: uniqueBrand,
          isSupported: true,
          sortOrder: 0,
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetManagedModelsResponse,
        "GET",
        `/api/public/managed-models?brandFilter=${uniqueBrand}`,
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].brand).toBe(uniqueBrand);
    });

    it("should not return models from other projects (tenant isolation)", async () => {
      const { auth: auth1, projectId: proj1 } =
        await createOrgProjectAndApiKey();
      const { auth: auth2 } = await createOrgProjectAndApiKey();

      await prisma.managedModel.create({
        data: {
          projectId: proj1,
          modelId: `isolated-${randomUUID().slice(0, 8)}`,
          displayName: "Isolated Model",
          brand: "IsolatedBrand",
          brandDisplayName: "Isolated Brand",
          isSupported: true,
          sortOrder: 0,
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetManagedModelsResponse,
        "GET",
        "/api/public/managed-models",
        undefined,
        auth2,
      );

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/public/managed-models/[id]", () => {
    it("should get a model by ID", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      const model = await prisma.managedModel.create({
        data: {
          projectId,
          modelId: `get-by-id-${randomUUID().slice(0, 8)}`,
          displayName: "Get By Id Model",
          brand: "TestBrand",
          brandDisplayName: "Test Brand",
          isSupported: true,
          sortOrder: 0,
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetManagedModelByIdResponse,
        "GET",
        `/api/public/managed-models/${model.id}`,
        undefined,
        auth,
      );

      expect(response.body.id).toBe(model.id);
      expect(response.body.displayName).toBe("Get By Id Model");
    });

    it("should return 404 for non-existent model", async () => {
      const { auth } = await createOrgProjectAndApiKey();

      const res = await makeAPICall(
        "GET",
        `/api/public/managed-models/${randomUUID()}`,
        undefined,
        auth,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/public/managed-models/[id]", () => {
    it("should update a managed model", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      const model = await prisma.managedModel.create({
        data: {
          projectId,
          modelId: `update-${randomUUID().slice(0, 8)}`,
          displayName: "Original Name",
          brand: "OldBrand",
          brandDisplayName: "Old Brand",
          isSupported: true,
          sortOrder: 0,
        },
      });

      const updateBody = makeModelBody({
        modelId: model.modelId,
        displayName: "Updated Name",
        brand: "NewBrand",
        brandDisplayName: "New Brand",
      });

      const response = await makeZodVerifiedAPICall(
        PutManagedModelResponse,
        "PUT",
        `/api/public/managed-models/${model.id}`,
        updateBody,
        auth,
      );

      expect(response.body.displayName).toBe("Updated Name");
      expect(response.body.brand).toBe("NewBrand");
    });
  });

  describe("DELETE /api/public/managed-models/[id]", () => {
    it("should delete a managed model", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();

      const model = await prisma.managedModel.create({
        data: {
          projectId,
          modelId: `delete-${randomUUID().slice(0, 8)}`,
          displayName: "To Delete",
          brand: "TestBrand",
          brandDisplayName: "Test Brand",
          isSupported: true,
          sortOrder: 0,
        },
      });

      const response = await makeZodVerifiedAPICall(
        DeleteManagedModelResponse,
        "DELETE",
        `/api/public/managed-models/${model.id}`,
        undefined,
        auth,
      );

      expect(response.body.message).toBe("Managed model successfully deleted");

      const deleted = await prisma.managedModel.findUnique({
        where: { id: model.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe("POST /api/public/managed-models/bulk", () => {
    it("should bulk upsert managed models", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();
      const modelId1 = `bulk-${randomUUID().slice(0, 8)}`;
      const modelId2 = `bulk-${randomUUID().slice(0, 8)}`;

      const response = await makeZodVerifiedAPICall(
        PostBulkManagedModelsResponse,
        "POST",
        "/api/public/managed-models/bulk",
        {
          models: [
            makeModelBody({ modelId: modelId1, sortOrder: 1 }),
            makeModelBody({ modelId: modelId2, sortOrder: 2 }),
          ],
        },
        auth,
        201,
      );

      expect(response.body.count).toBe(2);

      const models = await prisma.managedModel.findMany({
        where: { projectId, modelId: { in: [modelId1, modelId2] } },
      });
      expect(models).toHaveLength(2);
    });

    it("should update existing models on bulk upsert", async () => {
      const { auth, projectId } = await createOrgProjectAndApiKey();
      const modelId = `bulk-upsert-${randomUUID().slice(0, 8)}`;

      await prisma.managedModel.create({
        data: {
          projectId,
          modelId,
          displayName: "Original",
          brand: "TestBrand",
          brandDisplayName: "Test Brand",
          isSupported: true,
          sortOrder: 0,
        },
      });

      await makeZodVerifiedAPICall(
        PostBulkManagedModelsResponse,
        "POST",
        "/api/public/managed-models/bulk",
        {
          models: [makeModelBody({ modelId, displayName: "Updated" })],
        },
        auth,
        201,
      );

      const model = await prisma.managedModel.findFirst({
        where: { projectId, modelId },
      });
      expect(model?.displayName).toBe("Updated");
    });
  });
});

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
  createAndAddApiKeysToDb,
} from "@langfuse/shared/src/server";

import {
  GetStringResourcesResponse,
  GetStringResourceCategoriesResponse,
  GetStringResourceLocalesResponse,
  PostStringResourceResponse,
  GetStringResourceByIdResponse,
  PutStringResourceResponse,
  DeleteStringResourceResponse,
  PostBulkStringResourcesResponse,
} from "@/src/features/public-api/types/string-resources";

async function createOrgAuth() {
  const { orgId, org } = await createOrgProjectAndApiKey();
  const publicKey = `pk-${randomUUID()}`;
  const secretKey = `sk-${randomUUID()}`;

  await createAndAddApiKeysToDb({
    prisma,
    entityId: orgId,
    scope: "ORGANIZATION",
    predefinedKeys: { publicKey, secretKey },
  });

  const auth = createBasicAuthHeader(publicKey, secretKey);
  return { orgId, auth };
}

describe("String Resources Public API", () => {
  describe("POST /api/public/organizations/string-resources", () => {
    it("should create a string resource", async () => {
      const { orgId, auth } = await createOrgAuth();

      const body = {
        category: "labels",
        key: `test-key-${randomUUID().slice(0, 8)}`,
        locale: "en",
        value: "Hello World",
      };

      const response = await makeZodVerifiedAPICall(
        PostStringResourceResponse,
        "POST",
        "/api/public/organizations/string-resources",
        body,
        auth,
        201,
      );

      expect(response.body.orgId).toBe(orgId);
      expect(response.body.category).toBe("labels");
      expect(response.body.value).toBe("Hello World");
    });

    it("should return 400 for duplicate resource", async () => {
      const { auth } = await createOrgAuth();
      const body = {
        category: "labels",
        key: `dup-key-${randomUUID().slice(0, 8)}`,
        locale: "en",
        value: "First",
      };

      await makeZodVerifiedAPICall(
        PostStringResourceResponse,
        "POST",
        "/api/public/organizations/string-resources",
        body,
        auth,
        201,
      );

      const res = await makeAPICall(
        "POST",
        "/api/public/organizations/string-resources",
        body,
        auth,
      );
      expect(res.status).toBe(400);
    });

    it("should return 401 with project-scoped key", async () => {
      const { auth } = await createOrgProjectAndApiKey();

      const res = await makeAPICall(
        "POST",
        "/api/public/organizations/string-resources",
        {
          category: "labels",
          key: "test",
          locale: "en",
          value: "test",
        },
        auth,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/public/organizations/string-resources", () => {
    it("should list string resources with pagination", async () => {
      const { orgId, auth } = await createOrgAuth();

      for (let i = 0; i < 3; i++) {
        await prisma.stringResource.create({
          data: {
            orgId,
            category: "labels",
            key: `list-key-${randomUUID().slice(0, 8)}`,
            locale: "en",
            value: `Value ${i}`,
          },
        });
      }

      const response = await makeZodVerifiedAPICall(
        GetStringResourcesResponse,
        "GET",
        "/api/public/organizations/string-resources?page=1&limit=2",
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.totalItems).toBe(3);
      expect(response.body.meta.totalPages).toBe(2);
    });

    it("should filter by category and locale", async () => {
      const { orgId, auth } = await createOrgAuth();
      const uniqueCategory = `cat-${randomUUID().slice(0, 8)}`;

      await prisma.stringResource.create({
        data: {
          orgId,
          category: uniqueCategory,
          key: "filtered-key",
          locale: "ko",
          value: "Korean Value",
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetStringResourcesResponse,
        "GET",
        `/api/public/organizations/string-resources?categoryFilter=${uniqueCategory}&localeFilter=ko`,
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe(uniqueCategory);
      expect(response.body.data[0].locale).toBe("ko");
    });

    it("should not return resources from other orgs (tenant isolation)", async () => {
      const { orgId: orgId1 } = await createOrgAuth();
      const { auth: auth2 } = await createOrgAuth();

      await prisma.stringResource.create({
        data: {
          orgId: orgId1,
          category: "isolated",
          key: `isolated-${randomUUID().slice(0, 8)}`,
          locale: "en",
          value: "Should not see",
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetStringResourcesResponse,
        "GET",
        "/api/public/organizations/string-resources",
        undefined,
        auth2,
      );

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/public/organizations/string-resources/categories", () => {
    it("should return distinct categories", async () => {
      const { orgId, auth } = await createOrgAuth();
      const cat1 = `cat-a-${randomUUID().slice(0, 8)}`;
      const cat2 = `cat-b-${randomUUID().slice(0, 8)}`;

      await prisma.stringResource.createMany({
        data: [
          { orgId, category: cat1, key: "k1", locale: "en", value: "v1" },
          { orgId, category: cat2, key: "k2", locale: "en", value: "v2" },
          { orgId, category: cat1, key: "k3", locale: "ko", value: "v3" },
        ],
      });

      const response = await makeZodVerifiedAPICall(
        GetStringResourceCategoriesResponse,
        "GET",
        "/api/public/organizations/string-resources/categories",
        undefined,
        auth,
      );

      expect(response.body.data).toContain(cat1);
      expect(response.body.data).toContain(cat2);
    });
  });

  describe("GET /api/public/organizations/string-resources/locales", () => {
    it("should return distinct locales", async () => {
      const { orgId, auth } = await createOrgAuth();
      const uniqueKey = randomUUID().slice(0, 8);

      await prisma.stringResource.createMany({
        data: [
          {
            orgId,
            category: "test",
            key: `locale-${uniqueKey}-1`,
            locale: "en",
            value: "v1",
          },
          {
            orgId,
            category: "test",
            key: `locale-${uniqueKey}-2`,
            locale: "ko",
            value: "v2",
          },
        ],
      });

      const response = await makeZodVerifiedAPICall(
        GetStringResourceLocalesResponse,
        "GET",
        "/api/public/organizations/string-resources/locales",
        undefined,
        auth,
      );

      expect(response.body.data).toContain("en");
      expect(response.body.data).toContain("ko");
    });
  });

  describe("GET /api/public/organizations/string-resources/[id]", () => {
    it("should get a resource by ID", async () => {
      const { orgId, auth } = await createOrgAuth();

      const resource = await prisma.stringResource.create({
        data: {
          orgId,
          category: "labels",
          key: `by-id-${randomUUID().slice(0, 8)}`,
          locale: "en",
          value: "Found it",
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetStringResourceByIdResponse,
        "GET",
        `/api/public/organizations/string-resources/${resource.id}`,
        undefined,
        auth,
      );

      expect(response.body.id).toBe(resource.id);
      expect(response.body.value).toBe("Found it");
    });

    it("should return 404 for non-existent resource", async () => {
      const { auth } = await createOrgAuth();

      const res = await makeAPICall(
        "GET",
        `/api/public/organizations/string-resources/${randomUUID()}`,
        undefined,
        auth,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/public/organizations/string-resources/[id]", () => {
    it("should update value of a string resource", async () => {
      const { orgId, auth } = await createOrgAuth();

      const resource = await prisma.stringResource.create({
        data: {
          orgId,
          category: "labels",
          key: `update-${randomUUID().slice(0, 8)}`,
          locale: "en",
          value: "Old Value",
        },
      });

      const response = await makeZodVerifiedAPICall(
        PutStringResourceResponse,
        "PUT",
        `/api/public/organizations/string-resources/${resource.id}`,
        { value: "New Value" },
        auth,
      );

      expect(response.body.value).toBe("New Value");
      expect(response.body.category).toBe("labels");
    });
  });

  describe("DELETE /api/public/organizations/string-resources/[id]", () => {
    it("should delete a string resource", async () => {
      const { orgId, auth } = await createOrgAuth();

      const resource = await prisma.stringResource.create({
        data: {
          orgId,
          category: "labels",
          key: `delete-${randomUUID().slice(0, 8)}`,
          locale: "en",
          value: "To delete",
        },
      });

      const response = await makeZodVerifiedAPICall(
        DeleteStringResourceResponse,
        "DELETE",
        `/api/public/organizations/string-resources/${resource.id}`,
        undefined,
        auth,
      );

      expect(response.body.message).toBe(
        "String resource successfully deleted",
      );

      const deleted = await prisma.stringResource.findUnique({
        where: { id: resource.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe("POST /api/public/organizations/string-resources/bulk", () => {
    it("should bulk upsert string resources", async () => {
      const { orgId, auth } = await createOrgAuth();
      const uniqueKey1 = `bulk-${randomUUID().slice(0, 8)}`;
      const uniqueKey2 = `bulk-${randomUUID().slice(0, 8)}`;

      const response = await makeZodVerifiedAPICall(
        PostBulkStringResourcesResponse,
        "POST",
        "/api/public/organizations/string-resources/bulk",
        {
          resources: [
            {
              category: "labels",
              key: uniqueKey1,
              locale: "en",
              value: "Value 1",
            },
            {
              category: "labels",
              key: uniqueKey2,
              locale: "en",
              value: "Value 2",
            },
          ],
        },
        auth,
        201,
      );

      expect(response.body.count).toBe(2);
    });

    it("should update existing resources on bulk upsert", async () => {
      const { orgId, auth } = await createOrgAuth();
      const uniqueKey = `bulk-up-${randomUUID().slice(0, 8)}`;

      await prisma.stringResource.create({
        data: {
          orgId,
          category: "labels",
          key: uniqueKey,
          locale: "en",
          value: "Original",
        },
      });

      await makeZodVerifiedAPICall(
        PostBulkStringResourcesResponse,
        "POST",
        "/api/public/organizations/string-resources/bulk",
        {
          resources: [
            {
              category: "labels",
              key: uniqueKey,
              locale: "en",
              value: "Updated",
            },
          ],
        },
        auth,
        201,
      );

      const resource = await prisma.stringResource.findFirst({
        where: { orgId, key: uniqueKey, locale: "en" },
      });
      expect(resource?.value).toBe("Updated");
    });
  });
});

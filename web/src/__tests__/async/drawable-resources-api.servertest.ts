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
  GetDrawableResourcesResponse,
  GetDrawableResourceLocalesResponse,
  GetDrawableResourceByIdResponse,
  PostDrawableResourceResponse,
  PutDrawableResourceResponse,
  DeleteDrawableResourceResponse,
  PostBulkDrawableResourcesResponse,
} from "@/src/features/public-api/types/drawable-resources";

async function createOrgAuth() {
  const { orgId } = await createOrgProjectAndApiKey();
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

const sampleContent = Buffer.from("test-image-data").toString("base64");

describe("Drawable Resources Public API", () => {
  describe("POST /api/public/organizations/drawable-resources", () => {
    it("should create a drawable resource", async () => {
      const { orgId, auth } = await createOrgAuth();

      const body = {
        filename: `icon-${randomUUID().slice(0, 8)}.png`,
        locale: "en",
        contentType: "image/png",
        content: sampleContent,
      };

      const response = await makeZodVerifiedAPICall(
        PostDrawableResourceResponse,
        "POST",
        "/api/public/organizations/drawable-resources",
        body,
        auth,
        201,
      );

      expect(response.body.orgId).toBe(orgId);
      expect(response.body.filename).toBe(body.filename);
      expect(response.body.content).toBe(sampleContent);
    });

    it("should return 400 for duplicate filename+locale", async () => {
      const { auth } = await createOrgAuth();
      const body = {
        filename: `dup-${randomUUID().slice(0, 8)}.png`,
        locale: "en",
        contentType: "image/png",
        content: sampleContent,
      };

      await makeZodVerifiedAPICall(
        PostDrawableResourceResponse,
        "POST",
        "/api/public/organizations/drawable-resources",
        body,
        auth,
        201,
      );

      const res = await makeAPICall(
        "POST",
        "/api/public/organizations/drawable-resources",
        body,
        auth,
      );
      expect(res.status).toBe(400);
    });

    it("should return 401 with project-scoped key", async () => {
      const { auth } = await createOrgProjectAndApiKey();

      const res = await makeAPICall(
        "POST",
        "/api/public/organizations/drawable-resources",
        {
          filename: "test.png",
          locale: "en",
          contentType: "image/png",
          content: sampleContent,
        },
        auth,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/public/organizations/drawable-resources", () => {
    it("should list drawable resources without content", async () => {
      const { orgId, auth } = await createOrgAuth();

      await prisma.drawableResource.create({
        data: {
          orgId,
          filename: `list-${randomUUID().slice(0, 8)}.png`,
          locale: "en",
          contentType: "image/png",
          content: sampleContent,
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetDrawableResourcesResponse,
        "GET",
        "/api/public/organizations/drawable-resources",
        undefined,
        auth,
      );

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      // content should NOT be in list response
      expect((response.body.data[0] as any).content).toBeUndefined();
    });

    it("should filter by locale", async () => {
      const { orgId, auth } = await createOrgAuth();

      await prisma.drawableResource.createMany({
        data: [
          {
            orgId,
            filename: `locale-${randomUUID().slice(0, 8)}.png`,
            locale: "en",
            contentType: "image/png",
            content: sampleContent,
          },
          {
            orgId,
            filename: `locale-${randomUUID().slice(0, 8)}.png`,
            locale: "ko",
            contentType: "image/png",
            content: sampleContent,
          },
        ],
      });

      const response = await makeZodVerifiedAPICall(
        GetDrawableResourcesResponse,
        "GET",
        "/api/public/organizations/drawable-resources?localeFilter=ko",
        undefined,
        auth,
      );

      response.body.data.forEach((r: { locale: string }) =>
        expect(r.locale).toBe("ko"),
      );
    });

    it("should not return resources from other orgs (tenant isolation)", async () => {
      const { orgId: orgId1 } = await createOrgAuth();
      const { auth: auth2 } = await createOrgAuth();

      await prisma.drawableResource.create({
        data: {
          orgId: orgId1,
          filename: `isolated-${randomUUID().slice(0, 8)}.png`,
          locale: "en",
          contentType: "image/png",
          content: sampleContent,
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetDrawableResourcesResponse,
        "GET",
        "/api/public/organizations/drawable-resources",
        undefined,
        auth2,
      );

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/public/organizations/drawable-resources/locales", () => {
    it("should return distinct locales", async () => {
      const { orgId, auth } = await createOrgAuth();

      await prisma.drawableResource.createMany({
        data: [
          {
            orgId,
            filename: `loc-${randomUUID().slice(0, 8)}.png`,
            locale: "en",
            contentType: "image/png",
            content: sampleContent,
          },
          {
            orgId,
            filename: `loc-${randomUUID().slice(0, 8)}.png`,
            locale: "ja",
            contentType: "image/png",
            content: sampleContent,
          },
        ],
      });

      const response = await makeZodVerifiedAPICall(
        GetDrawableResourceLocalesResponse,
        "GET",
        "/api/public/organizations/drawable-resources/locales",
        undefined,
        auth,
      );

      expect(response.body.data).toContain("en");
      expect(response.body.data).toContain("ja");
    });
  });

  describe("GET /api/public/organizations/drawable-resources/[id]", () => {
    it("should get a resource by ID with content", async () => {
      const { orgId, auth } = await createOrgAuth();

      const resource = await prisma.drawableResource.create({
        data: {
          orgId,
          filename: `by-id-${randomUUID().slice(0, 8)}.png`,
          locale: "en",
          contentType: "image/png",
          content: sampleContent,
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetDrawableResourceByIdResponse,
        "GET",
        `/api/public/organizations/drawable-resources/${resource.id}`,
        undefined,
        auth,
      );

      expect(response.body.id).toBe(resource.id);
      expect(response.body.content).toBe(sampleContent);
    });

    it("should return 404 for non-existent resource", async () => {
      const { auth } = await createOrgAuth();

      const res = await makeAPICall(
        "GET",
        `/api/public/organizations/drawable-resources/${randomUUID()}`,
        undefined,
        auth,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/public/organizations/drawable-resources/[id]", () => {
    it("should update a drawable resource", async () => {
      const { orgId, auth } = await createOrgAuth();

      const resource = await prisma.drawableResource.create({
        data: {
          orgId,
          filename: `update-${randomUUID().slice(0, 8)}.png`,
          locale: "en",
          contentType: "image/png",
          content: sampleContent,
        },
      });

      const newContent = Buffer.from("updated-image-data").toString("base64");

      const response = await makeZodVerifiedAPICall(
        PutDrawableResourceResponse,
        "PUT",
        `/api/public/organizations/drawable-resources/${resource.id}`,
        { contentType: "image/jpeg", content: newContent },
        auth,
      );

      expect(response.body.contentType).toBe("image/jpeg");
      expect(response.body.content).toBe(newContent);
    });
  });

  describe("DELETE /api/public/organizations/drawable-resources/[id]", () => {
    it("should delete a drawable resource", async () => {
      const { orgId, auth } = await createOrgAuth();

      const resource = await prisma.drawableResource.create({
        data: {
          orgId,
          filename: `del-${randomUUID().slice(0, 8)}.png`,
          locale: "en",
          contentType: "image/png",
          content: sampleContent,
        },
      });

      const response = await makeZodVerifiedAPICall(
        DeleteDrawableResourceResponse,
        "DELETE",
        `/api/public/organizations/drawable-resources/${resource.id}`,
        undefined,
        auth,
      );

      expect(response.body.message).toBe(
        "Drawable resource successfully deleted",
      );

      const deleted = await prisma.drawableResource.findUnique({
        where: { id: resource.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe("POST /api/public/organizations/drawable-resources/bulk", () => {
    it("should bulk upsert drawable resources", async () => {
      const { orgId, auth } = await createOrgAuth();

      const response = await makeZodVerifiedAPICall(
        PostBulkDrawableResourcesResponse,
        "POST",
        "/api/public/organizations/drawable-resources/bulk",
        {
          resources: [
            {
              filename: `bulk-${randomUUID().slice(0, 8)}.png`,
              locale: "en",
              contentType: "image/png",
              content: sampleContent,
            },
            {
              filename: `bulk-${randomUUID().slice(0, 8)}.png`,
              locale: "ko",
              contentType: "image/png",
              content: sampleContent,
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
      const filename = `bulk-up-${randomUUID().slice(0, 8)}.png`;

      await prisma.drawableResource.create({
        data: {
          orgId,
          filename,
          locale: "en",
          contentType: "image/png",
          content: sampleContent,
        },
      });

      const newContent = Buffer.from("bulk-updated").toString("base64");

      await makeZodVerifiedAPICall(
        PostBulkDrawableResourcesResponse,
        "POST",
        "/api/public/organizations/drawable-resources/bulk",
        {
          resources: [
            {
              filename,
              locale: "en",
              contentType: "image/jpeg",
              content: newContent,
            },
          ],
        },
        auth,
        201,
      );

      const resource = await prisma.drawableResource.findFirst({
        where: { orgId, filename, locale: "en" },
      });
      expect(resource?.contentType).toBe("image/jpeg");
      expect(resource?.content).toBe(newContent);
    });
  });
});

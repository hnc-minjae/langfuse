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
  GetMenuTemplateProductsResponse,
  GetMenuTemplateVersionsResponse,
  GetMenuTemplateByIdResponse,
  PostMenuTemplateResponse,
  PatchMenuTemplateLabelsResponse,
  DeleteMenuTemplateResponse,
} from "@/src/features/public-api/types/menu-templates";

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

describe("Menu Templates Public API", () => {
  describe("POST /api/public/organizations/menu-templates", () => {
    it("should create a menu template with auto-increment version", async () => {
      const { orgId, auth } = await createOrgAuth();
      const product = `product-${randomUUID().slice(0, 8)}`;

      const response = await makeZodVerifiedAPICall(
        PostMenuTemplateResponse,
        "POST",
        "/api/public/organizations/menu-templates",
        {
          product,
          content: { menu: [{ id: 1, name: "Item 1" }] },
          labels: ["latest"],
          commitMessage: "Initial version",
        },
        auth,
        201,
      );

      expect(response.body.orgId).toBe(orgId);
      expect(response.body.product).toBe(product);
      expect(response.body.version).toBe(1);
      expect(response.body.labels).toContain("latest");
    });

    it("should auto-increment version for same product", async () => {
      const { orgId, auth } = await createOrgAuth();
      const product = `product-${randomUUID().slice(0, 8)}`;

      await makeZodVerifiedAPICall(
        PostMenuTemplateResponse,
        "POST",
        "/api/public/organizations/menu-templates",
        { product, content: { v: 1 } },
        auth,
        201,
      );

      const response = await makeZodVerifiedAPICall(
        PostMenuTemplateResponse,
        "POST",
        "/api/public/organizations/menu-templates",
        { product, content: { v: 2 } },
        auth,
        201,
      );

      expect(response.body.version).toBe(2);
    });

    it("should return 401 with project-scoped key", async () => {
      const { auth } = await createOrgProjectAndApiKey();

      const res = await makeAPICall(
        "POST",
        "/api/public/organizations/menu-templates",
        { product: "test", content: {} },
        auth,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/public/organizations/menu-templates/products", () => {
    it("should list products with version info", async () => {
      const { orgId, auth } = await createOrgAuth();
      const product = `product-${randomUUID().slice(0, 8)}`;

      await prisma.menuTemplate.createMany({
        data: [
          {
            orgId,
            product,
            version: 1,
            content: { v: 1 },
            labels: ["v1"],
          },
          {
            orgId,
            product,
            version: 2,
            content: { v: 2 },
            labels: ["latest"],
          },
        ],
      });

      const response = await makeZodVerifiedAPICall(
        GetMenuTemplateProductsResponse,
        "GET",
        "/api/public/organizations/menu-templates/products",
        undefined,
        auth,
      );

      const found = response.body.data.find(
        (p: { product: string }) => p.product === product,
      );
      expect(found).toBeDefined();
      expect(found!.latestVersion).toBe(2);
      expect(found!.versionCount).toBe(2);
    });

    it("should not return products from other orgs", async () => {
      const { orgId: orgId1 } = await createOrgAuth();
      const { auth: auth2 } = await createOrgAuth();

      await prisma.menuTemplate.create({
        data: {
          orgId: orgId1,
          product: `isolated-${randomUUID().slice(0, 8)}`,
          version: 1,
          content: {},
          labels: [],
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetMenuTemplateProductsResponse,
        "GET",
        "/api/public/organizations/menu-templates/products",
        undefined,
        auth2,
      );

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/public/organizations/menu-templates/products/[product]/versions", () => {
    it("should list versions for a product with pagination", async () => {
      const { orgId, auth } = await createOrgAuth();
      const product = `product-${randomUUID().slice(0, 8)}`;

      for (let i = 1; i <= 3; i++) {
        await prisma.menuTemplate.create({
          data: {
            orgId,
            product,
            version: i,
            content: { v: i },
            labels: i === 3 ? ["latest"] : [],
          },
        });
      }

      const response = await makeZodVerifiedAPICall(
        GetMenuTemplateVersionsResponse,
        "GET",
        `/api/public/organizations/menu-templates/products/${product}/versions?page=1&limit=2`,
        undefined,
        auth,
      );

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.totalItems).toBe(3);
      // Ordered desc, so first is version 3
      expect(response.body.data[0].version).toBe(3);
    });
  });

  describe("GET /api/public/organizations/menu-templates/[id]", () => {
    it("should get a template by ID with full content", async () => {
      const { orgId, auth } = await createOrgAuth();

      const template = await prisma.menuTemplate.create({
        data: {
          orgId,
          product: `prod-${randomUUID().slice(0, 8)}`,
          version: 1,
          content: { menu: [{ id: 1, name: "Latte" }] },
          labels: ["latest"],
          commitMessage: "Add latte",
        },
      });

      const response = await makeZodVerifiedAPICall(
        GetMenuTemplateByIdResponse,
        "GET",
        `/api/public/organizations/menu-templates/${template.id}`,
        undefined,
        auth,
      );

      expect(response.body.id).toBe(template.id);
      expect(response.body.content).toEqual({
        menu: [{ id: 1, name: "Latte" }],
      });
      expect(response.body.commitMessage).toBe("Add latte");
    });

    it("should return 404 for non-existent template", async () => {
      const { auth } = await createOrgAuth();

      const res = await makeAPICall(
        "GET",
        `/api/public/organizations/menu-templates/${randomUUID()}`,
        undefined,
        auth,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/public/organizations/menu-templates/[id]/labels", () => {
    it("should update labels of a template", async () => {
      const { orgId, auth } = await createOrgAuth();

      const template = await prisma.menuTemplate.create({
        data: {
          orgId,
          product: `prod-${randomUUID().slice(0, 8)}`,
          version: 1,
          content: {},
          labels: ["draft"],
        },
      });

      const response = await makeZodVerifiedAPICall(
        PatchMenuTemplateLabelsResponse,
        "PATCH",
        `/api/public/organizations/menu-templates/${template.id}/labels`,
        { labels: ["production", "latest"] },
        auth,
      );

      expect(response.body.labels).toEqual(["production", "latest"]);
    });

    it("should return 404 for non-existent template", async () => {
      const { auth } = await createOrgAuth();

      const res = await makeAPICall(
        "PATCH",
        `/api/public/organizations/menu-templates/${randomUUID()}/labels`,
        { labels: ["test"] },
        auth,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/public/organizations/menu-templates/[id]", () => {
    it("should delete a menu template", async () => {
      const { orgId, auth } = await createOrgAuth();

      const template = await prisma.menuTemplate.create({
        data: {
          orgId,
          product: `del-${randomUUID().slice(0, 8)}`,
          version: 1,
          content: {},
          labels: [],
        },
      });

      const response = await makeZodVerifiedAPICall(
        DeleteMenuTemplateResponse,
        "DELETE",
        `/api/public/organizations/menu-templates/${template.id}`,
        undefined,
        auth,
      );

      expect(response.body.message).toBe("Menu template successfully deleted");

      const deleted = await prisma.menuTemplate.findUnique({
        where: { id: template.id },
      });
      expect(deleted).toBeNull();
    });
  });
});

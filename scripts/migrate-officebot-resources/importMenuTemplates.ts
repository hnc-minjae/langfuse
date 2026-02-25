import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import type { MenuTemplateFile, OrgMapping } from "./types";

const SPECIAL_FILES: Record<string, string> = {
  "translation.json": "_translation",
  "sampleprompts.json": "_sampleprompts",
};

function parseFilename(
  filename: string,
): { product: string; version: number } | null {
  // Handle special files
  if (SPECIAL_FILES[filename]) {
    return { product: SPECIAL_FILES[filename], version: 1 };
  }

  // Parse format: assistanthwp_1.6.0.json → product=assistanthwp, version=6
  const match = filename.match(/^(.+?)_(\d+)\.(\d+)\.\d+\.json$/);
  if (!match) return null;

  return {
    product: match[1],
    version: parseInt(match[3], 10), // Use minor version as the version number
  };
}

export async function importMenuTemplates(params: {
  prisma: PrismaClient;
  sourcePath: string;
  orgMappings: OrgMapping[];
  dryRun: boolean;
}) {
  const { prisma, sourcePath, orgMappings, dryRun } = params;
  const templatesDir = path.join(sourcePath, "res", "templates");

  if (!fs.existsSync(templatesDir)) {
    console.log(`Templates directory not found: ${templatesDir}`);
    return;
  }

  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} template files`);

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) {
      console.warn(`Skipping unrecognized file: ${file}`);
      continue;
    }

    const content: MenuTemplateFile = JSON.parse(
      fs.readFileSync(path.join(templatesDir, file), "utf-8"),
    );

    // Find which orgs should get this template
    for (const mapping of orgMappings) {
      if (
        !mapping.products.includes(parsed.product) &&
        !parsed.product.startsWith("_")
      ) {
        continue;
      }

      console.log(
        `${dryRun ? "[DRY RUN] " : ""}Importing ${file} → org ${mapping.orgId} (product=${parsed.product}, version=${parsed.version})`,
      );

      if (!dryRun) {
        await prisma.menuTemplate.upsert({
          where: {
            orgId_product_version: {
              orgId: mapping.orgId,
              product: parsed.product,
              version: parsed.version,
            },
          },
          create: {
            orgId: mapping.orgId,
            product: parsed.product,
            version: parsed.version,
            content: content as any,
            labels: ["imported"],
            commitMessage: `Imported from ${file}`,
          },
          update: {
            content: content as any,
          },
        });
      }
    }
  }
}

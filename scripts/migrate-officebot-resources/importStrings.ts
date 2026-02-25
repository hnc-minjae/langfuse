import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import type { StringsFile, OrgMapping } from "./types";

export async function importStrings(params: {
  prisma: PrismaClient;
  sourcePath: string;
  orgMappings: OrgMapping[];
  dryRun: boolean;
}) {
  const { prisma, sourcePath, orgMappings, dryRun } = params;
  const valuesDir = path.join(sourcePath, "res", "values");

  if (!fs.existsSync(valuesDir)) {
    console.log(`Values directory not found: ${valuesDir}`);
    return;
  }

  const localeDirs = fs
    .readdirSync(valuesDir)
    .filter((d) => fs.statSync(path.join(valuesDir, d)).isDirectory());

  console.log(`Found locales: ${localeDirs.join(", ")}`);

  for (const locale of localeDirs) {
    const stringsFile = path.join(valuesDir, locale, "strings.json");
    if (!fs.existsSync(stringsFile)) {
      console.warn(`No strings.json found for locale ${locale}`);
      continue;
    }

    const strings: StringsFile = JSON.parse(
      fs.readFileSync(stringsFile, "utf-8"),
    );
    const resources: Array<{
      category: string;
      key: string;
      locale: string;
      value: string;
    }> = [];

    for (const [category, entries] of Object.entries(strings)) {
      if (typeof entries !== "object" || entries === null) continue;
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value === "string") {
          resources.push({ category, key, locale, value });
        }
      }
    }

    console.log(`Locale ${locale}: ${resources.length} string resources`);

    // Import to all orgs (strings are shared resources)
    for (const mapping of orgMappings) {
      console.log(
        `${dryRun ? "[DRY RUN] " : ""}Importing ${resources.length} strings for locale ${locale} → org ${mapping.orgId}`,
      );

      if (!dryRun) {
        // Process in batches of 500
        const batchSize = 500;
        for (let i = 0; i < resources.length; i += batchSize) {
          const batch = resources.slice(i, i + batchSize);
          await prisma.$transaction(
            batch.map((resource) =>
              prisma.stringResource.upsert({
                where: {
                  orgId_category_key_locale: {
                    orgId: mapping.orgId,
                    category: resource.category,
                    key: resource.key,
                    locale: resource.locale,
                  },
                },
                create: {
                  orgId: mapping.orgId,
                  ...resource,
                },
                update: {
                  value: resource.value,
                },
              }),
            ),
          );
        }
      }
    }
  }
}

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import type { OrgMapping } from "./types";

const CONTENT_TYPE_MAP: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function importDrawables(params: {
  prisma: PrismaClient;
  sourcePath: string;
  orgMappings: OrgMapping[];
  dryRun: boolean;
}) {
  const { prisma, sourcePath, orgMappings, dryRun } = params;
  const drawableDir = path.join(sourcePath, "res", "drawable");

  if (!fs.existsSync(drawableDir)) {
    console.log(`Drawable directory not found: ${drawableDir}`);
    return;
  }

  const localeDirs = fs
    .readdirSync(drawableDir)
    .filter((d) => fs.statSync(path.join(drawableDir, d)).isDirectory());

  console.log(`Found drawable locales: ${localeDirs.join(", ")}`);

  for (const locale of localeDirs) {
    const localeDir = path.join(drawableDir, locale);
    const files = fs.readdirSync(localeDir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ext in CONTENT_TYPE_MAP;
    });

    console.log(`Locale ${locale}: ${files.length} drawable files`);

    for (const mapping of orgMappings) {
      console.log(
        `${dryRun ? "[DRY RUN] " : ""}Importing ${files.length} drawables for locale ${locale} → org ${mapping.orgId}`,
      );

      if (!dryRun) {
        for (const file of files) {
          const filePath = path.join(localeDir, file);
          const ext = path.extname(file).toLowerCase();
          const contentType =
            CONTENT_TYPE_MAP[ext] ?? "application/octet-stream";
          const content = fs.readFileSync(filePath).toString("base64");

          await prisma.drawableResource.upsert({
            where: {
              orgId_filename_locale: {
                orgId: mapping.orgId,
                filename: file,
                locale,
              },
            },
            create: {
              orgId: mapping.orgId,
              filename: file,
              locale,
              contentType,
              content,
            },
            update: {
              contentType,
              content,
            },
          });
        }
      }
    }
  }
}

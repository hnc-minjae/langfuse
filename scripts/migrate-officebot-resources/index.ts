import { PrismaClient } from "@prisma/client";
import { importMenuTemplates } from "./importMenuTemplates";
import { importStrings } from "./importStrings";
import { importDrawables } from "./importDrawables";
import type { OrgMapping } from "./types";

// Org mappings: each product's Langfuse org
const ORG_MAPPINGS: OrgMapping[] = [
  // Update these with actual org IDs from your Langfuse instance
  { orgId: "REPLACE_WITH_ORG_ID", products: ["assistanthwp"] },
  { orgId: "REPLACE_WITH_ORG_ID", products: ["assistantpptx"] },
  { orgId: "REPLACE_WITH_ORG_ID", products: ["assistantcell"] },
  { orgId: "REPLACE_WITH_ORG_ID", products: ["assistantpdf"] },
  { orgId: "REPLACE_WITH_ORG_ID", products: ["assistantmail"] },
  { orgId: "REPLACE_WITH_ORG_ID", products: ["assistanthanshow"] },
  { orgId: "REPLACE_WITH_ORG_ID", products: ["assistantcommon"] },
];

async function main() {
  const args = process.argv.slice(2);
  const sourcePath = args.find((a) => a.startsWith("--source="))?.split("=")[1];
  const dryRun = args.includes("--dry-run");
  const orgIdArg = args.find((a) => a.startsWith("--org-id="))?.split("=")[1];

  if (!sourcePath) {
    console.error(
      "Usage: ts-node index.ts --source=/path/to/officebot-storage [--dry-run] [--org-id=<id>]",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // If a specific org ID is provided, import everything to that org
    const mappings = orgIdArg
      ? [{ orgId: orgIdArg, products: ["*"] }]
      : ORG_MAPPINGS;

    // For wildcard orgs, match all products
    const effectiveMappings = mappings.map((m) => ({
      ...m,
      products: m.products.includes("*")
        ? [
            "assistanthwp",
            "assistantpptx",
            "assistantcell",
            "assistantpdf",
            "assistantmail",
            "assistanthanshow",
            "assistantcommon",
            "_translation",
            "_sampleprompts",
          ]
        : m.products,
    }));

    console.log(`\nSource: ${sourcePath}`);
    console.log(`Dry run: ${dryRun}`);
    console.log(`Orgs: ${effectiveMappings.length}\n`);

    console.log("=== Importing Menu Templates ===");
    await importMenuTemplates({
      prisma,
      sourcePath,
      orgMappings: effectiveMappings,
      dryRun,
    });

    console.log("\n=== Importing String Resources ===");
    await importStrings({
      prisma,
      sourcePath,
      orgMappings: effectiveMappings,
      dryRun,
    });

    console.log("\n=== Importing Drawable Resources ===");
    await importDrawables({
      prisma,
      sourcePath,
      orgMappings: effectiveMappings,
      dryRun,
    });

    console.log("\nDone!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * officebot-storage → Langfuse ManagedModel 마이그레이션 CLI.
 *
 * 사용법:
 *   npx tsx scripts/migrate-officebot-models/index.ts \
 *     --source /path/to/aihub-officebot-storage \
 *     --project-id clxxxxxxxxxx \
 *     --products assistant,groupware \
 *     --dry-run
 *
 * 환경변수:
 *   DATABASE_URL - PostgreSQL 연결 문자열 (dry-run이 아닌 경우 필수)
 */

import { parseArgs } from "node:util";
import type { MigrateOptions, MigrationResult } from "./types";
import { scanModels } from "./scanner";
import { transformModels } from "./transformer";
import { uploadModels } from "./uploader";

function parseCliArgs(): MigrateOptions {
  const { values } = parseArgs({
    options: {
      source: { type: "string", short: "s" },
      "project-id": { type: "string" },
      products: { type: "string", short: "p" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const source = values.source;
  if (!source) {
    console.error("오류: --source 필수 (officebot-storage 경로)");
    process.exit(1);
  }

  const projectId = values["project-id"];
  if (!projectId) {
    console.error("오류: --project-id 필수 (Langfuse 프로젝트 ID)");
    process.exit(1);
  }

  const dryRun = values["dry-run"] ?? false;

  if (!dryRun && !process.env.DATABASE_URL) {
    console.error("오류: DATABASE_URL 환경변수 필수 (dry-run이 아닌 경우)");
    process.exit(1);
  }

  return {
    source,
    projectId,
    products: values.products?.split(",").map((p) => p.trim()),
    dryRun,
  };
}

function printReport(
  result: MigrationResult,
  skippedFromTransform: Array<{ modelId: string; reason: string }>,
): void {
  const totalSkipped = [...result.skipped, ...skippedFromTransform];

  console.log("\n══════════════════════════════════════════");
  console.log("  모델 마이그레이션 리포트");
  console.log("══════════════════════════════════════════");
  console.log(`  성공:   ${result.success.length}`);
  console.log(`  실패:   ${result.failed.length}`);
  console.log(`  건너뜀: ${totalSkipped.length}`);
  console.log("══════════════════════════════════════════\n");

  if (result.failed.length > 0) {
    console.log("── 실패 목록 ──");
    for (const f of result.failed) {
      console.log(`  ✗ ${f.payload.modelId}: ${f.error}`);
    }
    console.log();
  }

  if (totalSkipped.length > 0) {
    console.log("── 건너뜀 목록 ──");
    for (const s of totalSkipped) {
      console.log(`  - ${s.modelId}: ${s.reason}`);
    }
    console.log();
  }

  // 브랜드별 통계
  const brandStats = new Map<string, number>();
  for (const p of result.success) {
    brandStats.set(p.brand, (brandStats.get(p.brand) ?? 0) + 1);
  }
  if (brandStats.size > 0) {
    console.log("── 브랜드별 통계 ──");
    for (const [brand, count] of brandStats.entries()) {
      console.log(`  ${brand}: ${count}`);
    }
    console.log();
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs();

  console.log("═══════════════════════════════════════════════════");
  console.log("  officebot-storage → Langfuse 모델 마이그레이션");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Source:      ${options.source}`);
  console.log(`  Project ID:  ${options.projectId}`);
  console.log(`  Products:    ${options.products?.join(", ") ?? "전체"}`);
  console.log(`  Dry Run:     ${options.dryRun}`);
  console.log("═══════════════════════════════════════════════════\n");

  // 1. 스캔
  console.log("── Phase 1: 스캔 ──");
  const scanned = scanModels(options);

  if (scanned.length === 0) {
    console.log("스캔 결과가 없습니다. 경로와 옵션을 확인하세요.");
    return;
  }

  // 2. 변환
  console.log("\n── Phase 2: 변환 ──");
  const { payloads, skipped } = transformModels(scanned);

  if (payloads.length === 0) {
    console.log("변환할 모델이 없습니다.");
    printReport({ success: [], failed: [], skipped: [] }, skipped);
    return;
  }

  console.log(
    `  ${payloads.length}개 모델 변환 완료 (${skipped.length}개 건너뜀)`,
  );

  // 3. 업로드
  console.log("\n── Phase 3: 업로드 ──");
  const result = await uploadModels({
    payloads,
    projectId: options.projectId,
    dryRun: options.dryRun,
  });

  // 4. 리포트
  printReport(result, skipped);

  // 실패가 있으면 exit code 1
  if (result.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});

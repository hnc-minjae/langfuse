#!/usr/bin/env node
/**
 * officebot-storage → Langfuse 프롬프트 마이그레이션 CLI.
 *
 * 사용법:
 *   npx tsx scripts/migrate-officebot-templates/index.ts \
 *     --source /path/to/aihub-officebot-storage \
 *     --langfuse-host http://localhost:3000 \
 *     --langfuse-public-key pk_... \
 *     --langfuse-secret-key sk_... \
 *     --products assistant,groupware \
 *     --template generate-draft-plan-multi \
 *     --dry-run
 */

import { parseArgs } from "node:util";
import type { MigrateOptions, MigrationResult } from "./types";
import { scanTemplates } from "./scanner";
import { transformAll } from "./transformer";
import { uploadPrompts } from "./uploader";

function parseCliArgs(): MigrateOptions {
  const { values } = parseArgs({
    options: {
      source: { type: "string", short: "s" },
      "langfuse-host": { type: "string" },
      "langfuse-public-key": { type: "string" },
      "langfuse-secret-key": { type: "string" },
      products: { type: "string", short: "p" },
      template: { type: "string", short: "t" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const source = values.source;
  if (!source) {
    console.error("오류: --source 필수 (officebot-storage 경로)");
    process.exit(1);
  }

  const langfuseHost = values["langfuse-host"] ?? "http://localhost:3000";
  const langfusePublicKey = values["langfuse-public-key"] ?? "";
  const langfuseSecretKey = values["langfuse-secret-key"] ?? "";
  const dryRun = values["dry-run"] ?? false;

  if (!dryRun && (!langfusePublicKey || !langfuseSecretKey)) {
    console.error(
      "오류: --langfuse-public-key 및 --langfuse-secret-key 필수 (dry-run 아닌 경우)",
    );
    process.exit(1);
  }

  return {
    source,
    langfuseHost,
    langfusePublicKey,
    langfuseSecretKey,
    products: values.products?.split(",").map((p) => p.trim()),
    template: values.template,
    dryRun,
  };
}

function printReport(
  result: MigrationResult,
  skippedFromTransform: Array<{ name: string; reason: string }>,
): void {
  const totalSkipped = [...result.skipped, ...skippedFromTransform];

  console.log("\n══════════════════════════════════════════");
  console.log("  마이그레이션 리포트");
  console.log("══════════════════════════════════════════");
  console.log(`  성공:   ${result.success.length}`);
  console.log(`  실패:   ${result.failed.length}`);
  console.log(`  건너뜀: ${totalSkipped.length}`);
  console.log("══════════════════════════════════════════\n");

  if (result.failed.length > 0) {
    console.log("── 실패 목록 ──");
    for (const f of result.failed) {
      console.log(`  ✗ ${f.payload.name}: ${f.error}`);
    }
    console.log();
  }

  if (totalSkipped.length > 0) {
    console.log("── 건너뜀 목록 ──");
    for (const s of totalSkipped) {
      console.log(`  - ${s.name}: ${s.reason}`);
    }
    console.log();
  }

  // 타입별 통계
  const typeStats = new Map<string, number>();
  for (const p of result.success) {
    const type = p.config._meta.templateType;
    typeStats.set(type, (typeStats.get(type) ?? 0) + 1);
  }
  if (typeStats.size > 0) {
    console.log("── 타입별 통계 ──");
    for (const [type, count] of typeStats.entries()) {
      console.log(`  ${type}: ${count}`);
    }
    console.log();
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs();

  console.log("═══════════════════════════════════════════════════");
  console.log("  officebot-storage → Langfuse 프롬프트 마이그레이션");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Source:      ${options.source}`);
  console.log(`  Host:        ${options.langfuseHost}`);
  console.log(`  Products:    ${options.products?.join(", ") ?? "전체"}`);
  console.log(`  Template:    ${options.template ?? "전체"}`);
  console.log(`  Dry Run:     ${options.dryRun}`);
  console.log("═══════════════════════════════════════════════════\n");

  // 1. 스캔
  console.log("── Phase 1: 스캔 ──");
  const scanned = scanTemplates(options);

  if (scanned.length === 0) {
    console.log("스캔 결과가 없습니다. 경로와 옵션을 확인하세요.");
    return;
  }

  // 2. 변환
  console.log("\n── Phase 2: 변환 ──");
  const { payloads, skipped } = transformAll(scanned);

  if (payloads.length === 0) {
    console.log("변환할 프롬프트가 없습니다.");
    printReport({ success: [], failed: [], skipped: [] }, skipped);
    return;
  }

  // 3. 업로드
  console.log("\n── Phase 3: 업로드 ──");
  const result = await uploadPrompts({
    payloads,
    host: options.langfuseHost,
    publicKey: options.langfusePublicKey,
    secretKey: options.langfuseSecretKey,
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

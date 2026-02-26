#!/usr/bin/env node
/**
 * officebot-storage → Langfuse LlmApiKeys (LLM Connections) 마이그레이션 CLI.
 *
 * 각 제품의 model.json 파일에서 LLM 연결 정보를 읽어
 * LlmApiKeys 테이블에 provider:model = 1:1로 등록합니다.
 *
 * 사용법:
 *   npx tsx scripts/migrate-officebot-llm-connections/index.ts \
 *     --source /path/to/aihub-officebot-storage \
 *     --project-id clxxxxxxxxxx \
 *     --product assistant \
 *     --dry-run
 *
 * 환경변수:
 *   DATABASE_URL   - PostgreSQL 연결 문자열 (dry-run이 아닌 경우 필수)
 *   ENCRYPTION_KEY - secretKey 암호화 키 (dry-run이 아닌 경우 필수)
 */

import { parseArgs } from "node:util";
import type { MigrateOptions, MigrationResult } from "./types";
import { scanConnections } from "./scanner";
import { transformConnections } from "./transformer";
import { uploadConnections } from "./uploader";

function parseCliArgs(): MigrateOptions {
  const { values } = parseArgs({
    options: {
      source: { type: "string", short: "s" },
      "project-id": { type: "string" },
      product: { type: "string", short: "p" },
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

  const product = values.product;
  if (!product) {
    console.error("오류: --product 필수 (단일 제품명, 예: assistant)");
    process.exit(1);
  }

  const dryRun = values["dry-run"] ?? false;

  if (!dryRun) {
    if (!process.env.DATABASE_URL) {
      console.error("오류: DATABASE_URL 환경변수 필수 (dry-run이 아닌 경우)");
      process.exit(1);
    }
    if (!process.env.ENCRYPTION_KEY) {
      console.error("오류: ENCRYPTION_KEY 환경변수 필수 (dry-run이 아닌 경우)");
      process.exit(1);
    }
  }

  return { source, projectId, product, dryRun };
}

function printReport(
  result: MigrationResult,
  skippedFromTransform: Array<{ modelId: string; reason: string }>,
): void {
  const totalSkipped = [...result.skipped, ...skippedFromTransform];

  console.log("\n══════════════════════════════════════════");
  console.log("  LLM Connection 마이그레이션 리포트");
  console.log("══════════════════════════════════════════");
  console.log(`  성공:   ${result.success.length}`);
  console.log(`  실패:   ${result.failed.length}`);
  console.log(`  건너뜀: ${totalSkipped.length}`);
  console.log("══════════════════════════════════════════\n");

  if (result.failed.length > 0) {
    console.log("── 실패 목록 ──");
    for (const f of result.failed) {
      console.log(`  ✗ ${f.payload.provider}: ${f.error}`);
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

  // adapter별 통계
  const adapterStats = new Map<string, number>();
  for (const p of result.success) {
    adapterStats.set(p.adapter, (adapterStats.get(p.adapter) ?? 0) + 1);
  }
  if (adapterStats.size > 0) {
    console.log("── Adapter별 통계 ──");
    for (const [adapter, count] of adapterStats.entries()) {
      console.log(`  ${adapter}: ${count}`);
    }
    console.log();
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs();

  console.log("════════════════════════════════════════════════════════");
  console.log("  officebot-storage → Langfuse LLM Connection 마이그레이션");
  console.log("════════════════════════════════════════════════════════");
  console.log(`  Source:      ${options.source}`);
  console.log(`  Project ID:  ${options.projectId}`);
  console.log(`  Product:     ${options.product}`);
  console.log(`  Dry Run:     ${options.dryRun}`);
  console.log("════════════════════════════════════════════════════════\n");

  // 1. 스캔
  console.log("── Phase 1: 스캔 ──");
  const scanned = scanConnections(options);

  if (scanned.length === 0) {
    console.log("스캔 결과가 없습니다. 경로와 옵션을 확인하세요.");
    return;
  }

  // 2. 변환
  console.log("\n── Phase 2: 변환 ──");
  const { payloads, skipped } = transformConnections(scanned);

  if (payloads.length === 0) {
    console.log("변환할 LLM 연결이 없습니다.");
    printReport({ success: [], failed: [], skipped: [] }, skipped);
    return;
  }

  console.log(
    `  ${payloads.length}개 LLM 연결 변환 완료 (${skipped.length}개 건너뜀)`,
  );

  // 3. 업로드
  console.log("\n── Phase 3: 업로드 ──");
  const result = await uploadConnections({
    payloads,
    projectId: options.projectId,
    dryRun: options.dryRun,
  });

  // 4. 리포트
  printReport(result, skipped);

  if (result.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});

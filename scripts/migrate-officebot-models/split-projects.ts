#!/usr/bin/env node
/**
 * assistant-main 프로젝트의 제품별 폴더를 개별 프로젝트로 분리합니다.
 *
 * 작업:
 * 1. 7개 제품별 프로젝트 생성 (hancom 조직 하위)
 * 2. 프롬프트 이동: projectId 변경 + 제품 prefix 제거
 * 3. 기존 모델 삭제 + 제품별 모델 등록
 *
 * 사용법:
 *   npx tsx scripts/migrate-officebot-models/split-projects.ts \
 *     --source /path/to/aihub-officebot-storage \
 *     --dry-run
 *
 * 환경변수:
 *   DATABASE_URL - PostgreSQL 연결 문자열
 */

import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { scanModels } from "./scanner";
import { transformModels } from "./transformer";

const SOURCE_PROJECT_ID = "cmlyhsiep0006lf07ltn7dvwk"; // assistant-main
const ORG_ID = "cmlyhs4jo0001lf07y9z6dhj6"; // hancom

const PRODUCTS = [
  "addins",
  "assistant",
  "docs",
  "groupware",
  "mso",
  "pedia",
  "webassistant",
];

interface CliOptions {
  source: string;
  dryRun: boolean;
}

function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      source: { type: "string", short: "s" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const source = values.source;
  if (!source) {
    console.error("오류: --source 필수 (officebot-storage 경로)");
    process.exit(1);
  }

  const dryRun = values["dry-run"] ?? false;

  if (!dryRun && !process.env.DATABASE_URL) {
    console.error("오류: DATABASE_URL 환경변수 필수 (dry-run이 아닌 경우)");
    process.exit(1);
  }

  return { source, dryRun };
}

async function main() {
  const options = parseCliArgs();
  const prisma = new PrismaClient();

  console.log("═══════════════════════════════════════════════════");
  console.log("  제품별 프로젝트 분리 마이그레이션");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Source:    ${options.source}`);
  console.log(`  Dry Run:  ${options.dryRun}`);
  console.log("═══════════════════════════════════════════════════\n");

  try {
    // ── Phase 1: 프롬프트 현황 ──
    console.log("── Phase 1: 현황 확인 ──");
    const promptCounts: Record<string, number> = {};
    for (const product of PRODUCTS) {
      const count = await prisma.prompt.count({
        where: {
          projectId: SOURCE_PROJECT_ID,
          name: { startsWith: `${product}/` },
        },
      });
      promptCounts[product] = count;
      console.log(`  ${product}: 프롬프트 ${count}개`);
    }

    // ── Phase 2: 프로젝트 생성 ──
    console.log("\n── Phase 2: 프로젝트 생성 ──");
    const projectMap = new Map<string, string>(); // product → projectId

    for (const product of PRODUCTS) {
      if (promptCounts[product] === 0) {
        console.log(`  [SKIP] ${product}: 프롬프트 없음`);
        continue;
      }

      // 이미 존재하는 프로젝트 확인
      const existing = await prisma.project.findFirst({
        where: { orgId: ORG_ID, name: product },
        select: { id: true, name: true },
      });

      if (existing) {
        console.log(`  [EXISTS] ${product} → ${existing.id}`);
        projectMap.set(product, existing.id);
        continue;
      }

      if (options.dryRun) {
        console.log(`  [DRY] ${product} 프로젝트 생성 예정`);
        projectMap.set(product, `dry-run-${product}`);
        continue;
      }

      const project = await prisma.project.create({
        data: {
          name: product,
          orgId: ORG_ID,
        },
      });
      console.log(`  [CREATED] ${product} → ${project.id}`);
      projectMap.set(product, project.id);
    }

    // ── Phase 3: 프롬프트 이동 ──
    console.log("\n── Phase 3: 프롬프트 이동 ──");
    for (const [product, newProjectId] of projectMap) {
      const prefix = `${product}/`;
      const prefixLen = prefix.length;

      if (options.dryRun) {
        console.log(
          `  [DRY] ${product}: ${promptCounts[product]}개 프롬프트 이동 예정 (prefix "${prefix}" 제거)`,
        );

        // 샘플 출력
        const samples = await prisma.prompt.findMany({
          where: {
            projectId: SOURCE_PROJECT_ID,
            name: { startsWith: prefix },
          },
          select: { name: true },
          distinct: ["name"],
          take: 3,
        });
        for (const s of samples) {
          console.log(`        "${s.name}" → "${s.name.substring(prefixLen)}"`);
        }
        continue;
      }

      // 해당 제품의 모든 프롬프트를 가져와서 이름 변경 + 프로젝트 이동
      // Prisma는 name 컬럼의 부분 업데이트를 지원하지 않으므로 raw SQL 사용
      const result = await prisma.$executeRawUnsafe(
        `UPDATE prompts
         SET project_id = $1,
             name = SUBSTRING(name FROM CAST($2 AS integer))
         WHERE project_id = $3
           AND name LIKE $4`,
        newProjectId,
        prefixLen + 1, // SQL SUBSTRING is 1-based
        SOURCE_PROJECT_ID,
        `${prefix}%`,
      );

      console.log(`  ✓ ${product}: ${result}개 프롬프트 이동 완료`);
    }

    // ── Phase 4: 기존 모델 삭제 ──
    console.log("\n── Phase 4: 기존 모델 정리 ──");
    if (options.dryRun) {
      const existingCount = await prisma.managedModel.count();
      console.log(`  [DRY] 기존 모델 ${existingCount}개 삭제 예정`);
    } else {
      const deleted = await prisma.managedModel.deleteMany({});
      console.log(`  ✓ 기존 모델 ${deleted.count}개 삭제`);
    }

    // ── Phase 5: 제품별 모델 등록 ──
    console.log("\n── Phase 5: 제품별 모델 등록 ──");
    let totalModels = 0;

    for (const [product, newProjectId] of projectMap) {
      // 해당 제품만 스캔
      const scanned = scanModels({
        source: options.source,
        projectId: newProjectId,
        products: [product],
        dryRun: options.dryRun,
      });

      if (scanned.length === 0) {
        console.log(`  [SKIP] ${product}: 모델 없음`);
        continue;
      }

      const { payloads, skipped } = transformModels(scanned);

      if (skipped.length > 0) {
        for (const s of skipped) {
          console.log(`  [SKIP] ${product}/${s.modelId}: ${s.reason}`);
        }
      }

      if (options.dryRun) {
        console.log(`  [DRY] ${product}: ${payloads.length}개 모델 등록 예정`);
        totalModels += payloads.length;
        continue;
      }

      for (const payload of payloads) {
        await prisma.managedModel.upsert({
          where: {
            projectId_modelId: {
              projectId: newProjectId,
              modelId: payload.modelId,
            },
          },
          create: {
            projectId: newProjectId,
            modelId: payload.modelId,
            displayName: payload.displayName,
            brand: payload.brand,
            brandDisplayName: payload.brandDisplayName,
            maxInputTokenSize: payload.maxInputTokenSize,
            maxOutputTokenSize: payload.maxOutputTokenSize,
            contextWindowSize: payload.contextWindowSize,
            isSupported: payload.isSupported,
            sortOrder: payload.sortOrder,
          },
          update: {
            displayName: payload.displayName,
            brand: payload.brand,
            brandDisplayName: payload.brandDisplayName,
            maxInputTokenSize: payload.maxInputTokenSize,
            maxOutputTokenSize: payload.maxOutputTokenSize,
            contextWindowSize: payload.contextWindowSize,
            isSupported: payload.isSupported,
            sortOrder: payload.sortOrder,
          },
        });
      }

      console.log(`  ✓ ${product}: ${payloads.length}개 모델 등록 완료`);
      totalModels += payloads.length;
    }

    // ── 리포트 ──
    console.log("\n══════════════════════════════════════════");
    console.log("  마이그레이션 리포트");
    console.log("══════════════════════════════════════════");
    console.log(`  프로젝트 생성: ${projectMap.size}개`);
    console.log(
      `  프롬프트 이동: ${Object.values(promptCounts).reduce((a, b) => a + b, 0)}개`,
    );
    console.log(`  모델 등록: ${totalModels}개`);
    console.log("══════════════════════════════════════════\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});

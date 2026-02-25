/**
 * Prisma를 사용하여 ManagedModel 테이블에 모델을 upsert합니다.
 *
 * projectId + modelId 유니크 제약을 활용하여
 * 이미 존재하는 모델은 업데이트, 없으면 생성합니다.
 */

import { PrismaClient } from "@prisma/client";
import type { ManagedModelPayload, MigrationResult } from "./types";

export async function uploadModels(params: {
  payloads: ManagedModelPayload[];
  projectId: string;
  dryRun: boolean;
}): Promise<MigrationResult> {
  const { payloads, projectId, dryRun } = params;

  const result: MigrationResult = {
    success: [],
    failed: [],
    skipped: [],
  };

  if (dryRun) {
    console.log(
      `\n[uploader] DRY RUN - ${payloads.length}개 모델 (업로드 건너뜀)\n`,
    );
    for (const payload of payloads) {
      console.log(`  [DRY] ${payload.modelId}`);
      console.log(
        `        brand: ${payload.brand} (${payload.brandDisplayName})`,
      );
      console.log(`        displayName: ${payload.displayName}`);
      console.log(
        `        context: ${payload.contextWindowSize ?? "-"}, input: ${payload.maxInputTokenSize ?? "-"}, output: ${payload.maxOutputTokenSize ?? "-"}`,
      );
      console.log(
        `        supported: ${payload.isSupported}, order: ${payload.sortOrder}`,
      );
      console.log();
    }
    result.success = payloads;
    return result;
  }

  const prisma = new PrismaClient();

  try {
    const total = payloads.length;
    console.log(`\n[uploader] ${total}개 모델 upsert 시작...\n`);

    for (let i = 0; i < payloads.length; i++) {
      const payload = payloads[i];
      const progress = `[${i + 1}/${total}]`;

      try {
        await prisma.managedModel.upsert({
          where: {
            projectId_modelId: {
              projectId,
              modelId: payload.modelId,
            },
          },
          create: {
            projectId,
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

        console.log(`  ${progress} ✓ ${payload.modelId} (${payload.brand})`);
        result.success.push(payload);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`  ${progress} ✗ ${payload.modelId}: ${errorMsg}`);
        result.failed.push({ payload, error: errorMsg });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

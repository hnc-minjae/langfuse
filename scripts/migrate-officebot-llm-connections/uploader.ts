/**
 * Prisma를 사용하여 LlmApiKeys 테이블에 LLM 연결을 upsert합니다.
 *
 * secretKey는 langfuse의 encrypt()로 암호화합니다.
 * projectId + provider 유니크 제약을 활용하여 idempotent 동작합니다.
 */

import { PrismaClient } from "@prisma/client";
import type { LlmConnectionPayload, MigrationResult } from "./types";

function loadEncrypt(): (data: string) => string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { encrypt } = require("@langfuse/shared/encryption") as {
    encrypt: (data: string) => string;
  };
  return encrypt;
}

export async function uploadConnections(params: {
  payloads: LlmConnectionPayload[];
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
      `\n[uploader] DRY RUN - ${payloads.length}개 LLM 연결 (업로드 건너뜀)\n`,
    );
    for (const payload of payloads) {
      console.log(`  [DRY] provider: ${payload.provider}`);
      console.log(`        adapter:  ${payload.adapter}`);
      console.log(`        baseURL:  ${payload.baseURL ?? "-"}`);
      console.log(`        models:   ${payload.customModels.join(", ")}`);
      console.log(`        secret:   ${payload.displaySecretKey}`);
      if (payload.config) {
        console.log(`        config:   ${JSON.stringify(payload.config)}`);
      }
      console.log();
    }
    result.success = payloads;
    return result;
  }

  const encrypt = loadEncrypt();
  const prisma = new PrismaClient();

  try {
    const total = payloads.length;
    console.log(`\n[uploader] ${total}개 LLM 연결 upsert 시작...\n`);

    for (let i = 0; i < payloads.length; i++) {
      const payload = payloads[i];
      const progress = `[${i + 1}/${total}]`;

      try {
        const encryptedSecretKey = payload.secretKey
          ? encrypt(payload.secretKey)
          : encrypt("");

        await prisma.llmApiKeys.upsert({
          where: {
            projectId_provider: {
              projectId,
              provider: payload.provider,
            },
          },
          create: {
            projectId,
            provider: payload.provider,
            adapter: payload.adapter,
            secretKey: encryptedSecretKey,
            displaySecretKey: payload.displaySecretKey,
            baseURL: payload.baseURL,
            customModels: payload.customModels,
            withDefaultModels: payload.withDefaultModels,
            config: payload.config ?? undefined,
          },
          update: {
            adapter: payload.adapter,
            secretKey: encryptedSecretKey,
            displaySecretKey: payload.displaySecretKey,
            baseURL: payload.baseURL,
            customModels: payload.customModels,
            withDefaultModels: payload.withDefaultModels,
            config: payload.config ?? undefined,
          },
        });

        console.log(
          `  ${progress} ✓ ${payload.provider} (${payload.adapter}, ${payload.customModels[0]})`,
        );
        result.success.push(payload);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`  ${progress} ✗ ${payload.provider}: ${errorMsg}`);
        result.failed.push({ payload, error: errorMsg });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

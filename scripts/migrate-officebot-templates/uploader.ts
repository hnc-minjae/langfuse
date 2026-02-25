/**
 * Langfuse API를 통해 프롬프트를 업로드합니다.
 *
 * POST /api/public/v2/prompts 엔드포인트를 사용하며,
 * Basic Auth (publicKey:secretKey)로 인증합니다.
 * 배치 API가 없으므로 순차적으로 요청합니다.
 */

import type { LangfusePromptPayload, MigrationResult } from "./types";

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadSinglePrompt(params: {
  payload: LangfusePromptPayload;
  host: string;
  authHeader: string;
  retries?: number;
}): Promise<{ success: boolean; error?: string }> {
  const { payload, host, authHeader, retries = 0 } = params;
  const url = `${host}/api/public/v2/prompts`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true };
    }

    const body = await response.text();

    // Rate limit → 재시도
    if (response.status === 429 && retries < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retries);
      console.warn(
        `[uploader] Rate limited (${payload.name}), ${delay}ms 후 재시도...`,
      );
      await sleep(delay);
      return uploadSinglePrompt({
        payload,
        host,
        authHeader,
        retries: retries + 1,
      });
    }

    // Unique constraint (P2002) → 이미 존재하는 프롬프트
    if (response.status === 400 && body.includes("unique constraint")) {
      return { success: false, error: `이미 존재: ${body}` };
    }

    return {
      success: false,
      error: `HTTP ${response.status}: ${body}`,
    };
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retries);
      console.warn(
        `[uploader] 네트워크 오류 (${payload.name}), ${delay}ms 후 재시도...`,
      );
      await sleep(delay);
      return uploadSinglePrompt({
        payload,
        host,
        authHeader,
        retries: retries + 1,
      });
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 프롬프트 페이로드 배열을 Langfuse에 순차적으로 업로드합니다.
 *
 * concurrent unique constraint 오류를 방지하기 위해
 * 같은 name의 프롬프트는 순차 처리합니다.
 */
export async function uploadPrompts(params: {
  payloads: LangfusePromptPayload[];
  host: string;
  publicKey: string;
  secretKey: string;
  dryRun: boolean;
}): Promise<MigrationResult> {
  const { payloads, host, publicKey, secretKey, dryRun } = params;

  const result: MigrationResult = {
    success: [],
    failed: [],
    skipped: [],
  };

  if (dryRun) {
    console.log(
      `\n[uploader] DRY RUN - ${payloads.length}개 프롬프트 (업로드 건너뜀)\n`,
    );
    for (const payload of payloads) {
      const msgSummary = payload.prompt
        .map((m) => `${m.role}: ${m.content.substring(0, 50)}...`)
        .join(" | ");
      console.log(`  [DRY] ${payload.name}`);
      console.log(`        tags: ${payload.tags.join(", ")}`);
      console.log(
        `        messages(${payload.prompt.length}): ${msgSummary.substring(0, 120)}`,
      );
      console.log(`        config.model: ${payload.config.model}`);
      console.log();
    }
    result.success = payloads;
    return result;
  }

  const credentials = Buffer.from(`${publicKey}:${secretKey}`).toString(
    "base64",
  );
  const authHeader = `Basic ${credentials}`;

  const total = payloads.length;
  console.log(`\n[uploader] ${total}개 프롬프트 업로드 시작...\n`);

  for (let i = 0; i < payloads.length; i++) {
    const payload = payloads[i];
    const progress = `[${i + 1}/${total}]`;

    const { success, error } = await uploadSinglePrompt({
      payload,
      host,
      authHeader,
    });

    if (success) {
      console.log(`  ${progress} ✓ ${payload.name}`);
      result.success.push(payload);
    } else {
      console.error(`  ${progress} ✗ ${payload.name}: ${error}`);
      result.failed.push({ payload, error: error ?? "Unknown error" });
    }

    // API 부하 방지를 위한 딜레이 (50ms)
    if (i < payloads.length - 1) {
      await sleep(50);
    }
  }

  return result;
}

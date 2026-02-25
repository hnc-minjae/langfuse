/**
 * ScannedModel → ManagedModelPayload 변환
 */

import type { ManagedModelPayload, ScannedModel } from "./types";

export function transformModels(scanned: ScannedModel[]): {
  payloads: ManagedModelPayload[];
  skipped: Array<{ modelId: string; reason: string }>;
} {
  const payloads: ManagedModelPayload[] = [];
  const skipped: Array<{ modelId: string; reason: string }> = [];

  for (let i = 0; i < scanned.length; i++) {
    const { modelId, config } = scanned[i];

    if (!config.displayName || !config.brand) {
      skipped.push({ modelId, reason: "displayName 또는 brand 누락" });
      continue;
    }

    payloads.push({
      modelId,
      displayName: config.displayName,
      brand: config.brand,
      brandDisplayName: config.brandDisplayName || config.brand,
      maxInputTokenSize: config.maxInputTokenSize,
      maxOutputTokenSize: config.maxOutputTokenSize,
      contextWindowSize: config.contextWindowSize,
      isSupported: config.isSupported !== false,
      sortOrder: config.order ?? i,
    });
  }

  return { payloads, skipped };
}

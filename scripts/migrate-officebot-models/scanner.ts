/**
 * officebot-storage의 {product}/models/config.json을 스캔하여
 * 모든 제품의 모델을 수집하고, modelId 기준으로 중복을 제거합니다.
 *
 * 중복 모델은 가장 상세한 정보를 가진 항목을 우선 사용합니다.
 * (assistant 제품이 가장 많은 모델을 보유하므로 대부분 assistant 기준)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { MigrateOptions, ScannedModel, SourceConfigJson } from "./types";

function readJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function getSubdirectories(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function scanModels(options: MigrateOptions): ScannedModel[] {
  const { source, products } = options;
  const modelMap = new Map<string, ScannedModel>();

  const productDirs = products?.length
    ? products
    : getSubdirectories(source).filter(
        (d) => !d.startsWith(".") && !d.startsWith("_"),
      );

  for (const product of productDirs) {
    const configPath = path.join(source, product, "models", "config.json");
    const config = readJsonFile<SourceConfigJson>(configPath);

    if (!config?.supportModels) {
      console.warn(
        `[scanner] 건너뜀: ${configPath} 없음 또는 supportModels 없음`,
      );
      continue;
    }

    const modelCount = Object.keys(config.supportModels).length;
    console.log(`  ${product}: ${modelCount}개 모델`);

    for (const [modelId, modelConfig] of Object.entries(config.supportModels)) {
      if (modelMap.has(modelId)) {
        modelMap.get(modelId)!.sourceProducts.push(product);
      } else {
        modelMap.set(modelId, {
          modelId,
          config: modelConfig,
          sourceProducts: [product],
        });
      }
    }
  }

  const results = Array.from(modelMap.values());
  console.log(`[scanner] 총 ${results.length}개 고유 모델 스캔 완료`);
  return results;
}

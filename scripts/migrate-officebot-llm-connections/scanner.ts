/**
 * officebot-storage의 {product}/models/{model}/model.json을 스캔하여
 * LLM 연결 정보를 수집합니다.
 *
 * 하나의 제품(product)만 대상으로 스캔합니다.
 * (provider가 projectId + provider unique이므로 제품별로 분리 실행)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  MigrateOptions,
  ScannedConnection,
  SourceModelJson,
} from "./types";

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

export function scanConnections(options: MigrateOptions): ScannedConnection[] {
  const { source, product } = options;
  const results: ScannedConnection[] = [];

  const modelsDir = path.join(source, product, "models");
  const modelDirs = getSubdirectories(modelsDir);

  if (modelDirs.length === 0) {
    console.warn(`[scanner] ${modelsDir}에 모델 디렉토리가 없습니다.`);
    return results;
  }

  for (const modelId of modelDirs) {
    const modelJsonPath = path.join(modelsDir, modelId, "model.json");
    const modelJson = readJsonFile<SourceModelJson>(modelJsonPath);

    if (!modelJson?._treatAs || !modelJson?.llmConfig) {
      continue;
    }

    results.push({
      modelId,
      product,
      source: modelJson,
    });
  }

  console.log(`  ${product}: ${results.length}개 LLM 연결 스캔`);
  return results;
}

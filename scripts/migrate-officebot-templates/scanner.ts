/**
 * officebot-storage 디렉토리를 스캔하여 template.json 파일들을 수집합니다.
 *
 * 디렉토리 구조:
 *   {source}/{product}/tasktemplates/{templateId}/
 *     ├── metadata.json
 *     ├── forms.json
 *     └── {locale}/
 *         ├── template.json          (공통 promptInfos + templateType)
 *         └── {model}/
 *             └── template.json      (모델별 설정 또는 useModelPrompt)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  FormsJson,
  MigrateOptions,
  ScannedTemplate,
  TemplateJson,
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

/**
 * locale 디렉토리인지 판별 (e.g., "ko-KR", "en-US", "ja-JP")
 */
function isLocaleDir(name: string): boolean {
  return /^[a-z]{2,3}(-[A-Z][a-zA-Z]{1,3})?$/.test(name);
}

/**
 * 모델 디렉토리인지 판별 (locale이 아닌 하위 디렉토리)
 */
function isModelDir(name: string): boolean {
  return !isLocaleDir(name) && !name.startsWith(".");
}

/**
 * templateType 결정: template.json 자체에 templateType 필드가 있음.
 * 모델 template → locale template → "general" 순으로 폴백.
 */
function resolveTemplateType(
  modelTemplate: TemplateJson,
  localeTemplate?: TemplateJson | null,
): string {
  return (
    modelTemplate.templateType ?? localeTemplate?.templateType ?? "general"
  );
}

export function scanTemplates(options: MigrateOptions): ScannedTemplate[] {
  const { source, products, template: templateFilter } = options;
  const results: ScannedTemplate[] = [];

  // 제품 디렉토리 목록
  const productDirs = products?.length
    ? products
    : getSubdirectories(source).filter(
        (d) => !d.startsWith(".") && !d.startsWith("_"),
      );

  for (const product of productDirs) {
    const taskTemplatesDir = path.join(source, product, "tasktemplates");
    if (!fs.existsSync(taskTemplatesDir)) {
      console.warn(`[scanner] 건너뜀: ${taskTemplatesDir} 없음`);
      continue;
    }

    const templateIds = getSubdirectories(taskTemplatesDir);

    for (const templateId of templateIds) {
      if (templateFilter && templateId !== templateFilter) continue;

      const templateDir = path.join(taskTemplatesDir, templateId);
      const forms = readJsonFile<FormsJson>(
        path.join(templateDir, "forms.json"),
      );

      // locale 디렉토리 스캔
      const localeDirs = getSubdirectories(templateDir).filter(isLocaleDir);

      for (const locale of localeDirs) {
        const localeDir = path.join(templateDir, locale);
        const localeTemplate = readJsonFile<TemplateJson>(
          path.join(localeDir, "template.json"),
        );

        // 모델 디렉토리 스캔
        const modelDirs = getSubdirectories(localeDir).filter(isModelDir);

        for (const model of modelDirs) {
          const modelDir = path.join(localeDir, model);
          const modelTemplate = readJsonFile<TemplateJson>(
            path.join(modelDir, "template.json"),
          );

          if (!modelTemplate) {
            console.warn(`[scanner] template.json 없음: ${modelDir}`);
            continue;
          }

          const templateType = resolveTemplateType(
            modelTemplate,
            localeTemplate,
          );

          results.push({
            templateId,
            locale,
            model,
            templateType,
            product,
            templateJson: modelTemplate,
            localeTemplateJson: localeTemplate ?? undefined,
            forms: forms ?? undefined,
            sourcePath: modelDir,
          });
        }

        // locale에만 template.json이 있고 모델 디렉토리가 없는 경우
        if (modelDirs.length === 0 && localeTemplate) {
          const templateType = resolveTemplateType(localeTemplate);
          const model = localeTemplate.modelInfos?.modelId ?? "unknown";

          results.push({
            templateId,
            locale,
            model,
            templateType,
            product,
            templateJson: localeTemplate,
            forms: forms ?? undefined,
            sourcePath: localeDir,
          });
        }
      }
    }
  }

  console.log(`[scanner] 총 ${results.length}개 템플릿 스캔 완료`);
  return results;
}

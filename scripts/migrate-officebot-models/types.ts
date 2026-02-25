/**
 * officebot-storage models/config.json 구조 및 마이그레이션 타입
 */

export interface SourceModelConfig {
  displayName: string;
  description?: string;
  brand: string;
  brandDisplayName: string;
  maxInputTokenSize: number | null;
  maxOutputTokenSize: number | null;
  contextWindowSize: number | null;
  isSupported?: boolean;
  order?: number;
}

export interface SourceConfigJson {
  defaultModel: string;
  supportModels: Record<string, SourceModelConfig>;
}

export interface ScannedModel {
  modelId: string;
  config: SourceModelConfig;
  sourceProducts: string[];
}

export interface ManagedModelPayload {
  modelId: string;
  displayName: string;
  brand: string;
  brandDisplayName: string;
  maxInputTokenSize: number | null;
  maxOutputTokenSize: number | null;
  contextWindowSize: number | null;
  isSupported: boolean;
  sortOrder: number;
}

export interface MigrateOptions {
  source: string;
  projectId: string;
  products?: string[];
  dryRun: boolean;
}

export interface MigrationResult {
  success: ManagedModelPayload[];
  failed: Array<{ payload: ManagedModelPayload; error: string }>;
  skipped: Array<{ modelId: string; reason: string }>;
}

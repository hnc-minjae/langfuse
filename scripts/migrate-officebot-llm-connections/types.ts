/**
 * officebot-storage model.json 구조 및 LLM Connection 마이그레이션 타입
 */

export interface SourceModelJson {
  _treatAs: string;
  llmConfig: {
    apiToken?: string;
    baseUrl: string;
    model: string;
    timeout?: number;
    // Vertex AI specific
    projectId?: string;
    location?: string;
    modelId?: string;
    useAdc?: boolean;
    serviceAccountJson?: string;
    // Gauss specific
    tenant?: string;
    fabrixClient?: string;
  };
  promptTemplate?: unknown;
}

export type LangfuseAdapter =
  | "openai"
  | "anthropic"
  | "azure"
  | "bedrock"
  | "google-vertex-ai"
  | "google-ai-studio";

export interface ScannedConnection {
  /** model.json이 위치한 디렉토리명 (= provider로 사용) */
  modelId: string;
  /** 원본 제품명 */
  product: string;
  /** 원본 model.json 데이터 */
  source: SourceModelJson;
}

export interface LlmConnectionPayload {
  provider: string;
  adapter: LangfuseAdapter;
  secretKey: string;
  displaySecretKey: string;
  baseURL: string | null;
  customModels: string[];
  withDefaultModels: boolean;
  config: Record<string, unknown> | null;
}

export interface MigrateOptions {
  source: string;
  projectId: string;
  product: string;
  dryRun: boolean;
}

export interface MigrationResult {
  success: LlmConnectionPayload[];
  failed: Array<{ payload: LlmConnectionPayload; error: string }>;
  skipped: Array<{ modelId: string; reason: string }>;
}

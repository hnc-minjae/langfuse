/**
 * Type definitions for officebot-storage → Langfuse prompt migration.
 *
 * officebot-storage의 template.json 구조와
 * Langfuse 프롬프트 API 페이로드 타입을 정의합니다.
 */

// ─── officebot-storage 원본 타입 ───

export interface PromptInfo {
  instruction: string;
  context?: string;
  separator?: string;
  examples?: Array<{ input: string; output: string }>;
  inputVariables?: string[];
}

export interface ChatMessageInfo {
  systemMessage?: string;
  history?: string;
  userMessage?: string;
  inputVariables?: string[];
}

export interface ModelInfoOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
  [key: string]: unknown;
}

export interface ModelInfo {
  modelId: string;
  options?: ModelInfoOptions;
  [key: string]: unknown;
}

export interface TaskInfo {
  promptInfos?: PromptInfo;
  chatMessageInfos?: ChatMessageInfo;
  modelInfos?: ModelInfo;
  useModelPrompt?: boolean;
  outputKey?: string;
  outputFilter?: string;
  outputParser?: string;
  batchKey?: string | null;
  [key: string]: unknown;
}

export interface TemplateJson {
  templateType?: string;
  promptInfos?: PromptInfo;
  chatMessageInfos?: ChatMessageInfo;
  modelInfos?: ModelInfo;
  useModelPrompt?: boolean;
  tasks?: TaskInfo[];
  outputKey?: string;
  outputFilter?: string;
  outputParser?: string;
  batchKey?: string | null;
  coinCount?: number;
  isStream?: boolean;
  interval?: number;
  [key: string]: unknown;
}

export interface MetadataJson {
  containerType: string;
  subContainers?: string[];
  extraInfo?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FormsJson {
  formFields?: Array<Record<string, unknown>>;
  outputActions?: Array<Record<string, unknown>>;
  suggestActions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

// ─── 스캔 결과 타입 ───

export interface ScannedTemplate {
  templateId: string;
  locale: string;
  model: string;
  templateType: string;
  product: string;
  templateJson: TemplateJson;
  /** useModelPrompt: true일 때 상위 locale의 template.json */
  localeTemplateJson?: TemplateJson;
  forms?: FormsJson;
  sourcePath: string;
}

// ─── Langfuse 프롬프트 타입 ───

export interface LangfusePromptMeta {
  templateId: string;
  templateType: string;
  stepIndex?: number;
  taskIndex?: number;
  outputKey?: string | null;
  outputFilter?: string | null;
  outputParser?: string | null;
  batchKey?: string | null;
  isStream?: boolean;
  sourceProduct: string;
  locale: string;
  forms?: FormsJson;
  coinCount?: number;
  inputVariables?: string[];
}

export interface LangfusePromptConfig {
  model: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
  _meta: LangfusePromptMeta;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LangfusePromptPayload {
  name: string;
  prompt: ChatMessage[];
  type: "chat";
  config: LangfusePromptConfig;
  labels: string[];
  tags: string[];
  commitMessage?: string;
}

// ─── CLI 옵션 ───

export interface MigrateOptions {
  source: string;
  langfuseHost: string;
  langfusePublicKey: string;
  langfuseSecretKey: string;
  products?: string[];
  template?: string;
  dryRun: boolean;
}

// ─── 마이그레이션 결과 ───

export interface MigrationResult {
  success: LangfusePromptPayload[];
  failed: Array<{ payload: LangfusePromptPayload; error: string }>;
  skipped: Array<{ name: string; reason: string }>;
}

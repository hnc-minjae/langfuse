export type TaskTemplateType = "chat" | "general" | "sequential" | "multiple";

export interface ChatPromptConfig {
  systemMessage: string;
  userMessage: string;
  inputVariables: string[];
}

export interface FewShotExample {
  input: string;
  output: string;
}

export interface GeneralPromptConfig {
  instruction: string;
  context?: string;
  inputVariables: string[];
  examples?: FewShotExample[];
}

export type PromptConfig = ChatPromptConfig | GeneralPromptConfig;

export interface ModelOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  maxReasoningTokens?: number;
}

// ── Multi-task types (sequential, multiple) ──

/**
 * Individual task definition within sequential/multiple templates.
 * Maps to coconut SDK's task entry in template.json:
 *   modelInfos → managedModelId + modelOptions
 *   promptInfos → promptConfig
 */
export interface TaskDefinition {
  managedModelId: string;
  modelOptions?: ModelOptions;
  promptConfig: GeneralPromptConfig;
  outputKey: string;
  outputParser?: string; // "LineListOutputParser" | ""
  outputFilter?: string; // "JsonOutputFilter" | ""
  streamingParser?: string; // "JsonObjectKeyRouterStreamingParser" | ""
  batchKey?: string; // sequential: iterate over previous task's array output
}

/**
 * Result of executing a single task or the entire template.
 */
export interface ExecutionResult {
  success: boolean;
  output: string | Record<string, string | string[]>;
  context: Record<string, string | string[]>;
  latencyMs: number;
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Listener interface for JsonKeyStreamingParser.
 * Receives events as streaming JSON is parsed character by character.
 */
export interface StreamingParserListener {
  onKeyStart(key: string): void;
  onValueDelta(key: string, delta: string): void;
  onKeyEnd(key: string): void;
}

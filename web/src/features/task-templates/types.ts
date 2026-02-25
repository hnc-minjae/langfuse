export type TaskTemplateType = "chat" | "general";

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

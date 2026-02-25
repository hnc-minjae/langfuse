import { type ChatMessage, ChatMessageRole } from "@langfuse/shared";
import { ChatMessageType } from "@langfuse/shared/src/server";
import type {
  ChatPromptConfig,
  GeneralPromptConfig,
  FewShotExample,
} from "../types";

/**
 * Substitutes variables in a template string.
 * Supports both {{var}} (langfuse standard) and {var} (coconut SDK compat).
 * {var} is only matched if NOT preceded or followed by another brace.
 */
export function substituteVariables(params: {
  template: string;
  variables: Record<string, string>;
}): string {
  const { template, variables } = params;

  // First pass: replace {{var}} (double-brace)
  let result = template.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    return variables[varName] ?? `{{${varName}}}`;
  });

  // Second pass: replace {var} (single-brace, not preceded/followed by {/})
  result = result.replace(/(?<!\{)\{(\w+)\}(?!\})/g, (_match, varName) => {
    return variables[varName] ?? `{${varName}}`;
  });

  return result;
}

/**
 * Extracts variable names from a template string.
 * Returns unique variable names found in both {{var}} and {var} patterns.
 */
export function extractVariables(template: string): string[] {
  const vars = new Set<string>();

  // Match {{var}}
  const doubleBraceRegex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = doubleBraceRegex.exec(template)) !== null) {
    vars.add(match[1]);
  }

  // Match {var} (not preceded/followed by {/})
  const singleBraceRegex = /(?<!\{)\{(\w+)\}(?!\})/g;
  while ((match = singleBraceRegex.exec(template)) !== null) {
    vars.add(match[1]);
  }

  return Array.from(vars);
}

/**
 * Validates that all required input variables are provided.
 */
export function validateInputs(params: {
  inputVariables: string[];
  inputs: Record<string, string>;
}): { missing: string[] } {
  const { inputVariables, inputs } = params;
  const missing = inputVariables.filter((v) => !(v in inputs));
  return { missing };
}

/**
 * Builds ChatMessage[] for a "chat" type template.
 */
function buildChatMessages(params: {
  config: ChatPromptConfig;
  inputs: Record<string, string>;
}): ChatMessage[] {
  const { config, inputs } = params;
  const messages: ChatMessage[] = [];

  if (config.systemMessage) {
    messages.push({
      type: ChatMessageType.System,
      role: ChatMessageRole.System,
      content: substituteVariables({
        template: config.systemMessage,
        variables: inputs,
      }),
    });
  }

  messages.push({
    type: ChatMessageType.User,
    role: ChatMessageRole.User,
    content: substituteVariables({
      template: config.userMessage,
      variables: inputs,
    }),
  });

  return messages;
}

/**
 * Builds a few-shot example pair as assistant messages.
 */
function buildFewShotMessages(examples: FewShotExample[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const example of examples) {
    messages.push({
      type: ChatMessageType.User,
      role: ChatMessageRole.User,
      content: example.input,
    });
    messages.push({
      type: ChatMessageType.AssistantText,
      role: ChatMessageRole.Assistant,
      content: example.output,
    });
  }

  return messages;
}

/**
 * Builds ChatMessage[] for a "general" type template.
 * Structure: [SystemMsg(instruction), ...FewShotExamples, HumanMsg(context+input)]
 */
function buildGeneralMessages(params: {
  config: GeneralPromptConfig;
  inputs: Record<string, string>;
}): ChatMessage[] {
  const { config, inputs } = params;
  const messages: ChatMessage[] = [];

  // System message from instruction
  messages.push({
    type: ChatMessageType.System,
    role: ChatMessageRole.System,
    content: substituteVariables({
      template: config.instruction,
      variables: inputs,
    }),
  });

  // Few-shot examples
  if (config.examples && config.examples.length > 0) {
    messages.push(...buildFewShotMessages(config.examples));
  }

  // User message combining context and input variables
  const userParts: string[] = [];

  if (config.context) {
    userParts.push(
      substituteVariables({ template: config.context, variables: inputs }),
    );
  }

  // Add remaining input variables as key-value pairs if not already embedded
  const varsInContext = config.context ? extractVariables(config.context) : [];
  const varsInInstruction = extractVariables(config.instruction);
  const embeddedVars = new Set([...varsInContext, ...varsInInstruction]);

  const remainingInputs = Object.entries(inputs).filter(
    ([key]) => !embeddedVars.has(key),
  );

  if (remainingInputs.length > 0) {
    const inputText = remainingInputs
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    userParts.push(inputText);
  }

  if (userParts.length > 0) {
    messages.push({
      type: ChatMessageType.User,
      role: ChatMessageRole.User,
      content: userParts.join("\n\n"),
    });
  }

  return messages;
}

/**
 * Main entry point for building prompt messages from a TaskTemplate.
 */
export function buildMessages(params: {
  type: string;
  promptConfig: Record<string, unknown>;
  inputs: Record<string, string>;
}): ChatMessage[] {
  const { type, promptConfig, inputs } = params;

  if (type === "chat") {
    return buildChatMessages({
      config: promptConfig as unknown as ChatPromptConfig,
      inputs,
    });
  }

  if (type === "general") {
    return buildGeneralMessages({
      config: promptConfig as unknown as GeneralPromptConfig,
      inputs,
    });
  }

  throw new Error(`Unsupported template type: ${type}`);
}

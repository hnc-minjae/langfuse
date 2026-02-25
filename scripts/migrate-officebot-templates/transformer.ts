/**
 * ScannedTemplate → LangfusePromptPayload 변환기.
 *
 * 실제 officebot-storage 구조 기반:
 *   - promptInfos는 단일 객체 { instruction, separator, context, examples, inputVariables }
 *   - modelInfos는 { modelId, options: { temperature, stream, ... } }
 *   - chat 타입은 chatMessageInfos { systemMessage, history, userMessage }
 *   - templateType은 template.json 자체에 존재
 *
 * Langfuse chat 프롬프트로 변환:
 *   - instruction → system message
 *   - examples → user/assistant 메시지 쌍 (few-shot)
 *   - context → user message
 *
 * 변수 포맷 변환: {var} → {{var}} (Langfuse 템플릿 문법)
 */

import type {
  ChatMessage,
  ChatMessageInfo,
  LangfusePromptConfig,
  LangfusePromptMeta,
  LangfusePromptPayload,
  ModelInfo,
  PromptInfo,
  ScannedTemplate,
  TaskInfo,
} from "./types";

/**
 * officebot-storage의 {var} 변수를 Langfuse의 {{var}}로 변환합니다.
 * 이미 {{var}} 형태인 것은 건드리지 않습니다.
 */
function convertVariables(text: string): string {
  return text.replace(/\{(?!\{)([^}]+)\}(?!\})/g, "{{$1}}");
}

/**
 * promptInfos를 chat message 배열로 변환합니다.
 *
 * 구조:
 *   1. system: instruction
 *   2. user/assistant 쌍: examples (few-shot)
 *   3. user: context (실제 입력 변수 포함)
 */
function buildChatMessages(promptInfo: PromptInfo): ChatMessage[] {
  const messages: ChatMessage[] = [];

  const instruction = promptInfo.instruction?.trim();
  const context = promptInfo.context?.trim();

  // 1. instruction → system message
  if (instruction) {
    messages.push({ role: "system", content: convertVariables(instruction) });
  }

  // 2. examples → user/assistant 메시지 쌍 (few-shot)
  if (promptInfo.examples?.length) {
    for (const ex of promptInfo.examples) {
      messages.push({ role: "user", content: ex.input });
      messages.push({ role: "assistant", content: ex.output });
    }
  }

  // 3. context → user message
  if (context) {
    messages.push({ role: "user", content: convertVariables(context) });
  }

  return messages;
}

/**
 * chatMessageInfos를 chat message 배열로 변환합니다.
 */
function buildChatMessagesFromChatInfo(
  chatInfo: ChatMessageInfo,
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (chatInfo.systemMessage?.trim()) {
    messages.push({
      role: "system",
      content: convertVariables(chatInfo.systemMessage.trim()),
    });
  }
  if (chatInfo.userMessage?.trim()) {
    messages.push({
      role: "user",
      content: convertVariables(chatInfo.userMessage.trim()),
    });
  }

  return messages;
}

/**
 * modelInfos에서 config 파라미터를 추출합니다.
 * 실제 구조: { modelId, options: { temperature, stream, max_tokens, ... } }
 */
function extractModelConfig(modelInfos?: ModelInfo): {
  model: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
} {
  if (!modelInfos) return { model: "unknown" };

  const opts = modelInfos.options ?? {};
  return {
    model: modelInfos.modelId,
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.top_p !== undefined && { top_p: opts.top_p }),
    ...(opts.max_tokens !== undefined && { max_tokens: opts.max_tokens }),
    ...(opts.stream !== undefined && { stream: opts.stream }),
    ...(opts.stop?.length && { stop: opts.stop }),
  };
}

function buildConfig(params: {
  scanned: ScannedTemplate;
  stepIndex?: number;
  taskIndex?: number;
  task?: TaskInfo;
  inputVariables?: string[];
}): LangfusePromptConfig {
  const { scanned, stepIndex, taskIndex, task, inputVariables } = params;
  const modelInfos = task?.modelInfos ?? scanned.templateJson.modelInfos;
  const templateJson = scanned.templateJson;
  const isStream =
    modelInfos?.options?.stream ?? templateJson.isStream ?? false;

  const meta: LangfusePromptMeta = {
    templateId: scanned.templateId,
    templateType: scanned.templateType,
    ...(stepIndex !== undefined && { stepIndex }),
    ...(taskIndex !== undefined && { taskIndex }),
    outputKey: task?.outputKey ?? templateJson.outputKey ?? null,
    outputFilter: task?.outputFilter ?? templateJson.outputFilter ?? null,
    outputParser: task?.outputParser ?? templateJson.outputParser ?? null,
    batchKey: task?.batchKey ?? templateJson.batchKey ?? null,
    isStream,
    sourceProduct: scanned.product,
    locale: scanned.locale,
    ...(scanned.forms && { forms: scanned.forms }),
    ...(templateJson.coinCount !== undefined && {
      coinCount: templateJson.coinCount,
    }),
    ...(inputVariables?.length && { inputVariables }),
  };

  const modelConfig = extractModelConfig(modelInfos);

  return {
    ...modelConfig,
    _meta: meta,
  };
}

function buildTags(scanned: ScannedTemplate): string[] {
  return [
    `product:${scanned.product}`,
    `type:${scanned.templateType}`,
    `locale:${scanned.locale}`,
    `model:${scanned.model}`,
  ];
}

function buildPromptName(params: {
  product: string;
  templateId: string;
  locale: string;
  model: string;
  suffix?: string;
}): string {
  const base = `${params.product}/${params.templateId}/${params.locale}/${params.model}`;
  return params.suffix ? `${base}/${params.suffix}` : base;
}

/**
 * promptInfos를 결정합니다 (useModelPrompt 처리 포함).
 *
 * 우선순위:
 * 1. task 자체의 promptInfos
 * 2. 모델 template.json의 promptInfos
 * 3. useModelPrompt: true → 상위 locale template의 promptInfos
 * 4. locale template의 tasks[같은 인덱스].promptInfos
 */
function resolvePromptInfo(params: {
  scanned: ScannedTemplate;
  task?: TaskInfo;
  taskIndex?: number;
}): PromptInfo | null {
  const { scanned, task, taskIndex } = params;

  // task 자체에 promptInfos가 있으면 사용
  if (task?.promptInfos?.instruction) {
    return task.promptInfos;
  }

  // 모델 template에 promptInfos가 있으면 사용
  if (scanned.templateJson.promptInfos?.instruction) {
    return scanned.templateJson.promptInfos;
  }

  // useModelPrompt: true → 상위 locale template 참조
  const useModel = task?.useModelPrompt ?? scanned.templateJson.useModelPrompt;
  if (useModel && scanned.localeTemplateJson) {
    // locale template에 tasks가 있고 인덱스가 지정된 경우
    if (
      taskIndex !== undefined &&
      scanned.localeTemplateJson.tasks?.[taskIndex]?.promptInfos?.instruction
    ) {
      return scanned.localeTemplateJson.tasks[taskIndex].promptInfos!;
    }
    // locale template 자체의 promptInfos
    if (scanned.localeTemplateJson.promptInfos?.instruction) {
      return scanned.localeTemplateJson.promptInfos;
    }
  }

  return null;
}

/**
 * chatMessageInfos를 결정합니다.
 */
function resolveChatInfo(params: {
  scanned: ScannedTemplate;
}): ChatMessageInfo | null {
  const { scanned } = params;

  if (
    scanned.templateJson.chatMessageInfos?.systemMessage ||
    scanned.templateJson.chatMessageInfos?.userMessage
  ) {
    return scanned.templateJson.chatMessageInfos;
  }

  if (
    scanned.templateJson.useModelPrompt &&
    scanned.localeTemplateJson?.chatMessageInfos
  ) {
    return scanned.localeTemplateJson.chatMessageInfos;
  }

  return null;
}

function transformGeneral(scanned: ScannedTemplate): LangfusePromptPayload[] {
  const promptInfo = resolvePromptInfo({ scanned });
  if (!promptInfo) return [];

  const messages = buildChatMessages(promptInfo);
  if (messages.length === 0) return [];

  return [
    {
      name: buildPromptName({
        product: scanned.product,
        templateId: scanned.templateId,
        locale: scanned.locale,
        model: scanned.model,
      }),
      prompt: messages,
      type: "chat",
      config: buildConfig({
        scanned,
        inputVariables: promptInfo.inputVariables,
      }),
      labels: ["production"],
      tags: buildTags(scanned),
      commitMessage: `Migrated from officebot-storage: ${scanned.templateId}`,
    },
  ];
}

function transformChat(scanned: ScannedTemplate): LangfusePromptPayload[] {
  const chatInfo = resolveChatInfo({ scanned });
  if (!chatInfo) return [];

  const messages = buildChatMessagesFromChatInfo(chatInfo);
  if (messages.length === 0) return [];

  return [
    {
      name: buildPromptName({
        product: scanned.product,
        templateId: scanned.templateId,
        locale: scanned.locale,
        model: scanned.model,
      }),
      prompt: messages,
      type: "chat",
      config: buildConfig({
        scanned,
        inputVariables: chatInfo.inputVariables,
      }),
      labels: ["production"],
      tags: buildTags(scanned),
      commitMessage: `Migrated from officebot-storage: ${scanned.templateId} (chat)`,
    },
  ];
}

function transformSequential(
  scanned: ScannedTemplate,
): LangfusePromptPayload[] {
  const tasks = scanned.templateJson.tasks ?? scanned.localeTemplateJson?.tasks;
  if (!tasks?.length) {
    return transformGeneral(scanned);
  }

  const payloads: LangfusePromptPayload[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const promptInfo = resolvePromptInfo({
      scanned,
      task,
      taskIndex: i,
    });
    if (!promptInfo) continue;

    const messages = buildChatMessages(promptInfo);
    if (messages.length === 0) continue;

    payloads.push({
      name: buildPromptName({
        product: scanned.product,
        templateId: scanned.templateId,
        locale: scanned.locale,
        model: scanned.model,
        suffix: `step-${i}`,
      }),
      prompt: messages,
      type: "chat",
      config: buildConfig({
        scanned,
        stepIndex: i,
        task,
        inputVariables: promptInfo.inputVariables,
      }),
      labels: ["production"],
      tags: buildTags(scanned),
      commitMessage: `Migrated from officebot-storage: ${scanned.templateId} step-${i}`,
    });
  }

  return payloads;
}

function transformMultiple(scanned: ScannedTemplate): LangfusePromptPayload[] {
  const tasks = scanned.templateJson.tasks ?? scanned.localeTemplateJson?.tasks;
  if (!tasks?.length) {
    return transformGeneral(scanned);
  }

  const payloads: LangfusePromptPayload[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const promptInfo = resolvePromptInfo({
      scanned,
      task,
      taskIndex: i,
    });
    if (!promptInfo) continue;

    const messages = buildChatMessages(promptInfo);
    if (messages.length === 0) continue;

    payloads.push({
      name: buildPromptName({
        product: scanned.product,
        templateId: scanned.templateId,
        locale: scanned.locale,
        model: scanned.model,
        suffix: `task-${i}`,
      }),
      prompt: messages,
      type: "chat",
      config: buildConfig({
        scanned,
        taskIndex: i,
        task,
        inputVariables: promptInfo.inputVariables,
      }),
      labels: ["production"],
      tags: buildTags(scanned),
      commitMessage: `Migrated from officebot-storage: ${scanned.templateId} task-${i}`,
    });
  }

  return payloads;
}

/**
 * ScannedTemplate을 LangfusePromptPayload 배열로 변환합니다.
 */
export function transformTemplate(
  scanned: ScannedTemplate,
): LangfusePromptPayload[] {
  switch (scanned.templateType) {
    case "sequential":
      return transformSequential(scanned);
    case "multiple":
      return transformMultiple(scanned);
    case "chat":
      return transformChat(scanned);
    case "general":
    default:
      return transformGeneral(scanned);
  }
}

/**
 * 모든 스캔된 템플릿을 변환합니다.
 */
export function transformAll(scannedTemplates: ScannedTemplate[]): {
  payloads: LangfusePromptPayload[];
  skipped: Array<{ name: string; reason: string }>;
} {
  const payloads: LangfusePromptPayload[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const scanned of scannedTemplates) {
    const transformed = transformTemplate(scanned);

    if (transformed.length === 0) {
      skipped.push({
        name: `${scanned.templateId}/${scanned.locale}/${scanned.model}`,
        reason: "promptInfos/chatMessageInfos가 없거나 비어있음",
      });
      continue;
    }

    payloads.push(...transformed);
  }

  console.log(
    `[transformer] ${payloads.length}개 프롬프트 생성, ${skipped.length}개 건너뜀`,
  );
  return { payloads, skipped };
}

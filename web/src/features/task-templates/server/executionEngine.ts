/**
 * Task Template Execution Engine
 *
 * Ports coconut SDK's sequential and multiple execution patterns to TypeScript.
 *
 * Sequential: Task0 → filter → parser → context → Task1 → ... → final output
 * Multiple:   Task0 ─┐
 *             Task1 ─┤ Promise.all → merged context
 *             Task2 ─┘
 */

import { fetchLLMCompletion } from "@langfuse/shared/src/server";
import { resolveModelConnection } from "./resolveModelConnection";
import { buildMessages } from "./promptBuilder";
import { getOutputFilter, getOutputParser } from "./outputParsers";
import type {
  TaskDefinition,
  ExecutionResult,
  TokenUsage,
  ModelOptions,
} from "../types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a single task: resolve model → build messages → call LLM → filter → parse.
 */
async function executeSingleTask(params: {
  task: TaskDefinition;
  inputs: Record<string, string>;
  projectId: string;
}): Promise<string | string[]> {
  const { task, inputs, projectId } = params;

  // Resolve model connection
  const { modelParams, llmConnection } = await resolveModelConnection({
    managedModelId: task.managedModelId,
    projectId,
    modelOptions: task.modelOptions,
  });

  // Build messages (all tasks in sequential/multiple use "general" prompt format)
  const messages = buildMessages({
    type: "general",
    promptConfig: task.promptConfig as unknown as Record<string, unknown>,
    inputs,
  });

  // Call LLM
  let result = await fetchLLMCompletion({
    messages,
    modelParams,
    llmConnection,
    streaming: false,
  });

  // Apply OutputFilter (pre-processing)
  const filter = getOutputFilter(task.outputFilter);
  if (filter) {
    result = filter.filter(result);
  }

  // Apply OutputParser (post-processing)
  const parser = getOutputParser(task.outputParser);
  if (parser) {
    return parser.parse(result);
  }

  return result;
}

/**
 * Converts a value to string representation for context propagation.
 * Arrays are joined with newlines to match coconut SDK behavior.
 */
function toContextString(value: string | string[]): string {
  return Array.isArray(value) ? value.join("\n") : value;
}

/**
 * Executes a sequential template.
 *
 * Each task's output is added to the context and available as input for subsequent tasks.
 * If a task has a `batchKey`, the referenced context value (must be an array from a previous
 * parser) is iterated, and the task is executed once per array item.
 *
 * Flow:
 *   inputs → Task0(LLM) → context[outputKey0]
 *          → Task1(LLM, inputs+context) → context[outputKey1]
 *          → Task2(batchKey=outputKey1) → iterate array → context[outputKey2]
 */
export async function executeSequential(params: {
  tasks: TaskDefinition[];
  inputs: Record<string, string>;
  projectId: string;
  interval?: number;
  outputKey: string;
}): Promise<ExecutionResult> {
  const { tasks, inputs, projectId, interval, outputKey } = params;
  const startTime = Date.now();
  const context: Record<string, string | string[]> = { ...inputs };

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    // Interval delay between tasks (not before the first)
    if (i > 0 && interval && interval > 0) {
      await sleep(interval);
    }

    // Build string-only inputs for message building (flatten arrays)
    const stringInputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(context)) {
      stringInputs[key] = toContextString(value);
    }

    if (task.batchKey && Array.isArray(context[task.batchKey])) {
      // Batch execution: iterate over array from previous task
      const batchItems = context[task.batchKey] as string[];
      const batchResults: string[] = [];

      for (const item of batchItems) {
        const batchInputs = { ...stringInputs, [task.batchKey]: item };
        const result = await executeSingleTask({
          task: { ...task, outputParser: undefined }, // No parser in batch mode
          inputs: batchInputs,
          projectId,
        });
        batchResults.push(toContextString(result));
      }

      context[task.outputKey] = batchResults.join("\n\n");
    } else {
      // Single execution
      const result = await executeSingleTask({
        task,
        inputs: stringInputs,
        projectId,
      });
      context[task.outputKey] = result;
    }
  }

  const latencyMs = Date.now() - startTime;
  const finalOutput = context[outputKey];

  return {
    success: true,
    output: toContextString(finalOutput ?? ""),
    context: context as Record<string, string | string[]>,
    latencyMs,
  };
}

/**
 * Executes a multiple (parallel) template.
 *
 * All tasks receive the same inputs and run concurrently.
 * Each task's output is stored under its outputKey in the context.
 *
 * Flow:
 *   inputs → Promise.all([Task0, Task1, Task2, ...]) → merged context
 */
export async function executeMultiple(params: {
  tasks: TaskDefinition[];
  inputs: Record<string, string>;
  projectId: string;
  outputKey: string;
}): Promise<ExecutionResult> {
  const { tasks, inputs, projectId, outputKey } = params;
  const startTime = Date.now();

  const results = await Promise.all(
    tasks.map((task) => executeSingleTask({ task, inputs, projectId })),
  );

  const context: Record<string, string | string[]> = {};
  tasks.forEach((task, i) => {
    context[task.outputKey] = results[i];
  });

  const latencyMs = Date.now() - startTime;

  return {
    success: true,
    output: context,
    context,
    latencyMs,
  };
}

/** @jest-environment node */

import {
  CreateTaskTemplateInput,
  UpdateTaskTemplateInput,
  ExecuteTaskTemplateInput,
  ModelOptionsSchema,
  ChatPromptConfigSchema,
  GeneralPromptConfigSchema,
  TaskTemplateTypeSchema,
  validatePromptConfig,
} from "@/src/features/task-templates/validation";

describe("TaskTemplateTypeSchema", () => {
  it("should accept 'chat' type", () => {
    const result = TaskTemplateTypeSchema.safeParse("chat");
    expect(result.success).toBe(true);
  });

  it("should accept 'general' type", () => {
    const result = TaskTemplateTypeSchema.safeParse("general");
    expect(result.success).toBe(true);
  });

  it("should reject unknown type", () => {
    const result = TaskTemplateTypeSchema.safeParse("sequential");
    expect(result.success).toBe(false);
  });
});

describe("ModelOptionsSchema", () => {
  it("should accept valid model options", () => {
    const result = ModelOptionsSchema.safeParse({
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty object", () => {
    const result = ModelOptionsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject temperature above 2", () => {
    const result = ModelOptionsSchema.safeParse({ temperature: 3.0 });
    expect(result.success).toBe(false);
  });

  it("should reject negative max_tokens", () => {
    const result = ModelOptionsSchema.safeParse({ max_tokens: -1 });
    expect(result.success).toBe(false);
  });

  it("should reject top_p above 1", () => {
    const result = ModelOptionsSchema.safeParse({ top_p: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe("ChatPromptConfigSchema", () => {
  it("should accept valid chat config", () => {
    const result = ChatPromptConfigSchema.safeParse({
      systemMessage: "You are a helpful assistant.",
      userMessage: "Hello {{name}}",
      inputVariables: ["name"],
    });
    expect(result.success).toBe(true);
  });

  it("should require userMessage", () => {
    const result = ChatPromptConfigSchema.safeParse({
      systemMessage: "System prompt",
      userMessage: "",
      inputVariables: [],
    });
    expect(result.success).toBe(false);
  });

  it("should accept empty systemMessage", () => {
    const result = ChatPromptConfigSchema.safeParse({
      systemMessage: "",
      userMessage: "Hello",
      inputVariables: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("GeneralPromptConfigSchema", () => {
  it("should accept valid general config with examples", () => {
    const result = GeneralPromptConfigSchema.safeParse({
      instruction: "Translate the following text to French.",
      context: "{{text}}",
      inputVariables: ["text"],
      examples: [
        { input: "Hello", output: "Bonjour" },
        { input: "Goodbye", output: "Au revoir" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should accept config without examples", () => {
    const result = GeneralPromptConfigSchema.safeParse({
      instruction: "Summarize the following.",
      inputVariables: [],
    });
    expect(result.success).toBe(true);
  });

  it("should require instruction", () => {
    const result = GeneralPromptConfigSchema.safeParse({
      instruction: "",
      inputVariables: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateTaskTemplateInput", () => {
  const validInput = {
    projectId: "proj-123",
    name: "my-template",
    type: "chat",
    managedModelId: "gpt-4o",
    promptConfig: {
      systemMessage: "You are helpful.",
      userMessage: "Hello {{name}}",
      inputVariables: ["name"],
    },
  };

  it("should accept valid create input", () => {
    const result = CreateTaskTemplateInput.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("chat");
      expect(result.data.outputKey).toBe("text");
      expect(result.data.labels).toEqual([]);
    }
  });

  it("should require name", () => {
    const result = CreateTaskTemplateInput.safeParse({
      ...validInput,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("should require managedModelId", () => {
    const result = CreateTaskTemplateInput.safeParse({
      ...validInput,
      managedModelId: "",
    });
    expect(result.success).toBe(false);
  });

  it("should default type to chat", () => {
    const { type: _, ...inputWithoutType } = validInput;
    const result = CreateTaskTemplateInput.safeParse(inputWithoutType);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("chat");
    }
  });
});

describe("validatePromptConfig", () => {
  it("should validate valid chat config", () => {
    const result = validatePromptConfig({
      type: "chat",
      promptConfig: {
        systemMessage: "System",
        userMessage: "Hello",
        inputVariables: [],
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid chat config", () => {
    const result = validatePromptConfig({
      type: "chat",
      promptConfig: {
        instruction: "This is a general config, not chat",
        inputVariables: [],
      },
    });
    expect(result.success).toBe(false);
  });

  it("should validate valid general config", () => {
    const result = validatePromptConfig({
      type: "general",
      promptConfig: {
        instruction: "Do something.",
        inputVariables: [],
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject unknown type", () => {
    const result = validatePromptConfig({
      type: "sequential",
      promptConfig: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unknown template type");
    }
  });
});

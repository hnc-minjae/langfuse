/** @jest-environment node */

import {
  substituteVariables,
  extractVariables,
  validateInputs,
  buildMessages,
} from "@/src/features/task-templates/server/promptBuilder";
import { ChatMessageRole } from "@langfuse/shared";
import { ChatMessageType } from "@langfuse/shared/src/server";

describe("substituteVariables", () => {
  it("should substitute {{var}} double-brace variables", () => {
    const result = substituteVariables({
      template: "Hello {{name}}, welcome to {{place}}!",
      variables: { name: "Alice", place: "Wonderland" },
    });
    expect(result).toBe("Hello Alice, welcome to Wonderland!");
  });

  it("should substitute {var} single-brace variables", () => {
    const result = substituteVariables({
      template: "Hello {name}, welcome to {place}!",
      variables: { name: "Bob", place: "Narnia" },
    });
    expect(result).toBe("Hello Bob, welcome to Narnia!");
  });

  it("should handle mixed brace styles", () => {
    const result = substituteVariables({
      template: "{{greeting}} {name}!",
      variables: { greeting: "Hi", name: "Charlie" },
    });
    expect(result).toBe("Hi Charlie!");
  });

  it("should preserve unmatched variables", () => {
    const result = substituteVariables({
      template: "Hello {{name}}, your id is {{id}}.",
      variables: { name: "Dave" },
    });
    expect(result).toBe("Hello Dave, your id is {{id}}.");
  });

  it("should preserve unmatched single-brace variables", () => {
    const result = substituteVariables({
      template: "Hello {name}, your id is {id}.",
      variables: { name: "Eve" },
    });
    expect(result).toBe("Hello Eve, your id is {id}.");
  });

  it("should not replace single braces inside double braces", () => {
    const result = substituteVariables({
      template: "Value is {{code}}",
      variables: { code: "ABC" },
    });
    expect(result).toBe("Value is ABC");
  });

  it("should handle empty template", () => {
    const result = substituteVariables({ template: "", variables: { a: "1" } });
    expect(result).toBe("");
  });

  it("should handle template with no variables", () => {
    const result = substituteVariables({
      template: "No variables here.",
      variables: { a: "1" },
    });
    expect(result).toBe("No variables here.");
  });
});

describe("extractVariables", () => {
  it("should extract double-brace variables", () => {
    const vars = extractVariables("Hello {{name}}, age {{age}}");
    expect(vars).toContain("name");
    expect(vars).toContain("age");
    expect(vars).toHaveLength(2);
  });

  it("should extract single-brace variables", () => {
    const vars = extractVariables("Hello {name}");
    expect(vars).toContain("name");
  });

  it("should return unique variables", () => {
    const vars = extractVariables("{{name}} and {{name}} again");
    expect(vars).toHaveLength(1);
    expect(vars).toContain("name");
  });

  it("should return empty array for no variables", () => {
    const vars = extractVariables("No variables");
    expect(vars).toHaveLength(0);
  });
});

describe("validateInputs", () => {
  it("should return empty missing array when all inputs provided", () => {
    const { missing } = validateInputs({
      inputVariables: ["name", "age"],
      inputs: { name: "Alice", age: "30" },
    });
    expect(missing).toEqual([]);
  });

  it("should return missing variables", () => {
    const { missing } = validateInputs({
      inputVariables: ["name", "age", "city"],
      inputs: { name: "Alice" },
    });
    expect(missing).toEqual(["age", "city"]);
  });

  it("should return empty when no variables required", () => {
    const { missing } = validateInputs({
      inputVariables: [],
      inputs: {},
    });
    expect(missing).toEqual([]);
  });
});

describe("buildMessages - chat type", () => {
  it("should build system and user messages for chat type", () => {
    const messages = buildMessages({
      type: "chat",
      promptConfig: {
        systemMessage: "You are a {{role}}.",
        userMessage: "Tell me about {{topic}}",
        inputVariables: ["role", "topic"],
      },
      inputs: { role: "teacher", topic: "AI" },
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe(ChatMessageRole.System);
    expect(messages[0].content).toBe("You are a teacher.");
    expect(messages[1].role).toBe(ChatMessageRole.User);
    expect(messages[1].content).toBe("Tell me about AI");
  });

  it("should skip empty systemMessage", () => {
    const messages = buildMessages({
      type: "chat",
      promptConfig: {
        systemMessage: "",
        userMessage: "Hello",
        inputVariables: [],
      },
      inputs: {},
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe(ChatMessageRole.User);
  });

  it("should substitute single-brace variables in chat messages", () => {
    const messages = buildMessages({
      type: "chat",
      promptConfig: {
        systemMessage: "Role: {role}",
        userMessage: "Topic: {topic}",
        inputVariables: ["role", "topic"],
      },
      inputs: { role: "expert", topic: "math" },
    });

    expect(messages[0].content).toBe("Role: expert");
    expect(messages[1].content).toBe("Topic: math");
  });
});

describe("buildMessages - general type", () => {
  it("should build instruction, examples, and user message", () => {
    const messages = buildMessages({
      type: "general",
      promptConfig: {
        instruction: "Translate text to French.",
        inputVariables: ["text"],
        examples: [
          { input: "Hello", output: "Bonjour" },
          { input: "Goodbye", output: "Au revoir" },
        ],
      },
      inputs: { text: "Good morning" },
    });

    // System(instruction) + 2 example pairs (4 messages) + User(input)
    expect(messages).toHaveLength(6);
    expect(messages[0].role).toBe(ChatMessageRole.System);
    expect(messages[0].content).toBe("Translate text to French.");

    // Example 1
    expect(messages[1].role).toBe(ChatMessageRole.User);
    expect(messages[1].content).toBe("Hello");
    expect(messages[2].role).toBe(ChatMessageRole.Assistant);
    expect(messages[2].content).toBe("Bonjour");

    // Example 2
    expect(messages[3].role).toBe(ChatMessageRole.User);
    expect(messages[3].content).toBe("Goodbye");
    expect(messages[4].role).toBe(ChatMessageRole.Assistant);
    expect(messages[4].content).toBe("Au revoir");

    // User input
    expect(messages[5].role).toBe(ChatMessageRole.User);
    expect(messages[5].content).toContain("Good morning");
  });

  it("should build general messages without examples", () => {
    const messages = buildMessages({
      type: "general",
      promptConfig: {
        instruction: "Summarize: {{text}}",
        inputVariables: ["text"],
      },
      inputs: { text: "A long paragraph." },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe(ChatMessageRole.System);
    expect(messages[0].content).toBe("Summarize: A long paragraph.");
  });

  it("should include context in user message", () => {
    const messages = buildMessages({
      type: "general",
      promptConfig: {
        instruction: "Answer the question.",
        context: "Context: {{context}}",
        inputVariables: ["context", "question"],
      },
      inputs: {
        context: "The sky is blue.",
        question: "What color is the sky?",
      },
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("Answer the question.");

    const userContent = messages[1].content;
    expect(userContent).toContain("The sky is blue.");
    expect(userContent).toContain("What color is the sky?");
  });

  it("should throw for unsupported type", () => {
    expect(() =>
      buildMessages({
        type: "sequential",
        promptConfig: {},
        inputs: {},
      }),
    ).toThrow("Unsupported template type: sequential");
  });
});

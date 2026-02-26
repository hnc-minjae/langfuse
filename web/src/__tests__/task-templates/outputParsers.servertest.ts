/** @jest-environment node */

import {
  LineListOutputParser,
  JsonOutputFilter,
  JsonKeyStreamingParser,
  getOutputFilter,
  getOutputParser,
  getStreamingParser,
} from "@/src/features/task-templates/server/outputParsers";
import type { StreamingParserListener } from "@/src/features/task-templates/types";

// ── LineListOutputParser ──────────────────────────────────

describe("LineListOutputParser", () => {
  const parser = new LineListOutputParser();

  it("should split text by newlines", () => {
    const result = parser.parse("line1\nline2\nline3");
    expect(result).toEqual(["line1", "line2", "line3"]);
  });

  it("should return single-element array for text without newlines", () => {
    const result = parser.parse("single line");
    expect(result).toEqual(["single line"]);
  });

  it("should preserve empty lines (matches coconut SDK behavior)", () => {
    const result = parser.parse("line1\n\nline3");
    expect(result).toEqual(["line1", "", "line3"]);
  });

  it("should handle empty string", () => {
    const result = parser.parse("");
    expect(result).toEqual([""]);
  });
});

// ── JsonOutputFilter ──────────────────────────────────────

describe("JsonOutputFilter", () => {
  const filter = new JsonOutputFilter();

  it("should pass through valid JSON", () => {
    const input = '{"key": "value"}';
    expect(filter.filter(input)).toBe(input);
  });

  it("should extract JSON from surrounding text", () => {
    const input = 'Here is the result:\n{"key": "value"}\nDone!';
    const result = filter.filter(input);
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  it("should fix extra trailing commas", () => {
    const input = '{"key": "value",}';
    const result = filter.filter(input);
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  it("should fix unclosed braces", () => {
    const input = '{"key": "value"';
    const result = filter.filter(input);
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  it("should fix unclosed brackets", () => {
    const input = '["a", "b"';
    const result = filter.filter(input);
    expect(JSON.parse(result)).toEqual(["a", "b"]);
  });

  it("should handle valid JSON array", () => {
    const input = '["a", "b", "c"]';
    expect(filter.filter(input)).toBe(input);
  });

  it("should throw for non-JSON content", () => {
    expect(() => filter.filter("not json at all")).toThrow(
      "No JSON structure found",
    );
  });

  it("should extract JSON from markdown code block", () => {
    const input = '```json\n{"title": "AI"}\n```';
    const result = filter.filter(input);
    expect(JSON.parse(result)).toEqual({ title: "AI" });
  });
});

// ── JsonKeyStreamingParser ────────────────────────────────

describe("JsonKeyStreamingParser", () => {
  let parser: JsonKeyStreamingParser;
  let events: Array<{ type: string; key: string; delta?: string }>;
  let listener: StreamingParserListener;

  beforeEach(() => {
    parser = new JsonKeyStreamingParser();
    events = [];
    listener = {
      onKeyStart: (key) => events.push({ type: "keyStart", key }),
      onValueDelta: (key, delta) =>
        events.push({ type: "valueDelta", key, delta }),
      onKeyEnd: (key) => events.push({ type: "keyEnd", key }),
    };
    parser.setListener(listener);
  });

  it("should parse a single key-value pair", () => {
    parser.accept('{"title": "AI"}');
    parser.complete();

    expect(events[0]).toEqual({ type: "keyStart", key: "title" });
    const deltas = events
      .filter((e) => e.type === "valueDelta")
      .map((e) => e.delta)
      .join("");
    expect(deltas).toBe("AI");
    expect(events[events.length - 1]).toEqual({
      type: "keyEnd",
      key: "title",
    });
  });

  it("should parse multiple key-value pairs", () => {
    parser.accept('{"a": "1", "b": "2"}');
    parser.complete();

    const keyStarts = events
      .filter((e) => e.type === "keyStart")
      .map((e) => e.key);
    expect(keyStarts).toEqual(["a", "b"]);

    const keyEnds = events.filter((e) => e.type === "keyEnd").map((e) => e.key);
    expect(keyEnds).toEqual(["a", "b"]);
  });

  it("should handle streaming tokens split across multiple calls", () => {
    parser.accept('{"ti');
    parser.accept('tle": "A');
    parser.accept("I 개론");
    parser.accept('"}');
    parser.complete();

    expect(events[0]).toEqual({ type: "keyStart", key: "title" });
    const deltas = events
      .filter((e) => e.type === "valueDelta")
      .map((e) => e.delta)
      .join("");
    expect(deltas).toBe("AI 개론");
  });

  it("should handle escape sequences in values", () => {
    parser.accept('{"msg": "hello \\"world\\""}');
    parser.complete();

    const deltas = events
      .filter((e) => e.type === "valueDelta")
      .map((e) => e.delta)
      .join("");
    // Includes backslash characters as they come through
    expect(deltas).toContain("\\");
    expect(deltas).toContain("world");
  });

  it("should handle escape sequences in keys", () => {
    parser.accept('{"key\\"name": "value"}');
    parser.complete();

    const keyStarts = events
      .filter((e) => e.type === "keyStart")
      .map((e) => e.key);
    expect(keyStarts).toEqual(['key"name']);
  });

  it("should handle empty value", () => {
    parser.accept('{"key": ""}');
    parser.complete();

    expect(events).toEqual([
      { type: "keyStart", key: "key" },
      { type: "keyEnd", key: "key" },
    ]);
  });

  it("should handle incomplete stream via complete()", () => {
    parser.accept('{"key": "partial value');
    // Stream ends without closing quote
    parser.complete();

    const keyEnds = events.filter((e) => e.type === "keyEnd");
    expect(keyEnds.length).toBe(1); // complete() should close open key
  });

  it("should reset state properly", () => {
    parser.accept('{"a": "1"}');
    parser.complete();
    const firstEvents = [...events];

    events = [];
    parser.reset();
    parser.setListener(listener);
    parser.accept('{"b": "2"}');
    parser.complete();

    const secondKeyStarts = events
      .filter((e) => e.type === "keyStart")
      .map((e) => e.key);
    expect(secondKeyStarts).toEqual(["b"]);
    expect(firstEvents.some((e) => e.key === "a")).toBe(true);
  });
});

// ── Factory functions ─────────────────────────────────────

describe("Factory functions", () => {
  it("getOutputFilter should return JsonOutputFilter", () => {
    expect(getOutputFilter("JsonOutputFilter")).toBeInstanceOf(
      JsonOutputFilter,
    );
  });

  it("getOutputFilter should return null for unknown name", () => {
    expect(getOutputFilter("UnknownFilter")).toBeNull();
  });

  it("getOutputFilter should return null for empty name", () => {
    expect(getOutputFilter("")).toBeNull();
    expect(getOutputFilter(undefined)).toBeNull();
  });

  it("getOutputParser should return LineListOutputParser", () => {
    expect(getOutputParser("LineListOutputParser")).toBeInstanceOf(
      LineListOutputParser,
    );
  });

  it("getOutputParser should return null for unknown name", () => {
    expect(getOutputParser("UnknownParser")).toBeNull();
  });

  it("getStreamingParser should return JsonKeyStreamingParser", () => {
    expect(
      getStreamingParser("JsonObjectKeyRouterStreamingParser"),
    ).toBeInstanceOf(JsonKeyStreamingParser);
  });

  it("getStreamingParser should return null for unknown name", () => {
    expect(getStreamingParser("UnknownParser")).toBeNull();
  });
});

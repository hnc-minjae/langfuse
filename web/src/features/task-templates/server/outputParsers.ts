import type { StreamingParserListener } from "../types";

// ── OutputFilter (pre-processing) ───────────────────────────

/**
 * Pre-processes raw LLM output before parsing.
 * Applied BEFORE OutputParser in the processing pipeline.
 */
export interface OutputFilter {
  filter(text: string): string;
}

/**
 * Fixes malformed JSON output from LLMs.
 * Ported from coconut SDK's JsonOutputFilter.java.
 *
 * Attempts to fix common JSON issues:
 * - Extracts JSON from surrounding text (e.g., markdown code blocks)
 * - Removes invalid control characters
 * - Fixes extra trailing commas before } or ]
 * - Fixes unclosed braces/brackets
 */
export class JsonOutputFilter implements OutputFilter {
  filter(text: string): string {
    // Try parsing as-is first
    try {
      JSON.parse(text);
      return text;
    } catch {
      // Fall through to fixing
    }

    let json = this.extractJson(text);
    if (!json) {
      throw new Error("No JSON structure found in output");
    }

    json = this.removeControlChars(json);
    json = this.fixExtraCommas(json);
    json = this.fixUnclosedBraces(json);

    // Validate the fixed JSON
    try {
      JSON.parse(json);
      return json;
    } catch {
      throw new Error(`Failed to fix JSON: ${json.slice(0, 200)}`);
    }
  }

  private extractJson(input: string): string | null {
    const firstBrace = input.indexOf("{");
    const firstBracket = input.indexOf("[");
    const startIndex = Math.min(
      firstBrace !== -1 ? firstBrace : Infinity,
      firstBracket !== -1 ? firstBracket : Infinity,
    );

    if (startIndex === Infinity) return null;

    const lastBrace = input.lastIndexOf("}");
    const lastBracket = input.lastIndexOf("]");
    const endIndex = Math.max(lastBrace, lastBracket);

    // If closing brace/bracket found, extract up to it
    if (endIndex !== -1 && endIndex > startIndex) {
      return input.substring(startIndex, endIndex + 1);
    }

    // No closing brace/bracket — return from start to end (for unclosed fix)
    return input.substring(startIndex);
  }

  private removeControlChars(json: string): string {
    // Remove control characters except \n, \t, \r
    return json.replace(/[\x00-\x1F&&[^\n\t\r]]/g, "");
  }

  private fixExtraCommas(json: string): string {
    return json.replace(/,\s*([}\]])/g, "$1");
  }

  private fixUnclosedBraces(json: string): string {
    let result = json;
    const openBraces = (result.match(/{/g) || []).length;
    const closeBraces = (result.match(/}/g) || []).length;
    for (let i = closeBraces; i < openBraces; i++) {
      result += "}";
    }

    const openBrackets = (result.match(/\[/g) || []).length;
    const closeBrackets = (result.match(/]/g) || []).length;
    for (let i = closeBrackets; i < openBrackets; i++) {
      result += "]";
    }
    return result;
  }
}

// ── OutputParser (post-processing) ──────────────────────────

/**
 * Transforms completed LLM output into structured data.
 * Applied AFTER OutputFilter in the processing pipeline.
 */
export interface OutputParser {
  parse(text: string): string | string[];
}

/**
 * Splits text by newlines into a string array.
 * Ported from coconut SDK's LineListOutputParser.java.
 * Matches original behavior: simple split("\n") without filtering.
 */
export class LineListOutputParser implements OutputParser {
  parse(text: string): string[] {
    return text.split("\n");
  }
}

// ── StreamingParser (real-time token parsing) ───────────────

type ParserState =
  | "SEEK_KEY_QUOTE"
  | "READ_KEY"
  | "SEEK_COLON"
  | "SEEK_VALUE_QUOTE"
  | "READ_VALUE"
  | "SEEK_COMMA_OR_END";

/**
 * Character-by-character JSON streaming parser.
 * Ported from coconut SDK's JsonKeyStreamingParser.java.
 *
 * Parses streaming JSON object tokens and emits events per key:
 *   {"key1": "val1", "key2": "val2"}
 *   → onKeyStart("key1") → onValueDelta("key1", "v") → ... → onKeyEnd("key1")
 *   → onKeyStart("key2") → ...
 *
 * Limitations: only supports string values (no numbers, arrays, nested objects).
 */
export class JsonKeyStreamingParser {
  private state: ParserState = "SEEK_KEY_QUOTE";
  private listener: StreamingParserListener | null = null;
  private buf = "";
  private currentKey: string | null = null;
  private escape = false;

  reset(): void {
    this.state = "SEEK_KEY_QUOTE";
    this.buf = "";
    this.currentKey = null;
    this.escape = false;
  }

  setListener(listener: StreamingParserListener): void {
    this.listener = listener;
  }

  /**
   * Feed streaming token delta into the parser.
   * Each character is processed through the state machine.
   */
  accept(tokenDelta: string): void {
    if (!tokenDelta) return;
    for (let i = 0; i < tokenDelta.length; i++) {
      this.step(tokenDelta[i]);
    }
  }

  /**
   * Called when streaming ends. Flushes any pending state.
   */
  complete(): void {
    // If value was open when stream ended, close it
    if (this.state === "READ_VALUE" && this.currentKey && this.listener) {
      this.listener.onKeyEnd(this.currentKey);
    }
    this.reset();
  }

  private step(c: string): void {
    switch (this.state) {
      case "SEEK_KEY_QUOTE":
        if (c === '"') {
          this.buf = "";
          this.escape = false;
          this.state = "READ_KEY";
        }
        break;

      case "READ_KEY":
        if (this.escape) {
          this.buf += c;
          this.escape = false;
        } else if (c === "\\") {
          this.escape = true;
        } else if (c === '"') {
          this.currentKey = this.buf;
          this.buf = "";
          if (this.listener && this.currentKey) {
            this.listener.onKeyStart(this.currentKey);
          }
          this.state = "SEEK_COLON";
        } else {
          this.buf += c;
        }
        break;

      case "SEEK_COLON":
        if (c === ":") {
          this.state = "SEEK_VALUE_QUOTE";
        }
        break;

      case "SEEK_VALUE_QUOTE":
        if (c === '"') {
          this.escape = false;
          this.state = "READ_VALUE";
        }
        break;

      case "READ_VALUE":
        if (this.escape) {
          if (this.listener && this.currentKey) {
            this.listener.onValueDelta(this.currentKey, c);
          }
          this.escape = false;
        } else if (c === "\\") {
          if (this.listener && this.currentKey) {
            this.listener.onValueDelta(this.currentKey, "\\");
          }
          this.escape = true;
        } else if (c === '"') {
          // Value string ended
          if (this.listener && this.currentKey) {
            this.listener.onKeyEnd(this.currentKey);
          }
          this.state = "SEEK_COMMA_OR_END";
        } else {
          if (this.listener && this.currentKey) {
            this.listener.onValueDelta(this.currentKey, c);
          }
        }
        break;

      case "SEEK_COMMA_OR_END":
        if (c === "," || c === "}") {
          this.currentKey = null;
          this.state = "SEEK_KEY_QUOTE";
        }
        break;
    }
  }
}

// ── Factory functions ───────────────────────────────────────

export function getOutputFilter(name?: string): OutputFilter | null {
  if (!name) return null;
  switch (name) {
    case "JsonOutputFilter":
      return new JsonOutputFilter();
    default:
      return null;
  }
}

export function getOutputParser(name?: string): OutputParser | null {
  if (!name) return null;
  switch (name) {
    case "LineListOutputParser":
      return new LineListOutputParser();
    default:
      return null;
  }
}

export function getStreamingParser(
  name?: string,
): JsonKeyStreamingParser | null {
  if (!name) return null;
  switch (name) {
    case "JsonObjectKeyRouterStreamingParser":
      return new JsonKeyStreamingParser();
    default:
      return null;
  }
}

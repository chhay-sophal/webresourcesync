import { describe, expect, it } from "vitest";
import { base64ToUtf8, utf8ToBase64 } from "./base64";

describe("base64 round-trip", () => {
  it("round-trips plain ASCII", () => {
    const original = "console.log('hello world');";
    expect(base64ToUtf8(utf8ToBase64(original))).toBe(original);
  });

  it("round-trips empty content", () => {
    expect(base64ToUtf8(utf8ToBase64(""))).toBe("");
  });

  it("round-trips multi-byte UTF-8 (emoji, non-Latin script)", () => {
    const original = "// TODO: fix this 🐛 — see 説明";
    expect(base64ToUtf8(utf8ToBase64(original))).toBe(original);
  });

  it("round-trips content with newlines and tabs", () => {
    const original = "function f() {\n\treturn 1;\n}\n";
    expect(base64ToUtf8(utf8ToBase64(original))).toBe(original);
  });
});

import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWithinRoot } from "./files.js";

const ROOT = path.resolve("/watched/root");

describe("resolveWithinRoot", () => {
  it("resolves a plain relative path inside the root", () => {
    expect(resolveWithinRoot(ROOT, "script.js")).toBe(path.join(ROOT, "script.js"));
  });

  it("resolves a nested subdirectory path", () => {
    expect(resolveWithinRoot(ROOT, "scripts/nested/file.js")).toBe(
      path.join(ROOT, "scripts", "nested", "file.js")
    );
  });

  it("rejects a relative path that escapes the root via ../", () => {
    expect(() => resolveWithinRoot(ROOT, "../outside.js")).toThrow("Path escapes watched root");
  });

  it("rejects a deeply nested escape attempt", () => {
    expect(() => resolveWithinRoot(ROOT, "scripts/../../outside.js")).toThrow(
      "Path escapes watched root"
    );
  });

  it("rejects an absolute path pointing outside the root", () => {
    expect(() => resolveWithinRoot(ROOT, path.resolve("/etc/passwd"))).toThrow(
      "Path escapes watched root"
    );
  });

  // Regression test: a naive `resolved.startsWith(root)` check (without a trailing separator)
  // would wrongly allow this, since "/watched/root-evil" is a *string* prefix match for
  // "/watched/root" even though it's a completely different, sibling directory.
  it("rejects a sibling directory whose name merely starts with the root's name", () => {
    const sibling = ROOT + "-evil";
    expect(() => resolveWithinRoot(ROOT, path.relative(ROOT, path.join(sibling, "file.js")))).toThrow(
      "Path escapes watched root"
    );
  });

  it("allows the root directory itself", () => {
    expect(resolveWithinRoot(ROOT, ".")).toBe(path.resolve(ROOT));
  });
});

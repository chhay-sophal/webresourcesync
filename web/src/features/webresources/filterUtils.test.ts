import { describe, expect, it } from "vitest";
import { deserializeFilters, matchesText, serializeFilters } from "./filterUtils";

describe("matchesText", () => {
  it("matches everything when the pattern is blank", () => {
    expect(matchesText("anything", "")).toBe(true);
    expect(matchesText("anything", "   ")).toBe(true);
  });

  it("does a case-insensitive contains match when there's no wildcard", () => {
    expect(matchesText("sync_contact_form", "CONTACT")).toBe(true);
    expect(matchesText("sync_contact_form", "account")).toBe(false);
  });

  it("supports * as a run of any characters", () => {
    expect(matchesText("sync_contact_form.js", "*_form.js")).toBe(true);
    expect(matchesText("sync_contact_form.js", "sync_*")).toBe(true);
    expect(matchesText("sync_contact_form.js", "sync_*.css")).toBe(false);
  });

  it("supports ? as exactly one character", () => {
    expect(matchesText("v1_form", "v?_form")).toBe(true);
    expect(matchesText("v12_form", "v?_form")).toBe(false);
  });

  it("is a full-pattern match once a wildcard is present, not a substring match", () => {
    // No wildcard -> substring match ("contact" matches within a longer name).
    expect(matchesText("sync_contact_form", "contact")).toBe(true);
    // Wildcard present -> the whole value must match the pattern, not just a substring.
    expect(matchesText("sync_contact_form", "contact*")).toBe(false);
  });

  it("escapes regex-special characters in the literal parts of a wildcard pattern", () => {
    expect(matchesText("v1.0_form", "v1.0_*")).toBe(true);
    expect(matchesText("v1X0_form", "v1.0_*")).toBe(false);
  });
});

describe("filter serialization round-trip", () => {
  it("round-trips a Set of type codes through JSON-friendly storage", () => {
    const filters = { name: "sync_*", displayname: "", types: new Set([1, 3, 11]), managed: "unmanaged" as const };
    const restored = deserializeFilters(serializeFilters(filters));
    expect(restored.types).toBeInstanceOf(Set);
    expect([...restored.types].sort((a, b) => a - b)).toEqual([1, 3, 11]);
    expect(restored).toEqual(filters);
  });

  it("round-trips an empty type set", () => {
    const filters = { name: "", displayname: "", types: new Set<number>(), managed: "all" as const };
    const restored = deserializeFilters(serializeFilters(filters));
    expect(restored.types.size).toBe(0);
  });
});

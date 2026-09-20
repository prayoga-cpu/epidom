import { describe, it, expect } from "vitest";
import { parsePrefillEmail } from "../lib/prefill-email";

describe("parsePrefillEmail", () => {
  it.each([
    ["a plain address", "jane@bakery.com", "jane@bakery.com"],
    ["a plus-tagged address", "jane+shop@bakery.com", "jane+shop@bakery.com"],
    ["a subdomain address", "jane@mail.bakery.co.id", "jane@mail.bakery.co.id"],
    ["upper-case letters, kept as typed", "Jane@Bakery.com", "Jane@Bakery.com"],
  ])("accepts %s", (_label, input, expected) => {
    expect(parsePrefillEmail(input)).toBe(expected);
  });

  it("trims surrounding whitespace", () => {
    expect(parsePrefillEmail("  jane@bakery.com \n")).toBe("jane@bakery.com");
  });

  it.each([
    ["null (param absent)", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["text with no @", "not-an-email"],
    ["a missing domain", "jane@"],
    ["a missing local part", "@bakery.com"],
    ["a domain with no dot", "jane@bakery"],
    ["an address with an inner space", "jane doe@bakery.com"],
    ["two addresses", "a@b.com,c@d.com"],
  ])("ignores %s", (_label, input) => {
    expect(parsePrefillEmail(input)).toBe("");
  });

  it.each([
    ["a script tag", "<script>alert(1)</script>"],
    ["a script tag wrapped in an address", "<script>alert(1)</script>@bakery.com"],
    ["an attribute breakout", '"><img src=x onerror=alert(1)>@bakery.com'],
    ["an html-entity payload", "jane&lt;b&gt;@bakery.com"],
    ["a javascript: url", "javascript:alert(1)"],
    ["a data: url", "data:text/html,<b>x</b>@bakery.com"],
    ["a trailing tag", "jane@bakery.com<b>"],
  ])("ignores %s", (_label, input) => {
    expect(parsePrefillEmail(input)).toBe("");
  });

  it("ignores an address longer than the RFC 5321 limit of 254 characters", () => {
    const local = "a".repeat(64);
    const tooLong = `${local}@${"b".repeat(190)}.com`;
    expect(tooLong.length).toBeGreaterThan(254);
    expect(parsePrefillEmail(tooLong)).toBe("");
  });

  it("accepts an address exactly at the 254-character limit", () => {
    const address = `${"a".repeat(64)}@${"b".repeat(185)}.com`;
    expect(address.length).toBe(254);
    expect(parsePrefillEmail(address)).toBe(address);
  });
});

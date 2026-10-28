// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createUnsubscribeToken,
  oneClickUnsubscribeUrl,
  unsubscribePageUrl,
  verifyUnsubscribeToken,
} from "../unsubscribe-token";

const env = { ...process.env };

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://epidom.fr/";
});

afterEach(() => {
  process.env = { ...env };
});

describe("unsubscribe tokens", () => {
  it("round-trips the address, lowercased", () => {
    expect(verifyUnsubscribeToken(createUnsubscribeToken(" Jane@Bakery.com "))).toBe("jane@bakery.com");
  });

  it("rejects a token whose address was swapped", () => {
    const [, signature] = createUnsubscribeToken("jane@bakery.com").split(".");
    const forged = `${Buffer.from("boss@bakery.com").toString("base64url")}.${signature}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createUnsubscribeToken("jane@bakery.com");
    process.env.BETTER_AUTH_SECRET = "rotated";
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("rejects garbage", () => {
    for (const bad of [null, "", "abc", "abc.def", "...."]) {
      expect(verifyUnsubscribeToken(bad)).toBeNull();
    }
  });

  it("builds the page and one-click URLs on the app URL", () => {
    expect(unsubscribePageUrl("jane@bakery.com", "fr")).toMatch(
      /^https:\/\/epidom\.fr\/newsletter\/unsubscribe\?t=[\w-]+\.[\w-]+&l=fr$/
    );
    expect(oneClickUnsubscribeUrl("jane@bakery.com")).toMatch(
      /^https:\/\/epidom\.fr\/api\/public\/newsletter\/unsubscribe\?t=[\w-]+\.[\w-]+$/
    );
  });
});

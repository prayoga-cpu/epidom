import { describe, it, expect } from "vitest";
import {
  TRANSFER_IDENTIFIER_PREFIX,
  buildAcceptUrl,
  generateTransferToken,
  parseTransferValue,
  transferIdentifier,
} from "../store-transfer";
import { safeInternalPath } from "../safe-redirect";
import {
  initiateStoreTransferSchema,
  transferTokenSchema,
} from "../validation/store-transfer.schemas";

describe("generateTransferToken", () => {
  it("is 32 random bytes as 64 lowercase hex chars — the exact shape transferTokenSchema accepts", () => {
    const token = generateTransferToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(transferTokenSchema.safeParse({ token }).success).toBe(true);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateTransferToken()));
    expect(tokens.size).toBe(200);
  });
});

describe("transferIdentifier", () => {
  it("is keyed by the token under the shared prefix", () => {
    expect(transferIdentifier("abc")).toBe(`${TRANSFER_IDENTIFIER_PREFIX}abc`);
    expect(TRANSFER_IDENTIFIER_PREFIX).toBe("store-transfer:");
  });
});

describe("parseTransferValue", () => {
  const valid = { storeId: "s1", toEmail: "a@b.co", fromUserId: "u1", storeName: "Kopi" };

  it("round-trips a well-formed value", () => {
    expect(parseTransferValue(JSON.stringify(valid))).toEqual(valid);
  });

  it("drops any extra keys rather than trusting them", () => {
    const parsed = parseTransferValue(JSON.stringify({ ...valid, isAdmin: true, token: "x" }));
    expect(parsed).toEqual(valid);
    expect(parsed).not.toHaveProperty("isAdmin");
  });

  it.each([
    ["not JSON", "{oops"],
    ["null", "null"],
    ["a string", JSON.stringify("hi")],
    ["missing storeId", JSON.stringify({ ...valid, storeId: undefined })],
    ["missing toEmail", JSON.stringify({ ...valid, toEmail: undefined })],
    ["missing fromUserId", JSON.stringify({ ...valid, fromUserId: undefined })],
    ["missing storeName", JSON.stringify({ ...valid, storeName: undefined })],
    ["non-string field", JSON.stringify({ ...valid, storeId: 42 })],
  ])("rejects %s", (_label, raw) => {
    expect(parseTransferValue(raw)).toBeNull();
  });
});

describe("buildAcceptUrl", () => {
  it("points at the accept page with the token as the only query param", () => {
    expect(buildAcceptUrl("https://app.example.com", "tok")).toBe(
      "https://app.example.com/transfer-ownership/accept?token=tok"
    );
  });

  it("doesn't double the slash when the app URL has a trailing one", () => {
    expect(buildAcceptUrl("https://app.example.com/", "tok")).toBe(
      "https://app.example.com/transfer-ownership/accept?token=tok"
    );
  });
});

describe("transferTokenSchema", () => {
  it.each([
    ["too short", "a".repeat(63)],
    ["too long", "a".repeat(65)],
    ["uppercase hex", "A".repeat(64)],
    ["non-hex", "g".repeat(64)],
    ["with whitespace", `${"a".repeat(63)} `],
    ["empty", ""],
    ["path-traversal-ish", "../".repeat(22)],
  ])("rejects a %s token", (_label, token) => {
    expect(transferTokenSchema.safeParse({ token }).success).toBe(false);
  });

  it("rejects a missing token or a non-string one", () => {
    expect(transferTokenSchema.safeParse({}).success).toBe(false);
    expect(transferTokenSchema.safeParse({ token: 123 }).success).toBe(false);
    expect(transferTokenSchema.safeParse(null).success).toBe(false);
  });
});

describe("initiateStoreTransferSchema", () => {
  it("trims and lowercases the recipient so later comparisons are case-insensitive", () => {
    const parsed = initiateStoreTransferSchema.parse({ toEmail: "  New.Owner@Example.COM " });
    expect(parsed.toEmail).toBe("new.owner@example.com");
  });

  it.each(["", "   ", "not-an-email", "a@", "@b.co", "a b@c.co"])("rejects %j", (toEmail) => {
    expect(initiateStoreTransferSchema.safeParse({ toEmail }).success).toBe(false);
  });
});

describe("safeInternalPath", () => {
  it("accepts a same-origin path, including one carrying its own query (the accept link)", () => {
    expect(safeInternalPath("/stores")).toBe("/stores");
    expect(safeInternalPath(`/transfer-ownership/accept?token=${"a".repeat(64)}`)).toBe(
      `/transfer-ownership/accept?token=${"a".repeat(64)}`
    );
  });

  it.each([
    ["absolute http URL", "http://evil.com"],
    ["absolute https URL", "https://evil.com/x"],
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/path"],
    // Browsers normalize a backslash to "/" while parsing — "/\evil.com" IS "//evil.com".
    ["backslash trick", "/\\evil.com"],
    ["leading backslash", "\\evil.com"],
    ["javascript: URL", "javascript:alert(1)"],
    ["no leading slash", "stores"],
    ["embedded tab (stripped by URL parsing)", "/\tevil.com"],
    ["embedded newline", "/ok\nSet-Cookie: x=1"],
    ["space", "/a b"],
    ["DEL char", "/ab"],
  ])("rejects %s", (_label, value) => {
    expect(safeInternalPath(value)).toBeNull();
  });

  it("treats empty / missing as no redirect", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath("")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { formatQueueNumber } from "../queue-number";

describe("formatQueueNumber", () => {
  it("prefixes a real number with #", () => {
    expect(formatQueueNumber(1)).toBe("#1");
    expect(formatQueueNumber(128)).toBe("#128");
  });

  it("shows a dash, never '#null' or '#undefined', when there is no number", () => {
    expect(formatQueueNumber(null)).toBe("–");
    expect(formatQueueNumber(undefined)).toBe("–");
  });
});

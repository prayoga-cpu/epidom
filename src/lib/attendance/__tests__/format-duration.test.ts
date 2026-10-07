import { describe, it, expect } from "vitest";
import { formatDuration, formatSignedDuration } from "../format-duration";

describe("formatDuration", () => {
  it("drops a zero part instead of printing it", () => {
    expect(formatDuration(62)).toBe("1h 2m");
    expect(formatDuration(480)).toBe("8h");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(0)).toBe("0m");
  });

  it("uses the locale's units", () => {
    expect(formatDuration(150, { hour: "j", minute: "m" })).toBe("2j 30m");
  });
});

describe("formatSignedDuration", () => {
  it("marks time over the expected hours with a plus", () => {
    expect(formatSignedDuration(62)).toBe("+1h 2m");
  });

  it("marks time under with a true minus sign", () => {
    expect(formatSignedDuration(-150)).toBe("−2h 30m");
  });

  it("shows exactly on target as 0m, unsigned", () => {
    expect(formatSignedDuration(0)).toBe("0m");
    expect(formatSignedDuration(0.4)).toBe("0m");
  });
});

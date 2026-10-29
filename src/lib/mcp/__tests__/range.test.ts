import { describe, it, expect } from "vitest";
import { MAX_RANGE_DAYS, periodKeys, previousRange, rangeFromKeys, resolveRange } from "../range";
import { McpToolError } from "../errors";

// Wednesday 2026-10-28, 23:30 UTC = Thursday 06:30 in Jakarta, still Wednesday in Paris.
const NOW = new Date("2026-10-28T23:30:00Z");

describe("periodKeys", () => {
  it("resolves 'today' in the business's timezone, not the server's", () => {
    expect(periodKeys("today", "Asia/Jakarta", NOW)).toEqual({
      fromKey: "2026-10-29",
      toKey: "2026-10-29",
    });
    expect(periodKeys("today", "Europe/Paris", NOW)).toEqual({
      fromKey: "2026-10-29",
      toKey: "2026-10-29",
    });
    expect(periodKeys("today", "America/New_York", NOW)).toEqual({
      fromKey: "2026-10-28",
      toKey: "2026-10-28",
    });
  });

  it("weeks run Monday to Sunday", () => {
    expect(periodKeys("this_week", "Asia/Jakarta", NOW)).toEqual({
      fromKey: "2026-10-26",
      toKey: "2026-10-29",
    });
    expect(periodKeys("last_week", "Asia/Jakarta", NOW)).toEqual({
      fromKey: "2026-10-19",
      toKey: "2026-10-25",
    });
  });

  it("months are calendar months; last_month covers the whole of it", () => {
    expect(periodKeys("this_month", "Asia/Jakarta", NOW)).toEqual({
      fromKey: "2026-10-01",
      toKey: "2026-10-29",
    });
    expect(periodKeys("last_month", "Asia/Jakarta", NOW)).toEqual({
      fromKey: "2026-09-01",
      toKey: "2026-09-30",
    });
  });

  it("rolling windows include today", () => {
    expect(periodKeys("last_7_days", "Asia/Jakarta", NOW)).toEqual({
      fromKey: "2026-10-23",
      toKey: "2026-10-29",
    });
  });
});

describe("rangeFromKeys", () => {
  it("is inclusive: from the first instant of the first day to the last of the last day", () => {
    const range = rangeFromKeys("2026-10-29", "2026-10-29", "Asia/Jakarta");
    // Jakarta is UTC+7 all year.
    expect(range.from.toISOString()).toBe("2026-10-28T17:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-29T16:59:59.999Z");
  });

  it("follows a DST change (Paris leaves summer time on 25 Oct 2026)", () => {
    const range = rangeFromKeys("2026-10-24", "2026-10-25", "Europe/Paris");
    expect(range.from.toISOString()).toBe("2026-10-23T22:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-25T22:59:59.999Z");
  });

  it("refuses an inverted or overlong range with a message for the person", () => {
    expect(() => rangeFromKeys("2026-10-29", "2026-10-01", "Asia/Jakarta")).toThrow(McpToolError);
    expect(() => rangeFromKeys("2024-01-01", "2026-01-01", "Asia/Jakarta")).toThrow(
      new RegExp(`${MAX_RANGE_DAYS} days`)
    );
  });
});

describe("resolveRange", () => {
  it("needs both dates for a custom period", () => {
    expect(() => resolveRange({ period: "custom", from: "2026-10-01" }, "Asia/Jakarta")).toThrow(
      McpToolError
    );
    expect(
      resolveRange({ period: "custom", from: "2026-10-01", to: "2026-10-03" }, "Asia/Jakarta").toKey
    ).toBe("2026-10-03");
  });
});

describe("previousRange", () => {
  const tz = "Asia/Jakarta";

  it("compares this week so far with the same weekdays last week", () => {
    const current = resolveRange({ period: "this_week" }, tz, NOW);
    const prev = previousRange("this_week", current);
    expect([prev.fromKey, prev.toKey]).toEqual(["2026-10-19", "2026-10-22"]);
  });

  it("compares this month so far with the same days of last month", () => {
    const current = resolveRange({ period: "this_month" }, tz, NOW);
    const prev = previousRange("this_month", current);
    expect([prev.fromKey, prev.toKey]).toEqual(["2026-09-01", "2026-09-29"]);
  });

  it("caps the comparison at the end of a shorter month", () => {
    const current = rangeFromKeys("2026-03-01", "2026-03-31", tz);
    const prev = previousRange("last_month", current);
    expect([prev.fromKey, prev.toKey]).toEqual(["2026-02-01", "2026-02-28"]);
  });

  it("compares a day or a rolling window with the same length just before it", () => {
    const yesterday = resolveRange({ period: "yesterday" }, tz, NOW);
    expect(previousRange("yesterday", yesterday).fromKey).toBe("2026-10-27");
    const week = resolveRange({ period: "last_7_days" }, tz, NOW);
    const prev = previousRange("last_7_days", week);
    expect([prev.fromKey, prev.toKey]).toEqual(["2026-10-16", "2026-10-22"]);
  });
});

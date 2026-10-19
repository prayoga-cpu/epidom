import { describe, it, expect } from "vitest";
import {
  customDayBounds,
  customRangeQuery,
  parseCustomDays,
  resolveReportRange,
} from "../report-range";

describe("parseCustomDays", () => {
  it("reads two real days", () => {
    expect(parseCustomDays("2026-10-01", "2026-10-15")).toEqual({
      from: "2026-10-01",
      to: "2026-10-15",
    });
  });

  it("swaps reversed ends and allows one day", () => {
    expect(parseCustomDays("2026-10-15", "2026-10-01")).toEqual({
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(parseCustomDays("2026-10-19", "2026-10-19")).toEqual({
      from: "2026-10-19",
      to: "2026-10-19",
    });
  });

  it.each([
    [undefined, "2026-10-01"],
    ["2026-10-01", undefined],
    ["2026-02-30", "2026-03-01"], // no such day
    ["2026-1-1", "2026-01-02"],
    ["yesterday", "today"],
    ["2026-10-01T00:00:00Z", "2026-10-02"],
  ])("refuses %s → %s", (from, to) => {
    expect(parseCustomDays(from, to)).toBeNull();
  });
});

describe("customDayBounds", () => {
  it("runs from the first day's UTC midnight to the midnight after the last", () => {
    expect(customDayBounds({ from: "2026-10-01", to: "2026-10-01" })).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-10-02T00:00:00.000Z"),
    });
    // Across a month end and the October clock change in Europe: UTC days, no drift.
    expect(customDayBounds({ from: "2026-10-24", to: "2026-10-31" }).lt).toEqual(
      new Date("2026-11-01T00:00:00.000Z")
    );
  });
});

describe("resolveReportRange", () => {
  it("passes presets through", () => {
    expect(resolveReportRange("7", {}, "30")).toBe("7");
  });

  it("reads custom days, or falls back to the default preset when they're missing or wrong", () => {
    expect(resolveReportRange("custom", { from: "2026-10-01", to: "2026-10-02" }, "30")).toEqual({
      from: "2026-10-01",
      to: "2026-10-02",
    });
    expect(resolveReportRange("custom", { from: "2026-10-01" }, "30")).toBe("30");
    expect(resolveReportRange("custom", { from: "x", to: "y" }, "7")).toBe("7");
  });

  it("builds the query string the links keep", () => {
    expect(customRangeQuery({ from: "2026-10-01", to: "2026-10-02" })).toBe(
      "range=custom&from=2026-10-01&to=2026-10-02"
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FALLBACK_TIMEZONES,
  buildTimezoneOptions,
  formatTimezoneLabel,
  listTimezones,
  timezoneOffsetLabel,
} from "../timezone-options";

const WINTER = new Date("2026-01-15T12:00:00Z");
const SUMMER = new Date("2026-07-15T12:00:00Z");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("timezone labels", () => {
  it("reads 'Europe/Paris (UTC+01:00)' in winter and '+02:00' in summer", () => {
    expect(formatTimezoneLabel("Europe/Paris", WINTER)).toBe("Europe/Paris (UTC+01:00)");
    expect(formatTimezoneLabel("Europe/Paris", SUMMER)).toBe("Europe/Paris (UTC+02:00)");
  });

  it("shows underscores as spaces and negative offsets", () => {
    expect(formatTimezoneLabel("America/New_York", WINTER)).toBe("America/New York (UTC-05:00)");
  });

  it("writes a zero offset as UTC+00:00", () => {
    expect(timezoneOffsetLabel("UTC", WINTER)).toBe("UTC+00:00");
    expect(formatTimezoneLabel("UTC", WINTER)).toBe("UTC (UTC+00:00)");
  });

  it("falls back to the bare name for a zone Intl doesn't know", () => {
    expect(timezoneOffsetLabel("Mars/Olympus_Mons")).toBeUndefined();
    expect(formatTimezoneLabel("Mars/Olympus_Mons")).toBe("Mars/Olympus Mons");
  });
});

describe("listTimezones", () => {
  it("lists the runtime's zones, always with UTC", () => {
    const zones = listTimezones();
    expect(zones).toContain("UTC");
    expect(zones).toContain("Europe/Paris");
    expect(zones).toContain("Asia/Makassar");
    expect(new Set(zones).size).toBe(zones.length);
  });

  it("uses the fallback list when Intl.supportedValuesOf is missing", () => {
    const intl = Intl as unknown as { supportedValuesOf?: unknown };
    const original = intl.supportedValuesOf;
    intl.supportedValuesOf = undefined;
    try {
      const zones = listTimezones();
      expect(zones).toEqual(Array.from(new Set(["UTC", ...FALLBACK_TIMEZONES])));
      expect(zones).toContain("Asia/Jakarta");
      expect(zones).toContain("Europe/Paris");
    } finally {
      intl.supportedValuesOf = original;
    }
  });
});

describe("buildTimezoneOptions", () => {
  it("puts the suggested zones in the first section and keeps the rest alphabetical", () => {
    const options = buildTimezoneOptions({
      zones: ["Europe/Paris", "Asia/Jakarta", "Asia/Makassar", "UTC"],
      suggested: ["Asia/Makassar", "Asia/Jakarta"],
      date: WINTER,
    });
    expect(options.map((o) => o.value)).toEqual([
      "Asia/Jakarta",
      "Asia/Makassar",
      "Europe/Paris",
      "UTC",
    ]);
    expect(options.filter((o) => o.section === 0).map((o) => o.value)).toEqual([
      "Asia/Jakarta",
      "Asia/Makassar",
    ]);
    const paris = options.find((o) => o.value === "Europe/Paris")!;
    expect(paris.label).toBe("Europe/Paris (UTC+01:00)");
    // Search finds it by city and by offset.
    expect(paris.keywords).toEqual(expect.arrayContaining(["Paris", "UTC+01:00"]));
  });

  it("always includes the current value, even one missing from the list", () => {
    const options = buildTimezoneOptions({ zones: ["UTC"], current: "Asia/Calcutta" });
    expect(options.map((o) => o.value)).toContain("Asia/Calcutta");
  });
});

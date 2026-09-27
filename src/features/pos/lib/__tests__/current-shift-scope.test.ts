import { describe, it, expect } from "vitest";
import {
  CURRENT_SHIFT_PRESET,
  defaultScopePreset,
  effectiveScopePreset,
  isWithinOpenShift,
} from "../current-shift-scope";

describe("current shift scope", () => {
  it("opens on the shift while a till is open, and on today while none is", () => {
    expect(defaultScopePreset(true)).toBe(CURRENT_SHIFT_PRESET);
    expect(defaultScopePreset(false)).toBe("today");
  });

  it("reads a saved 'Current shift' as today while no till is open", () => {
    expect(effectiveScopePreset(CURRENT_SHIFT_PRESET, true)).toBe(CURRENT_SHIFT_PRESET);
    expect(effectiveScopePreset(CURRENT_SHIFT_PRESET, false)).toBe("today");
  });

  it("leaves every other preset alone, till or no till", () => {
    for (const preset of ["all", "today", "yesterday", "custom"]) {
      expect(effectiveScopePreset(preset, true)).toBe(preset);
      expect(effectiveScopePreset(preset, false)).toBe(preset);
    }
  });

  it("has a start but no end", () => {
    const opened = "2026-09-26T11:00:00.000Z";
    expect(isWithinOpenShift("2026-09-26T11:00:00.000Z", opened)).toBe(true);
    expect(isWithinOpenShift("2030-01-01T00:00:00.000Z", opened)).toBe(true);
    expect(isWithinOpenShift("2026-09-26T10:59:59.999Z", opened)).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { SCAN_MAX_KEY_GAP_MS } from "../../lib/barcode";
import { SCANNER_SPEED_GAP_MS, usePosScannerSettings } from "../use-pos-scanner-settings";

beforeEach(() => {
  localStorage.clear();
  usePosScannerSettings.setState({ enabled: true, speed: "standard" });
});

describe("usePosScannerSettings", () => {
  it("defaults to listening page-wide at the detector's own standard speed", () => {
    const { enabled, speed } = usePosScannerSettings.getState();
    expect(enabled).toBe(true);
    expect(speed).toBe("standard");
    expect(SCANNER_SPEED_GAP_MS.standard).toBe(SCAN_MAX_KEY_GAP_MS);
  });

  it("Slow tolerates a longer pause than Standard", () => {
    expect(SCANNER_SPEED_GAP_MS.slow).toBeGreaterThan(SCANNER_SPEED_GAP_MS.standard);
  });

  it("persists both settings per device under epidom-pos-scanner", () => {
    usePosScannerSettings.getState().setEnabled(false);
    usePosScannerSettings.getState().setSpeed("slow");
    const stored = JSON.parse(localStorage.getItem("epidom-pos-scanner") ?? "null");
    expect(stored.state).toEqual({ enabled: false, speed: "slow" });
  });

  it("restores saved settings", async () => {
    localStorage.setItem(
      "epidom-pos-scanner",
      JSON.stringify({ state: { enabled: false, speed: "slow" }, version: 0 })
    );
    await usePosScannerSettings.persist.rehydrate();
    expect(usePosScannerSettings.getState().enabled).toBe(false);
    expect(usePosScannerSettings.getState().speed).toBe("slow");
  });

  it("ignores values it doesn't recognise, field by field, instead of leaving scanning broken", async () => {
    localStorage.setItem(
      "epidom-pos-scanner",
      JSON.stringify({ state: { enabled: "yes", speed: "warp" }, version: 0 })
    );
    await usePosScannerSettings.persist.rehydrate();
    expect(usePosScannerSettings.getState().enabled).toBe(true);
    expect(usePosScannerSettings.getState().speed).toBe("standard");

    // One good field survives next to a bad one.
    localStorage.setItem(
      "epidom-pos-scanner",
      JSON.stringify({ state: { enabled: false, speed: "warp" }, version: 0 })
    );
    await usePosScannerSettings.persist.rehydrate();
    expect(usePosScannerSettings.getState().enabled).toBe(false);
    expect(usePosScannerSettings.getState().speed).toBe("standard");
  });
});

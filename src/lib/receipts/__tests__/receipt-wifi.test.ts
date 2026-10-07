import { describe, it, expect } from "vitest";
import { receiptWifiFields } from "../receipt-wifi";

describe("receiptWifiFields", () => {
  it("returns the network and password when set and switched on", () => {
    expect(
      receiptWifiFields({ wifiName: "Guest", wifiPassword: "kopi2026", showWifiOnReceipt: true })
    ).toEqual({ wifiName: "Guest", wifiPassword: "kopi2026" });
  });

  it("returns nothing when the store has no network name", () => {
    expect(
      receiptWifiFields({ wifiName: "  ", wifiPassword: "x", showWifiOnReceipt: true })
    ).toEqual({});
    expect(receiptWifiFields(null)).toEqual({});
    expect(receiptWifiFields(undefined)).toEqual({});
  });

  it("returns nothing when the owner switched it off", () => {
    expect(
      receiptWifiFields({ wifiName: "Guest", wifiPassword: "x", showWifiOnReceipt: false })
    ).toEqual({});
  });

  it("omits the password for an open network", () => {
    expect(
      receiptWifiFields({ wifiName: "Guest", wifiPassword: "", showWifiOnReceipt: true })
    ).toEqual({ wifiName: "Guest" });
  });

  it("treats a missing toggle as on (settings saved before the field existed)", () => {
    expect(receiptWifiFields({ wifiName: "Guest" })).toEqual({ wifiName: "Guest" });
  });
});

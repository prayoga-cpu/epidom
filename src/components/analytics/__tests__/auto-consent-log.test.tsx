import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const sent = vi.hoisted(() => ({ events: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/tracking-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tracking-events")>()),
  sendTrackingEvent: (event: Record<string, unknown>) => sent.events.push(event),
}));

import { MetaPixelConsentBridge } from "../meta-pixel-consent-bridge";
import { resetTrackingVendorState } from "../tracking-vendors";
import { CONSENT_BOOT_SCRIPT, CONSENT_MODE_COOKIE } from "@/lib/consent-region";

type W = { __epidomAutoConsent?: boolean; fbq?: unknown; _fbq?: unknown };

beforeEach(() => {
  sent.events = [];
  localStorage.clear();
  resetTrackingVendorState();
  delete (window as unknown as W).fbq;
  delete (window as unknown as W)._fbq;
  delete (window as unknown as W).__epidomAutoConsent;
  document.head.innerHTML = "";
  document.cookie = `${CONSENT_MODE_COOKIE}=; Max-Age=0; Path=/`;
  window.history.replaceState(null, "", "/id/sales-page-1-like");
  document.documentElement.setAttribute("lang", "id");
});

describe("an automatic consent, from the boot script to the admin log", () => {
  it("is logged once as AUTO, and the pixel starts with its PageView", () => {
    document.cookie = `${CONSENT_MODE_COOKIE}=opt-out; Path=/`;
    new Function(CONSENT_BOOT_SCRIPT)();

    const { unmount } = render(<MetaPixelConsentBridge />);
    expect(sent.events.map((e) => `${e.kind}:${e.name}`)).toEqual(["PIXEL:PageView", "CONSENT:AUTO"]);
    expect(sent.events[1]).toMatchObject({ analytics: true, marketing: true, source: "site", locale: "id" });
    expect(document.querySelector('script[src*="connect.facebook.net"]')).not.toBeNull();

    unmount();
    render(<MetaPixelConsentBridge />);
    expect(sent.events.filter((e) => e.name === "AUTO")).toHaveLength(1);
  });

  it("logs nothing and loads nothing where consent is needed", () => {
    document.cookie = `${CONSENT_MODE_COOKIE}=opt-in; Path=/`;
    new Function(CONSENT_BOOT_SCRIPT)();
    render(<MetaPixelConsentBridge />);
    expect(sent.events).toEqual([]);
    expect(document.querySelector('script[src*="connect.facebook.net"]')).toBeNull();
  });
});

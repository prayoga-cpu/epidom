/**
 * The customer-facing screen's standby states. It used to say "Customer display
 * is off" both when the cashier switched it off and when no till was driving
 * it (a till tab closed or reloaded) — so staff were told the setting was off
 * while it was on, and the WhatsApp button and the order stayed hidden.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, formatDate: () => "", locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({ currency: "IDR", formatPrice: (v: number | null | undefined) => `${v}` }),
}));
// The number pad has its own tests; here only whether it is open matters.
vi.mock("../pos-customer-display-phone", () => ({
  PosCustomerDisplayPhone: ({ open }: { open: boolean }) =>
    open ? <div data-testid="phone-pad" /> : null,
}));

import { PosCustomerDisplay } from "../pos-customer-display";
import { CUSTOMER_DISPLAY_DEFAULTS } from "@/lib/validation/customer-display.schemas";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";
import {
  EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
  customerDisplayChannelName,
  customerDisplaySnapshotKey,
  type CustomerDisplayMessage,
  type CustomerDisplaySnapshot,
} from "../../lib/customer-display";

const settle = (ms = 40) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

function leaveInMirror(storeId: string, phase: CustomerDisplaySnapshot["phase"]): void {
  window.localStorage.setItem(
    customerDisplaySnapshotKey(storeId),
    JSON.stringify({ ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT, phase, updatedAt: Date.now() })
  );
}

const config = (
  settings: Partial<CustomerDisplayConfig["settings"]> = {},
  branding: Partial<CustomerDisplayConfig["branding"]> = {}
): CustomerDisplayConfig => ({
  settings: { ...CUSTOMER_DISPLAY_DEFAULTS, ...settings },
  branding: {
    storeName: "Abenz Coffee",
    storefrontLogoUrl: null,
    storefrontThemeColor: "#C2410C",
    storefrontFontStyle: "SANS",
    googleReviewUrl: null,
    instagramUrl: null,
    wifiName: null,
    wifiPassword: null,
    ...branding,
  },
  updatedAt: null,
});

const ui = (storeId: string, initialConfig: CustomerDisplayConfig = config()) => (
  <PosCustomerDisplay storeId={storeId} defaultCountry="ID" initialConfig={initialConfig} />
);

const opened: BroadcastChannel[] = [];

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  opened.splice(0).forEach((channel) => channel.close());
});

describe("PosCustomerDisplay — standby", () => {
  it("waits for the till, without claiming it was switched off, when no till is driving it", async () => {
    leaveInMirror("closed-store", "closed");
    render(ui("closed-store"));
    await settle();

    expect(screen.getByText("pos.customerDisplay.waitingTill")).toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.waitingTillHint")).toBeInTheDocument();
    expect(screen.queryByText("pos.customerDisplay.standby")).not.toBeInTheDocument();
    // Nothing for the customer to touch while no till can receive it.
    expect(screen.queryByText("pos.customerDisplay.phoneCta")).not.toBeInTheDocument();
  });

  it("says it is off, and how to turn it on, when the cashier switched it off", async () => {
    leaveInMirror("off-store", "off");
    render(ui("off-store"));
    await settle();

    expect(screen.getByText("pos.customerDisplay.standby")).toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.standbyHint")).toBeInTheDocument();
    expect(screen.queryByText("pos.customerDisplay.waitingTill")).not.toBeInTheDocument();
  });

  it("shows the welcome and the WhatsApp button once a till is live", async () => {
    leaveInMirror("live-store", "idle");
    render(ui("live-store"));
    await settle();

    expect(screen.getByText("pos.customerDisplay.phoneCta")).toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.welcome")).toBeInTheDocument();
    // Nothing rung up yet: no empty receipt and no "IDR 0" totals.
    expect(screen.queryByText("pos.customerDisplay.yourOrder")).not.toBeInTheDocument();
  });

  it("opens the number pad for a till's ask that arrived over a stale standby", async () => {
    leaveInMirror("ask-store", "closed");
    render(ui("ask-store"));
    await settle();
    expect(screen.queryByTestId("phone-pad")).not.toBeInTheDocument();

    // A live till: answers the display's request, then asks for details.
    const till = new BroadcastChannel(customerDisplayChannelName("ask-store"));
    opened.push(till);
    till.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      if (event.data?.type !== "request") return;
      till.postMessage({
        type: "state",
        snapshot: { ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT, updatedAt: Date.now() },
      } satisfies CustomerDisplayMessage);
    };
    till.postMessage({ type: "ask-details" } satisfies CustomerDisplayMessage);

    await waitFor(() => expect(screen.getByTestId("phone-pad")).toBeInTheDocument());
    expect(screen.getByText("pos.customerDisplay.phoneCta")).toBeInTheDocument();
  });

  it("does not open the pad for an ask while the thank-you is up", async () => {
    window.localStorage.setItem(
      customerDisplaySnapshotKey("paid-store"),
      JSON.stringify({
        ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
        phase: "paid",
        total: 25000,
        updatedAt: Date.now(),
      })
    );
    render(ui("paid-store"));
    await settle();

    const till = new BroadcastChannel(customerDisplayChannelName("paid-store"));
    opened.push(till);
    till.postMessage({ type: "ask-details" } satisfies CustomerDisplayMessage);
    await settle(60);

    expect(screen.getByText("pos.customerDisplay.thankYou")).toBeInTheDocument();
    expect(screen.queryByTestId("phone-pad")).not.toBeInTheDocument();
  });
});

const OWN = "https://abc.public.blob.vercel-storage.com/users/u1/images/1-a.png";

function mirror(storeId: string, snapshot: Partial<CustomerDisplaySnapshot>): void {
  window.localStorage.setItem(
    customerDisplaySnapshotKey(storeId),
    JSON.stringify({ ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT, updatedAt: Date.now(), ...snapshot })
  );
}

const latte = { id: "l1", name: "Iced latte", quantity: 1, lineTotal: 30000, modifiers: [] };
const building = {
  phase: "building" as const,
  lines: [latte],
  highlightLineId: "l1",
  subtotal: 30000,
  tax: 0,
  total: 30000,
};
const banner = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  imageUrl: OWN,
  label: "Breakfast deal",
  active: true,
  startDate: null,
  endDate: null,
  days: [],
  startTime: null,
  endTime: null,
  ...over,
});

describe("PosCustomerDisplay — welcome and banners", () => {
  it("uses the store's own welcome text", async () => {
    mirror("text-store", { phase: "idle" });
    render(ui("text-store", config({ welcomeTitle: "Selamat datang di Otium" })));
    await settle();
    expect(screen.getByText("Selamat datang di Otium")).toBeInTheDocument();
    expect(screen.queryByText("pos.customerDisplay.welcome")).not.toBeInTheDocument();
  });

  it("plays the banners between customers, and skips one that is switched off", async () => {
    mirror("banner-store", { phase: "idle" });
    render(
      ui(
        "banner-store",
        config({ banners: [banner(), banner({ id: "b2", label: "Old promo", active: false })] })
      )
    );
    await settle();
    expect(screen.getByAltText("Breakfast deal")).toBeInTheDocument();
    expect(screen.queryByAltText("Old promo")).not.toBeInTheDocument();
    // The WhatsApp button stays reachable under the slideshow.
    expect(screen.getByText("pos.customerDisplay.phoneCta")).toBeInTheDocument();
  });

  it("shows no slideshow when the store turned it off", async () => {
    mirror("noslide-store", { phase: "idle" });
    render(ui("noslide-store", config({ idleSlideshow: false, banners: [banner()] })));
    await settle();
    expect(screen.queryByAltText("Breakfast deal")).not.toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.welcome")).toBeInTheDocument();
  });
});

describe("PosCustomerDisplay — order and payment", () => {
  it("shows the running order, without a tax line when there is no tax", async () => {
    mirror("order-store", building);
    render(ui("order-store"));
    await settle();
    expect(screen.getByText("pos.customerDisplay.yourOrder")).toBeInTheDocument();
    expect(screen.getAllByText("Iced latte").length).toBeGreaterThan(0);
    expect(screen.queryByText("pos.cart.tax")).not.toBeInTheDocument();
  });

  it("shows the store's QRIS and the amount while the cashier takes QRIS", async () => {
    mirror("qris-store", { ...building, paymentPrompt: "QRIS" });
    render(ui("qris-store", config({ qrisImageUrl: OWN })));
    await settle();
    expect(screen.getByText("pos.customerDisplay.scanToPay")).toBeInTheDocument();
    expect(screen.getByAltText("QRIS")).toHaveAttribute("src", OWN);
  });

  it("keeps showing the order when QRIS is picked but no QRIS was uploaded", async () => {
    mirror("noqris-store", { ...building, paymentPrompt: "QRIS" });
    render(ui("noqris-store"));
    await settle();
    expect(screen.queryByText("pos.customerDisplay.scanToPay")).not.toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.yourOrder")).toBeInTheDocument();
  });

  it("shows the change, the review QR and the guest WiFi on the thank-you", async () => {
    mirror("paid-extras", { phase: "paid", total: 45000, changeDue: 5000, paidOrderNumber: "A-7" });
    render(
      ui(
        "paid-extras",
        config(
          {},
          {
            googleReviewUrl: "https://search.google.com/local/writereview?placeid=x",
            wifiName: "Otium Guest",
            wifiPassword: "kopi1234",
          }
        )
      )
    );
    await settle();
    expect(screen.getByText("pos.customerDisplay.thankYou")).toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.change")).toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.reviewUs")).toBeInTheDocument();
    expect(screen.getByText("Otium Guest")).toBeInTheDocument();
    expect(screen.getByText("kopi1234")).toBeInTheDocument();
  });

  it("leaves the extras out when the store switched them off", async () => {
    mirror("paid-plain", { phase: "paid", total: 45000 });
    render(
      ui(
        "paid-plain",
        config(
          { showReviewQr: false, showWifi: false },
          { googleReviewUrl: "https://g.page/r/x", wifiName: "Otium Guest" }
        )
      )
    );
    await settle();
    expect(screen.queryByText("pos.customerDisplay.reviewUs")).not.toBeInTheDocument();
    expect(screen.queryByText("Otium Guest")).not.toBeInTheDocument();
    expect(screen.queryByText("pos.customerDisplay.change")).not.toBeInTheDocument();
  });

  it("ends the thank-you after the store's own, shorter time", async () => {
    mirror("short-thanks", { phase: "paid", total: 45000, updatedAt: Date.now() - 6_000 });
    render(ui("short-thanks", config({ thankYouSeconds: 5 })));
    await settle();
    expect(screen.queryByText("pos.customerDisplay.thankYou")).not.toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.welcome")).toBeInTheDocument();
  });

  it("keeps a just-settled thank-you up for the store's time", async () => {
    mirror("long-thanks", { phase: "paid", total: 45000, updatedAt: Date.now() - 6_000 });
    render(ui("long-thanks", config({ thankYouSeconds: 30 })));
    await settle();
    expect(screen.getByText("pos.customerDisplay.thankYou")).toBeInTheDocument();
  });
});

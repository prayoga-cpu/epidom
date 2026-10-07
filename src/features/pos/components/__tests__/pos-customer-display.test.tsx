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

const ui = (storeId: string) => (
  <PosCustomerDisplay
    storeId={storeId}
    storeName="Abenz Coffee"
    logoUrl={null}
    themeColor="#C2410C"
    defaultCountry="ID"
  />
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

  it("shows the order and the WhatsApp button once a till is live", async () => {
    leaveInMirror("live-store", "idle");
    render(ui("live-store"));
    await settle();

    expect(screen.getByText("pos.customerDisplay.phoneCta")).toBeInTheDocument();
    expect(screen.getByText("pos.customerDisplay.yourOrder")).toBeInTheDocument();
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

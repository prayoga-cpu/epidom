import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockSubData = vi.fn();
vi.mock("@/features/stores/stores/hooks/use-subscription-status", () => ({
  useSubscriptionStatus: () => mockSubData(),
}));

import {
  PosModeUpgradeProvider,
  PosModeUpgradeBanner,
  usePosModeUpgradeGate,
} from "../pos-mode-upgrade-banner";

function Harness({ plan }: { plan: string }) {
  mockSubData.mockReturnValue({ data: { subscription: { plan } } });
  return (
    <PosModeUpgradeProvider>
      <PosModeUpgradeBanner />
      <TriggerButton />
    </PosModeUpgradeProvider>
  );
}

function TriggerButton() {
  const { requireFeature } = usePosModeUpgradeGate();
  return (
    <button onClick={() => requireFeature("OPERATIONS", "Discounts need Operations.")}>
      apply discount
    </button>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PosModeUpgradeBanner gating (the discount-on-a-POS-tier-Cashier case)", () => {
  it("renders nothing until a gated action is attempted", () => {
    render(<Harness plan="POS" />);
    expect(screen.queryByText("Discounts need Operations.")).toBeNull();
  });

  it("below-tier: attempting the action surfaces the banner instead of allowing it", () => {
    render(<Harness plan="POS" />);
    fireEvent.click(screen.getByText("apply discount"));
    expect(screen.getByText("Discounts need Operations.")).toBeInTheDocument();
  });

  it("at-tier: attempting the action does not surface a banner", () => {
    render(<Harness plan="OPERATIONS" />);
    fireEvent.click(screen.getByText("apply discount"));
    expect(screen.queryByText("Discounts need Operations.")).toBeNull();
  });

  it("is dismissible via the close button", () => {
    render(<Harness plan="POS" />);
    fireEvent.click(screen.getByText("apply discount"));
    expect(screen.getByText("Discounts need Operations.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("common.actions.close"));
    expect(screen.queryByText("Discounts need Operations.")).toBeNull();
  });

  it("upgrade CTA links to the pricing page for the required tier", () => {
    render(<Harness plan="POS" />);
    fireEvent.click(screen.getByText("apply discount"));
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/pricing?upgrade=true&required=OPERATIONS#plans");
  });
});

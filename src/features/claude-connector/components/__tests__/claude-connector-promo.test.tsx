import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { en } from "@/locales/en";

/**
 * Who sees the "Ask Claude" tip: paying stores only, never someone who already
 * connected Claude, and a dismissal is saved to the guide state.
 */

const state = vi.hoisted(() => ({
  subscription: { plan: "OPERATIONS", status: "ACTIVE" } as {
    plan: string;
    status: string;
  } | null,
  apps: [] as unknown[],
  dismissed: false,
  dismissTip: vi.fn(),
}));

vi.mock("@/features/stores/stores/hooks/use-subscription-status", () => ({
  useSubscriptionStatus: () => ({ data: { subscription: state.subscription } }),
}));
vi.mock("../../hooks/use-connected-apps", () => ({
  useConnectedApps: () => ({ data: { apps: state.apps, stores: [], connectorUrl: "" } }),
}));
vi.mock("@/features/guide/hooks/use-guide-state", () => ({
  useGuideState: () => ({
    isReady: true,
    isAvailable: true,
    isTipDismissed: () => state.dismissed,
    dismissTip: state.dismissTip,
  }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/lang/i18n-provider", () => {
  const lookup = (key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined,
        en
      );
  return {
    useI18n: () => ({
      locale: "en",
      t: (key: string) => {
        const value = lookup(key);
        return typeof value === "string" ? value : key;
      },
    }),
  };
});

import { ClaudeConnectorPromo } from "../claude-connector-promo";

function renderPromo(props: Partial<React.ComponentProps<typeof ClaudeConnectorPromo>> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ClaudeConnectorPromo surface="finance" storeId="s1" {...props} />
    </QueryClientProvider>
  );
}

describe("ClaudeConnectorPromo", () => {
  beforeEach(() => {
    state.subscription = { plan: "OPERATIONS", status: "ACTIVE" };
    state.apps = [];
    state.dismissed = false;
    state.dismissTip.mockReset();
  });

  it("invites an Operations store to try it, linking to the Profile card", () => {
    renderPromo();
    const link = screen.getByRole("link", { name: en.claudeConnector.promo.ctaTry });
    expect(link.getAttribute("href")).toBe("/store/s1/profile#claude");
    expect(screen.getByText(/Why was margin down last week\?/)).toBeTruthy();
  });

  it("sends a POS store to the Operations plan instead", () => {
    state.subscription = { plan: "POS", status: "ACTIVE" };
    renderPromo({ surface: "dashboard" });
    const link = screen.getByRole("link", { name: en.claudeConnector.promo.ctaUpgrade });
    expect(link.getAttribute("href")).toContain("required=OPERATIONS");
  });

  it("stays out of the way for Free stores, connected accounts, dismissals and non-managers", () => {
    state.subscription = { plan: "FREE", status: "ACTIVE" };
    expect(renderPromo().container.firstChild).toBeNull();

    state.subscription = { plan: "OPERATIONS", status: "ACTIVE" };
    state.apps = [{ clientId: "c" }];
    expect(renderPromo().container.firstChild).toBeNull();

    state.apps = [];
    state.dismissed = true;
    expect(renderPromo().container.firstChild).toBeNull();

    state.dismissed = false;
    expect(renderPromo({ canView: false }).container.firstChild).toBeNull();
  });

  it("saves a dismissal to the guide state", () => {
    renderPromo();
    fireEvent.click(screen.getByRole("button", { name: en.claudeConnector.promo.dismiss }));
    expect(state.dismissTip).toHaveBeenCalledWith("claudeConnector");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SUPPORT_MAILTO } from "@/lib/constants/contact";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, formatDate: (d: Date) => d.toISOString() }),
}));
vi.mock("@/features/dashboard/shared/hooks/use-owner-pin", () => ({
  useOwnerPinStatus: () => ({ data: undefined }),
}));
vi.mock("@/features/dashboard/shared/set-owner-pin-dialog", () => ({
  SetOwnerPinDialog: () => null,
}));
vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AccountSettingsCard } from "../account-settings-card";

const DAY = 24 * 60 * 60 * 1000;

function account(overrides: Record<string, unknown>) {
  return {
    createdAt: new Date(Date.now() - 400 * DAY).toISOString(),
    deactivatedAt: null,
    reactivationDeadline: null,
    retentionDeadline: null,
    dataUsage: { totalStores: 1, totalProducts: 2, totalOrders: 3, totalStaff: 4 },
    linkedAccounts: [],
    hasPasswordAccount: true,
    sessions: [],
    ...overrides,
  };
}

function renderCard(data: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ data }) }))
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccountSettingsCard userEmail="owner@example.com" />
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AccountSettingsCard: recovering a deactivated account past the 30-day window", () => {
  it("offers a mailto to the shared support inbox", async () => {
    renderCard(
      account({
        deactivatedAt: new Date(Date.now() - 40 * DAY).toISOString(),
        reactivationDeadline: new Date(Date.now() - 10 * DAY).toISOString(),
      })
    );

    const link = await screen.findByRole("link", {
      name: "profile.accountSettings.contactSupportToRecover",
    });
    expect(link.getAttribute("href")).toBe(SUPPORT_MAILTO);
  });

  it("inside the window it offers self-service reactivation instead, with no support link", async () => {
    renderCard(
      account({
        deactivatedAt: new Date(Date.now() - 2 * DAY).toISOString(),
        reactivationDeadline: new Date(Date.now() + 28 * DAY).toISOString(),
      })
    );

    expect(
      await screen.findByRole("button", { name: "profile.accountSettings.reactivateAccount" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "profile.accountSettings.contactSupportToRecover" })
    ).toBeNull();
  });
});

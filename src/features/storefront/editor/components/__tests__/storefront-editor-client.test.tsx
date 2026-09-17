import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock("@/lib/api", () => ({
  storefrontApi: {
    getStorefront: () => Promise.resolve({ id: "sf-1", slug: "test-store" }),
  },
}));

const mockSubData = vi.fn();
vi.mock("@/features/stores/stores/hooks/use-subscription-status", () => ({
  useSubscriptionStatus: () => mockSubData(),
}));

const mockPosSession = vi.fn();
vi.mock("@/features/pos/hooks/use-pos-session", () => ({
  usePosSession: () => mockPosSession(),
}));

const mockSearchParams = new URLSearchParams();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/store/store-1/storefront",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("../storefront-settings", () => ({
  StorefrontSettings: () => <div data-testid="settings-tab" />,
}));
vi.mock("../storefront-analytics", () => ({
  StorefrontAnalytics: () => <div data-testid="analytics-tab" />,
}));
vi.mock("../menu-manager", () => ({
  MenuManager: () => <div data-testid="menu-manager" />,
}));

import { StorefrontEditorClient } from "../storefront-editor-client";

function renderClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StorefrontEditorClient storeId="store-1" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockSearchParams.forEach((_v, k) => mockSearchParams.delete(k));
  mockReplace.mockClear();
  mockSubData.mockReturnValue({ data: { subscription: { plan: "OPERATIONS" } } });
  mockPosSession.mockReturnValue({
    isActive: false,
    storeId: null,
    staffRole: null,
    allowedPages: null,
  });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("StorefrontEditorClient — Owner/Manager (unrestricted)", () => {
  it("defaults to the Settings tab with no ?tab= param", async () => {
    renderClient();
    expect(await screen.findByTestId("settings-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("menu-manager")).toBeNull();
  });

  it("?tab=menu (the retired /menu page's redirect target) opens the Menu tab", async () => {
    mockSearchParams.set("tab", "menu");
    renderClient();
    expect(await screen.findByTestId("menu-manager")).toBeInTheDocument();
  });

  it("renders the full 3-tab editor, not the menu-only-staff bare view", async () => {
    renderClient();
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
  });
});

describe("StorefrontEditorClient — menu-only staff persona", () => {
  it("renders bare MenuManager, no tabs, for a persona granted /menu but not /storefront", async () => {
    mockPosSession.mockReturnValue({
      isActive: true,
      storeId: "store-1",
      staffRole: "CASHIER",
      allowedPages: ["/menu", "/pos"],
    });
    renderClient();
    expect(await screen.findByTestId("menu-manager")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByTestId("settings-tab")).toBeNull();
  });

  it("a persona granted BOTH /menu and /storefront still sees the full editor", async () => {
    mockPosSession.mockReturnValue({
      isActive: true,
      storeId: "store-1",
      staffRole: "MANAGER",
      allowedPages: ["/menu", "/storefront"],
    });
    renderClient();
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
  });

  it("an OWNER-role StaffMember row is treated as unrestricted, not menu-only", async () => {
    mockPosSession.mockReturnValue({
      isActive: true,
      storeId: "store-1",
      staffRole: "OWNER",
      allowedPages: ["/menu"],
    });
    renderClient();
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
  });
});

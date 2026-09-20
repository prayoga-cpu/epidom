import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/lib/admin", () => ({ isAdminEmail: () => false }));
vi.mock("../store-card", () => ({
  StoreCard: ({ store, isBlocked }: { store: { name: string }; isBlocked: boolean }) => (
    <div data-testid="store-card" data-blocked={String(isBlocked)}>
      {store.name}
    </div>
  ),
}));
vi.mock("../admin-card", () => ({ AdminCard: () => null }));
vi.mock("../create-store-dialog", () => ({
  CreateStoreDialog: () => <div data-testid="create-store" />,
}));

const h = vi.hoisted(() => ({
  stores: { current: [] as unknown[] },
  subscription: { current: undefined as unknown },
  error: { current: null as unknown },
}));
vi.mock("../../hooks/use-stores", () => ({
  useStores: () => ({
    data: h.stores.current,
    isLoading: false,
    error: h.error.current,
    refetch: vi.fn(),
  }),
}));
vi.mock("../../hooks/use-subscription-status", () => ({
  useSubscriptionStatus: () => ({ data: h.subscription.current, isLoading: false }),
}));

import { StoresContainer } from "../stores-container";
import { UnauthorizedError } from "@/lib/api/unauthorized";

const ownerStore = { id: "s1", name: "Owned Cafe", accessRole: "owner" };
const staffStore = {
  id: "s2",
  name: "Staffed Cafe",
  accessRole: "staff",
  staffHomePath: "/store/s2/pos",
};
const activeSub = {
  hasSubscription: true,
  subscription: { status: "ACTIVE", plan: "POS" },
  storeUsage: { current: 1, limit: 5, canCreateMore: true },
};

let originalLocation: Location;
function mockProfile(profile: unknown) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: profile }),
  })) as never;
}

beforeEach(() => {
  h.stores.current = [];
  h.error.current = null;
  h.subscription.current = activeSub;
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href: "http://localhost/stores" },
  });
});
afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe("StoresContainer — the onboarding gatekeeper", () => {
  it("a brand-new account with no business and no staff link is sent to onboarding (unchanged)", async () => {
    mockProfile({ business: null, staffLink: null });
    render(<StoresContainer />);
    await waitFor(() => expect(window.location.href).toBe("/onboarding"));
  });

  it("a linked staff login has no business by design and is NOT sent to onboarding", async () => {
    h.stores.current = [staffStore];
    mockProfile({ business: null, staffLink: { storeId: "s2", storeName: "Staffed Cafe" } });
    render(<StoresContainer />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/user/profile"));
    await new Promise((r) => setTimeout(r, 20));
    expect(window.location.href).toBe("http://localhost/stores");
  });

  it("an owner with a store is not redirected", async () => {
    h.stores.current = [ownerStore];
    mockProfile({ business: { stores: [{ id: "s1" }] }, staffLink: null });
    render(<StoresContainer />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(window.location.href).toBe("http://localhost/stores");
  });
});

describe("StoresContainer — what a linked staff login sees", () => {
  it("a staff-only list has no 'create a store' button, and the staff card is never plan-blocked", async () => {
    h.stores.current = [staffStore];
    // The viewer has no subscription of their own — that must not block the card.
    h.subscription.current = { hasSubscription: false, subscription: null, storeUsage: null };
    mockProfile({ business: null, staffLink: { storeId: "s2", storeName: "Staffed Cafe" } });
    render(<StoresContainer />);

    const card = await screen.findByTestId("store-card");
    expect(card).toHaveAttribute("data-blocked", "false");
    expect(screen.queryByTestId("create-store")).toBeNull();
    expect(screen.queryByText("stores.subscribeToCreateStore")).toBeNull();
  });

  it("an owner still gets the create-store button", async () => {
    h.stores.current = [ownerStore];
    mockProfile({ business: { stores: [{ id: "s1" }] }, staffLink: null });
    render(<StoresContainer />);

    expect(await screen.findByTestId("create-store")).toBeInTheDocument();
  });

  it("someone who owns a store AND works at another keeps the create button and sees both cards", async () => {
    h.stores.current = [ownerStore, staffStore];
    mockProfile({
      business: { stores: [{ id: "s1" }] },
      staffLink: { storeId: "s2", storeName: "Staffed Cafe" },
    });
    render(<StoresContainer />);

    expect(await screen.findByTestId("create-store")).toBeInTheDocument();
    expect(screen.getAllByTestId("store-card")).toHaveLength(2);
  });

  it("with a lapsed OWNER subscription, an owned card is blocked but the staff card is not", async () => {
    h.stores.current = [ownerStore, staffStore];
    h.subscription.current = {
      hasSubscription: true,
      subscription: { status: "CANCELED", plan: "POS" },
      storeUsage: { current: 1, limit: 5, canCreateMore: true },
    };
    mockProfile({ business: { stores: [{ id: "s1" }] }, staffLink: { storeId: "s2", storeName: "x" } });
    render(<StoresContainer />);

    const cards = await screen.findAllByTestId("store-card");
    const byName = Object.fromEntries(cards.map((c) => [c.textContent, c.getAttribute("data-blocked")]));
    expect(byName).toEqual({ "Owned Cafe": "true", "Staffed Cafe": "false" });
  });
});

describe("StoresContainer — a session that is no longer live", () => {
  // What the profile call really does with a dead session: 401, not a profile.
  function mockDeadSession() {
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as never;
  }

  it("a 401 sends the person to sign in instead of leaving a dead-end error on screen", async () => {
    h.error.current = new UnauthorizedError();
    mockDeadSession();
    render(<StoresContainer />);

    await waitFor(() => expect(window.location.href).toBe("/login"));
    expect(screen.queryByText("stores.errorLoading")).toBeNull();
    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("any other failure still shows the error with Try Again, and does not redirect", async () => {
    h.error.current = new Error("Database is down");
    mockProfile({ business: { stores: [{ id: "s1" }] }, staffLink: null });
    render(<StoresContainer />);

    expect(await screen.findByText("stores.errorLoading")).toBeInTheDocument();
    expect(screen.getByText("Database is down")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(window.location.href).toBe("http://localhost/stores");
  });

  it("a healthy session is never redirected", async () => {
    h.stores.current = [ownerStore];
    mockProfile({ business: { stores: [{ id: "s1" }] }, staffLink: null });
    render(<StoresContainer />);

    expect(await screen.findByTestId("store-card")).toBeInTheDocument();
    expect(window.location.href).toBe("http://localhost/stores");
  });
});

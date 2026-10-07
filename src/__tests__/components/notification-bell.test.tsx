import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
}));

vi.mock("@/features/dashboard/shared/hooks/use-current-store", () => ({
  useCurrentStore: () => ({ storeId: "store-1" }),
}));

const mockNotifications = vi.fn();
const lastQuery: { queryFn?: () => Promise<unknown> } = {};
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    lastQuery.queryFn = queryFn;
    const result = mockNotifications();
    return { data: result, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const mockApiGet = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 minutes ago",
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => {
      if (k === "notifications.allCaughtUp") return "All caught up!";
      if (k === "notifications.clearAll") return "Clear all";
      if (k === "notifications.viewAllOrders") return "View all orders →";
      if (k === "notifications.title") return "Notifications";
      if (k === "notifications.dismiss") return "Dismiss";
      return k;
    },
    locale: "en",
  }),
}));

// Radix Popover — render children inline so we can interact with the content
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: any) => (asChild ? children : <div>{children}</div>),
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}));

import { NotificationBell } from "@/features/dashboard/shared/notification-bell";
import { APP_VERSION } from "@/lib/version";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const orderNotif = {
  id: "n1",
  type: "order" as const,
  title: "New Order",
  body: "Order #001 received",
  href: "/store/store-1/pos/orders",
  createdAt: new Date().toISOString(),
};

const reservationNotif = {
  id: "n2",
  type: "reservation" as const,
  title: "New Reservation",
  body: "Table 3 booked",
  href: "/store/store-1/tables",
  createdAt: new Date().toISOString(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("NotificationBell", () => {
  beforeEach(() => {
    mockPush.mockClear();
    // Default to "already seen the current version" so the pinned "What's new"
    // prompt doesn't interfere with the operational-notification assertions.
    localStorage.setItem("epidom:lastSeenVersion", APP_VERSION);
  });

  it("shows the 'What's new' prompt when the current version is unseen", () => {
    localStorage.removeItem("epidom:lastSeenVersion");
    mockNotifications.mockReturnValue({ notifications: [] });
    render(<NotificationBell />);
    expect(screen.getByText("changelog.whatsNew")).toBeTruthy();
  });

  it("clicking the 'What's new' prompt marks it seen and navigates to the changelog", () => {
    localStorage.removeItem("epidom:lastSeenVersion");
    mockNotifications.mockReturnValue({ notifications: [] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText("changelog.whatsNew"));
    expect(mockPush).toHaveBeenCalledWith("/store/store-1/changelog");
    expect(localStorage.getItem("epidom:lastSeenVersion")).toBe(APP_VERSION);
  });

  it("renders bell with no badge when 0 notifications", () => {
    mockNotifications.mockReturnValue({ notifications: [] });
    render(<NotificationBell />);
    expect(screen.queryByText(/\d+/)).toBeNull();
  });

  it("renders badge with correct count when notifications exist", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif, reservationNotif] });
    render(<NotificationBell />);
    // Badge appears both in the bell icon area and in the popover header — both show count
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("dismiss single removes item from list", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif, reservationNotif] });
    render(<NotificationBell />);
    // The changelog history item is always present, so target the New Order row's own X
    const orderRow = screen.getByText("New Order").closest("li")!;
    fireEvent.click(within(orderRow).getByLabelText("Dismiss"));
    expect(screen.queryByText("New Order")).toBeNull();
    expect(screen.getByText("New Reservation")).toBeTruthy();
  });

  it("clear all removes all items", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif, reservationNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText("Clear all"));
    expect(screen.queryByText("New Order")).toBeNull();
    expect(screen.queryByText("New Reservation")).toBeNull();
    expect(screen.getByText("All caught up!")).toBeTruthy();
  });

  it("clicking notification row navigates to n.href", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText("New Order"));
    expect(mockPush).toHaveBeenCalledWith(orderNotif.href);
  });

  it("'View all orders' navigates to correct URL when storeId is set", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText(/view all orders/i));
    expect(mockPush).toHaveBeenCalledWith("/store/store-1/pos");
  });

  it("'View all orders' does NOT navigate when storeId is undefined", () => {
    vi.doMock("@/features/dashboard/shared/hooks/use-current-store", () => ({
      useCurrentStore: () => ({ storeId: undefined }),
    }));
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText(/view all orders/i));
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining("undefined"));
  });

  it("has no nested button elements (hydration regression)", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    const { container } = render(<NotificationBell />);
    // Find any button that contains another button
    const buttons = container.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn.querySelector("button")).toBeNull();
    });
  });

  it("shows empty state when all notifications dismissed", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    render(<NotificationBell />);
    // "Clear all" dismisses every visible item, including the changelog history item
    fireEvent.click(screen.getByText("Clear all"));
    expect(screen.getByText("All caught up!")).toBeTruthy();
  });
});

describe("NotificationBell — POS variant", () => {
  const unpaidOnlineOrder = {
    id: "order-o1",
    type: "order" as const,
    title: "New online order · unpaid",
    body: "STO-0042 · STOREFRONT",
    href: "/store/store-1/pos/orders",
    createdAt: new Date().toISOString(),
    orderNumber: "STO-0042",
    source: "STOREFRONT",
    unpaid: true,
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockApiGet.mockReset();
    // Unseen on purpose: the POS bell must still leave the changelog prompt out.
    localStorage.removeItem("epidom:lastSeenVersion");
  });

  it("asks the API for the POS scope", async () => {
    mockNotifications.mockReturnValue({ notifications: [] });
    render(<NotificationBell variant="pos" />);
    await lastQuery.queryFn?.();
    expect(mockApiGet).toHaveBeenCalledWith("/stores/store-1/notifications", { scope: "pos" });
  });

  it("the Back Office bell keeps asking without a scope", async () => {
    mockNotifications.mockReturnValue({ notifications: [] });
    render(<NotificationBell />);
    await lastQuery.queryFn?.();
    expect(mockApiGet).toHaveBeenCalledWith("/stores/store-1/notifications", undefined);
  });

  it("leaves out the Back Office-only changelog prompt", () => {
    mockNotifications.mockReturnValue({ notifications: [] });
    render(<NotificationBell variant="pos" />);
    expect(screen.queryByText("changelog.whatsNew")).toBeNull();
    expect(screen.getByText("All caught up!")).toBeTruthy();
  });

  it("words an unpaid online order as one to collect at the cashier", () => {
    mockNotifications.mockReturnValue({ notifications: [unpaidOnlineOrder] });
    render(<NotificationBell variant="pos" />);
    expect(screen.getByText("notifications.order.unpaidTitle")).toBeTruthy();
    expect(screen.getByText("notifications.order.unpaidBody")).toBeTruthy();
    fireEvent.click(screen.getByText("notifications.order.unpaidTitle"));
    expect(mockPush).toHaveBeenCalledWith("/store/store-1/pos/orders");
  });

  it("'View all orders' opens the POS order queue", () => {
    mockNotifications.mockReturnValue({ notifications: [unpaidOnlineOrder] });
    render(<NotificationBell variant="pos" />);
    fireEvent.click(screen.getByText(/view all orders/i));
    expect(mockPush).toHaveBeenCalledWith("/store/store-1/pos/orders");
  });
});
